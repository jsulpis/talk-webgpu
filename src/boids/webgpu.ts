const computeShaderSource = `
@group(0) @binding(0) var<storage, read> inputPositions: array<vec3f>;
@group(0) @binding(1) var<storage, read> inputVelocities: array<vec3f>;
@group(0) @binding(2) var<storage, read_write> outputPositions: array<vec3f>;
@group(0) @binding(3) var<storage, read_write> outputVelocities: array<vec3f>;
@group(0) @binding(4) var<storage, read> colors: array<vec3f>;
@group(0) @binding(5) var<uniform> uniforms: Uniforms;

struct Uniforms {
  deltaTime: f32,
  separationDistance: f32,
  alignmentDistance: f32,
  cohesionDistance: f32,
  borderForce: f32,
  borderDistance: f32,
  bounds: f32
}

@compute @workgroup_size(64)
fn computeBoids(@builtin(global_invocation_id) id: vec3u) {
  let index = id.x;
  if (index >= arrayLength(&inputPositions)) {
    return;
  }

  var position = inputPositions[index];
  var velocity = inputVelocities[index];
  let color = colors[index];
  let initialSpeed = length(velocity);

  // Forces for boids rules
  var alignment = vec3f(0.0);
  var cohesion = vec3f(0.0);
  var alignmentCount = 0u;
  var cohesionCount = 0u;

  var acceleration = vec3f(0.0);
  var centerOfMass = vec3f(0.0);

  let separationWeight = 1.5;
  let alignmentWeight = 1.0;
  let cohesionWeight = 1.0;

  // Iterate over all other boids
  for (var i = 0u; i < arrayLength(&inputPositions); i++) {
    if (i == index) {
      continue; // Ignore the boid itself
    }

    let otherPosition = inputPositions[i];
    let otherVelocity = inputVelocities[i];
    let otherColor = colors[i];

    let sameColor = all(abs(color - otherColor) < vec3f(0.01));

    let diff = position - otherPosition;
    let distance = length(diff);

    if (sameColor) {
      // Alignment - align with the direction of other boids
      if (distance < uniforms.alignmentDistance) {
        alignment += otherVelocity;
        alignmentCount++;
      }
      // Cohesion - move towards the center of nearby boids
      if (distance < uniforms.cohesionDistance) {
        centerOfMass += otherPosition;
        cohesionCount++;
      }
    }

    // Separation - avoid collisions with nearby boids
    if (distance > 0.0 && distance < uniforms.separationDistance) {
      let repulsionForce = normalize(diff) * (uniforms.separationDistance / distance - 1.0);
      acceleration += repulsionForce * separationWeight;
    }
  }

  // Alignment force
  if (alignmentCount > 0u) {
    let averageVelocity = alignment / f32(alignmentCount);
    let alignmentForce = averageVelocity - velocity;
    acceleration += alignmentForce * alignmentWeight;
  }

  // Cohesion force
  if (cohesionCount > 0u) {
    let averagePosition = centerOfMass / f32(cohesionCount);
    let cohesionForce = averagePosition - position;
    acceleration += normalize(cohesionForce) * cohesionWeight;
  }

  // Apply a force near the borders to keep boids within limits
  if (position.x < -uniforms.bounds + uniforms.borderDistance) {
    acceleration.x += uniforms.borderForce;
  } else if (position.x > uniforms.bounds - uniforms.borderDistance) {
    acceleration.x -= uniforms.borderForce;
  }

  if (position.y < -uniforms.bounds + uniforms.borderDistance) {
    acceleration.y += uniforms.borderForce;
  } else if (position.y > uniforms.bounds - uniforms.borderDistance) {
    acceleration.y -= uniforms.borderForce;
  }

  if (position.z < -uniforms.bounds + uniforms.borderDistance) {
    acceleration.z += uniforms.borderForce;
  } else if (position.z > uniforms.bounds - uniforms.borderDistance) {
    acceleration.z -= uniforms.borderForce;
  }

  velocity += acceleration * uniforms.deltaTime;

  let speed = length(velocity);
  velocity = velocity * (min(4., max(1., speed)) / speed);

  position += velocity * uniforms.deltaTime;

  outputPositions[index] = position;
  outputVelocities[index] = velocity;
}
`;

export function useBoidsGPU(
  device: GPUDevice,
  initialPositions: Float32Array,
  initialVelocities: Float32Array,
  colorsBuffer: GPUBuffer,
  COUNT: number
) {
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

  async function compute({
    deltaTime,
    separationDistance,
    alignmentDistance,
    cohesionDistance,
    borderForce,
    borderDistance,
    bounds,
  }: {
    deltaTime: number;
    separationDistance: number;
    alignmentDistance: number;
    cohesionDistance: number;
    borderForce: number;
    borderDistance: number;
    bounds: number;
  }) {
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

    const computePass = computeEncoder.beginComputePass();
    computePass.setPipeline(computePipeline);
    computePass.setBindGroup(0, direction === "AtoB" ? computeBindGroupA : computeBindGroupB);
    computePass.dispatchWorkgroups(Math.ceil(COUNT / 64));
    computePass.end();

    device.queue.submit([computeEncoder.finish()]);
    await device.queue.onSubmittedWorkDone();

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
