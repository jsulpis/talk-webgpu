import type { Params } from "../../commons/tweakpane";
import { boidsUniforms, type BoidsUniforms } from "../../shared/params";
import { createBoidsCompute } from "./gpgpuCommon";
import spatialShaderSource from "./shaders/spatial.wgsl?raw";

// CELL_SIZE should be the max interaction radius (separation, alignment, or cohesion distance)
// but it's hardcoded to 6 to improve performance for the demo
const CELL_SIZE = 6;
const GRID_DIM = Math.ceil((2 * boidsUniforms.bounds) / CELL_SIZE); // cells per axis
const GRID_CELLS = GRID_DIM ** 3;
const GRID_ORIGIN = -boidsUniforms.bounds;

export function useBoidsSpatialGPU(
  device: GPUDevice,
  initialPositions: Float32Array,
  initialVelocities: Float32Array,
  colorsBuffer: GPUBuffer,
  params: Params
) {
  const { count, workgroups, makeBindGroups, runFrame } = createBoidsCompute(
    device,
    params,
    initialPositions,
    initialVelocities
  );

  const shaderModule = device.createShaderModule({
    code: spatialShaderSource,
    label: "Spatial Hash Shader",
  });

  // 4 pipelines (one entry point each) share one explicit layout so a single
  // bind group is valid across all dispatches of the frame.
  const bindGroupLayout = device.createBindGroupLayout({
    label: "Spatial Bind Group Layout",
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } }, // input positions
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } }, // input velocities
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }, // output positions
      { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }, // output velocities
      { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } }, // colors
      { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }, // uniforms
      { binding: 6, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }, // cellCounts
      { binding: 7, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }, // cursor
      { binding: 8, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }, // sortedBoids
    ],
  });

  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
    label: "Spatial Pipeline Layout",
  });

  const createPipeline = (entryPoint: string, label: string) =>
    device.createComputePipeline({
      layout: pipelineLayout,
      label,
      compute: { module: shaderModule, entryPoint },
    });

  const countPipeline = createPipeline("gridCount", "Grid Count Pipeline");
  const scanPipeline = createPipeline("gridScan", "Grid Scan Pipeline");
  const scatterPipeline = createPipeline("gridScatter", "Grid Scatter Pipeline");
  const simulatePipeline = createPipeline("simulate", "Simulate Pipeline");

  const cellCountsBuffer = device.createBuffer({
    size: GRID_CELLS * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, // COPY_DST: cleared by clearBuffer each frame
    label: "Cell Counts Buffer",
  });

  const cursorBuffer = device.createBuffer({
    size: GRID_CELLS * 4,
    usage: GPUBufferUsage.STORAGE,
    label: "Cell Cursor Buffer",
  });

  const sortedBoidsBuffer = device.createBuffer({
    size: count * 4,
    usage: GPUBufferUsage.STORAGE,
    label: "Sorted Boids Buffer",
  });

  const bindGroups = makeBindGroups(bindGroupLayout, colorsBuffer, [
    { binding: 6, resource: { buffer: cellCountsBuffer } },
    { binding: 7, resource: { buffer: cursorBuffer } },
    { binding: 8, resource: { buffer: sortedBoidsBuffer } },
  ]);

  return function compute(uniforms: BoidsUniforms) {
    return runFrame({
      uniforms,
      extras: [CELL_SIZE, GRID_DIM, GRID_ORIGIN],
      bindGroups,
      clear: (encoder) => encoder.clearBuffer(cellCountsBuffer),
      dispatch: (pass) => {
        pass.setPipeline(countPipeline);
        pass.dispatchWorkgroups(workgroups);
        pass.setPipeline(scanPipeline);
        pass.dispatchWorkgroups(1);
        pass.setPipeline(scatterPipeline);
        pass.dispatchWorkgroups(workgroups);
        pass.setPipeline(simulatePipeline);
        pass.dispatchWorkgroups(workgroups);
      },
    });
  };
}
