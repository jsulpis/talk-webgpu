import type { Params } from "../../commons/tweakpane";
import { type BoidsUniforms, computeTime } from "../../shared";
import { initTimingObjects, resolveTimingQuery, readTimingBuffer } from "../utils";
import computeShaderSource from "./shaders/compute.wgsl?raw";

export function useBoidsGPU(
  device: GPUDevice,
  initialPositions: Float32Array,
  initialVelocities: Float32Array,
  colorsBuffer: GPUBuffer,
  params: Params
) {
  const { querySet, resultBuffer, resolveBuffer, timestampWrites } = initTimingObjects(device);

  const computePipeline = device.createComputePipeline({
    layout: "auto",
    compute: {
      module: device.createShaderModule({
        code: computeShaderSource,
        label: "Compute Shader",
      }),
      entryPoint: "computeBoids",
    },
  });

  const computeUniformBufferSize = 32;
  const computeUniformBuffer = device.createBuffer({
    size: computeUniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    label: "Compute Uniform Buffer",
  });

  const positionsBufferA = device.createBuffer({
    size: initialPositions.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    label: "Positions Buffer A",
  });
  device.queue.writeBuffer(positionsBufferA, 0, initialPositions);

  const positionsBufferB = device.createBuffer({
    size: initialPositions.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    label: "Positions Buffer B",
  });
  device.queue.writeBuffer(positionsBufferB, 0, initialPositions);

  const velocitiesBufferA = device.createBuffer({
    size: initialVelocities.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    label: "Velocity Buffer A",
  });
  device.queue.writeBuffer(velocitiesBufferA, 0, initialVelocities);

  const velocitiesBufferB = device.createBuffer({
    size: initialVelocities.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    label: "Velocity Buffer B",
  });
  device.queue.writeBuffer(velocitiesBufferB, 0, initialVelocities);

  const computeBindGroupA = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: positionsBufferA } },
      { binding: 1, resource: { buffer: velocitiesBufferA } },
      { binding: 2, resource: { buffer: positionsBufferB } },
      { binding: 3, resource: { buffer: velocitiesBufferB } },
      { binding: 4, resource: { buffer: colorsBuffer } },
      { binding: 5, resource: { buffer: computeUniformBuffer } },
    ],
    label: "Compute Bind Group A",
  });

  const computeBindGroupB = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: positionsBufferB } },
      { binding: 1, resource: { buffer: velocitiesBufferB } },
      { binding: 2, resource: { buffer: positionsBufferA } },
      { binding: 3, resource: { buffer: velocitiesBufferA } },
      { binding: 4, resource: { buffer: colorsBuffer } },
      { binding: 5, resource: { buffer: computeUniformBuffer } },
    ],
    label: "Compute Bind Group B",
  });

  let direction: "AtoB" | "BtoA" = "AtoB";

  function compute({
    deltaTime,
    separationDistance,
    alignmentDistance,
    cohesionDistance,
    borderForce,
    borderDistance,
    bounds,
  }: BoidsUniforms) {
    const computeUniformData = new Float32Array([
      deltaTime,
      separationDistance,
      alignmentDistance,
      cohesionDistance,
      borderForce,
      borderDistance,
      bounds,
    ]);

    device.queue.writeBuffer(computeUniformBuffer, 0, computeUniformData);

    const computeEncoder = device.createCommandEncoder({ label: "Compute Command Encoder" });

    const computePass = computeEncoder.beginComputePass({ timestampWrites });
    computePass.setPipeline(computePipeline);
    computePass.setBindGroup(0, direction === "AtoB" ? computeBindGroupA : computeBindGroupB);
    computePass.dispatchWorkgroups(Math.ceil(params.objects / 64));

    computePass.end();
    resolveTimingQuery(querySet, resultBuffer, computeEncoder, resolveBuffer);
    device.queue.submit([computeEncoder.finish()]);

    readTimingBuffer(resultBuffer).then((measure) => {
      if (measure && measure > 0) {
        computeTime.addValue(measure);
        params.computeTime = computeTime.getAverage().toFixed(1) + "ms";
      }
    });

    const positionResultBuffer = direction === "AtoB" ? positionsBufferB : positionsBufferA;
    const velocitiesResultBuffer = direction === "AtoB" ? velocitiesBufferB : velocitiesBufferA;

    direction = direction === "AtoB" ? "BtoA" : "AtoB";

    return {
      positionsBuffer: positionResultBuffer,
      velocitiesBuffer: velocitiesResultBuffer,
    };
  }

  return compute;
}
