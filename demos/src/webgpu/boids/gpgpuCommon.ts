import type { Params } from "../../commons/tweakpane";
import { computeTime, type BoidsUniforms } from "../../shared/params";
import { initTimingObjects, readTimingBuffer, resolveTimingQuery } from "../utils";

const UNIFORM_BUFFER_SIZE = 48; // 7 boids uniforms + up to 3 extras, padded to a 16-byte multiple

export interface BoidsBindGroups {
  A: GPUBindGroup;
  B: GPUBindGroup;
}

export interface BoidsCompute {
  count: number;
  workgroups: number;
  makeBindGroups: (layout: GPUBindGroupLayout, colorsBuffer: GPUBuffer, extraEntries?: GPUBindGroupEntry[]) => BoidsBindGroups;
  runFrame: (options: {
    uniforms: BoidsUniforms;
    bindGroups: BoidsBindGroups;
    dispatch: (pass: GPUComputePassEncoder) => void;
    extras?: number[];
    clear?: (encoder: GPUCommandEncoder) => void;
  }) => { positionsBuffer: GPUBuffer; velocitiesBuffer: GPUBuffer };
}

function createPingPongBuffer(device: GPUDevice, data: Float32Array, label: string) {
  const buffer = device.createBuffer({
    size: data.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    label,
  });
  device.queue.writeBuffer(buffer, 0, data);
  return buffer;
}

/**
 * Scaffolding shared by every boids compute variant: the position/velocity
 * ping-pong buffers, the uniform buffer, the A/B bind groups, and the frame
 * loop (dispatch, GPU timing, buffer swap). A variant only provides its
 * pipelines, its extra bind group entries, and its dispatch sequence.
 */
export function createBoidsCompute(
  device: GPUDevice,
  params: Params,
  initialPositions: Float32Array,
  initialVelocities: Float32Array
): BoidsCompute {
  const { querySet, resultBuffer, resolveBuffer, timestampWrites } = initTimingObjects(device);

  const count = initialPositions.length / 4;
  const workgroups = Math.ceil(count / 64);

  const positionsBufferA = createPingPongBuffer(device, initialPositions, "Positions Buffer A");
  const positionsBufferB = createPingPongBuffer(device, initialPositions, "Positions Buffer B");
  const velocitiesBufferA = createPingPongBuffer(device, initialVelocities, "Velocity Buffer A");
  const velocitiesBufferB = createPingPongBuffer(device, initialVelocities, "Velocity Buffer B");

  const uniformBuffer = device.createBuffer({
    size: UNIFORM_BUFFER_SIZE,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    label: "Compute Uniform Buffer",
  });

  let direction: "AtoB" | "BtoA" = "AtoB";

  // Slots 0..5 are shared by every variant (positions/velocities in and out,
  // colors, uniforms); variants append their own buffers from slot 6 on.
  function makeBindGroups(
    layout: GPUBindGroupLayout,
    colorsBuffer: GPUBuffer,
    extraEntries: GPUBindGroupEntry[] = []
  ): BoidsBindGroups {
    const make = (inputs: [GPUBuffer, GPUBuffer], outputs: [GPUBuffer, GPUBuffer], label: string) =>
      device.createBindGroup({
        layout,
        label,
        entries: [
          { binding: 0, resource: { buffer: inputs[0] } },
          { binding: 1, resource: { buffer: inputs[1] } },
          { binding: 2, resource: { buffer: outputs[0] } },
          { binding: 3, resource: { buffer: outputs[1] } },
          { binding: 4, resource: { buffer: colorsBuffer } },
          { binding: 5, resource: { buffer: uniformBuffer } },
          ...extraEntries,
        ],
      });

    return {
      A: make(
        [positionsBufferA, velocitiesBufferA],
        [positionsBufferB, velocitiesBufferB],
        "Compute Bind Group A"
      ),
      B: make(
        [positionsBufferB, velocitiesBufferB],
        [positionsBufferA, velocitiesBufferA],
        "Compute Bind Group B"
      ),
    };
  }

  function runFrame({
    uniforms,
    bindGroups,
    dispatch,
    extras = [],
    clear,
  }: {
    uniforms: BoidsUniforms;
    bindGroups: BoidsBindGroups;
    dispatch: (pass: GPUComputePassEncoder) => void;
    extras?: number[];
    clear?: (encoder: GPUCommandEncoder) => void;
  }) {
    const {
      deltaTime,
      separationDistance,
      alignmentDistance,
      cohesionDistance,
      borderForce,
      borderDistance,
      bounds,
    } = uniforms;

    device.queue.writeBuffer(
      uniformBuffer,
      0,
      new Float32Array([
        deltaTime,
        separationDistance,
        alignmentDistance,
        cohesionDistance,
        borderForce,
        borderDistance,
        bounds,
        ...extras,
      ])
    );

    const encoder = device.createCommandEncoder({ label: "Compute Command Encoder" });
    clear?.(encoder);

    const pass = encoder.beginComputePass({ timestampWrites });
    pass.setBindGroup(0, direction === "AtoB" ? bindGroups.A : bindGroups.B);
    dispatch(pass);
    pass.end();

    resolveTimingQuery(querySet, resultBuffer, encoder, resolveBuffer);
    device.queue.submit([encoder.finish()]);

    readTimingBuffer(resultBuffer).then((measure) => {
      if (measure && measure > 0) {
        computeTime.addValue(measure);
        params.computeTime = computeTime.getAverage().toFixed(1) + "ms";
      }
    });

    const toB = direction === "AtoB";
    direction = toB ? "BtoA" : "AtoB";

    return {
      positionsBuffer: toB ? positionsBufferB : positionsBufferA,
      velocitiesBuffer: toB ? velocitiesBufferB : velocitiesBufferA,
    };
  }

  return { count, workgroups, makeBindGroups, runFrame };
}
