import type { Params } from "../../commons/tweakpane";
import type { BoidsUniforms } from "../../shared/params";
import { createBoidsCompute } from "./gpgpuCommon";
import computeShaderSource from "./shaders/compute.wgsl?raw";

export function useBoidsGPU(
  device: GPUDevice,
  initialPositions: Float32Array,
  initialVelocities: Float32Array,
  colorsBuffer: GPUBuffer,
  params: Params
) {
  const { workgroups, makeBindGroups, runFrame } = createBoidsCompute(
    device,
    params,
    initialPositions,
    initialVelocities
  );

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

  const bindGroups = makeBindGroups(computePipeline.getBindGroupLayout(0), colorsBuffer);

  return function compute(uniforms: BoidsUniforms) {
    return runFrame({
      uniforms,
      bindGroups,
      dispatch: (pass) => {
        pass.setPipeline(computePipeline);
        pass.dispatchWorkgroups(workgroups);
      },
    });
  };
}
