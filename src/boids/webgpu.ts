const computeShaderSource = `
@group(0) @binding(0) var<storage, read> inputPositions: array<vec3f>;
@group(0) @binding(1) var<storage, read> inputVelocities: array<vec3f>;
@group(0) @binding(2) var<storage, read_write> outputPositions: array<vec3f>;
@group(0) @binding(3) var<storage, read_write> outputVelocities: array<vec3f>;

struct Uniforms {
  deltaTime: f32,
  separationDistance: f32,
  alignmentDistance: f32,
  cohesionDistance: f32,
  borderForce: f32,
  borderDistance: f32,
  speedLimit: f32,
}
@group(0) @binding(4) var<uniform> uniforms: Uniforms;

const BOUNDS = 100.0;

fn normalize(vec: vec3f) -> vec3f {
  let length = sqrt(dot(vec, vec));
  return vec / length;
}

fn length(vec: vec3f) -> f32 {
  return sqrt(dot(vec, vec));
}

@compute @workgroup_size(64)
fn computeBoids(@builtin(global_invocation_id) id: vec3u) {
  let index = id.x;
  if (index >= arrayLength(&inputPositions)) {
    return;
  }

  let selfPosition = inputPositions[index];
  let selfVelocity = inputVelocities[index];
  var velocity = selfVelocity;

  let zoneRadius = uniforms.separationDistance + uniforms.alignmentDistance + uniforms.cohesionDistance;
  let separationThresh = uniforms.separationDistance / zoneRadius;
  let alignmentThresh = (uniforms.separationDistance + uniforms.alignmentDistance) / zoneRadius;
  let zoneRadiusSquared = zoneRadius * zoneRadius;

  // Compute forces from other boids
  for (var i = 0u; i < arrayLength(&inputPositions); i++) {
    if (i == index) {
      continue;
    }

    let birdPosition = inputPositions[i];
    let dir = birdPosition - selfPosition;
    let dist = length(dir);

    if (dist < 0.0001) {
      continue;
    }

    let distSquared = dist * dist;
    if (distSquared > zoneRadiusSquared) {
      continue;
    }

    let percent = distSquared / zoneRadiusSquared;

    if (percent < separationThresh) {
      let f = (separationThresh / percent - 1.0) * uniforms.deltaTime;
      velocity = velocity - normalize(dir) * f;
    } else if (percent < alignmentThresh) {
      let threshDelta = alignmentThresh - separationThresh;
      let adjustedPercent = (percent - separationThresh) / threshDelta;
      let birdVelocity = inputVelocities[i];
      let f = (0.5 - cos(adjustedPercent * 2.0 * 3.14159) * 0.5 + 0.5) * uniforms.deltaTime;
      velocity = velocity + normalize(birdVelocity) * f;
    } else {
      let threshDelta = 1.0 - alignmentThresh;
      var adjustedPercent: f32;
      if (threshDelta == 0.0) {
        adjustedPercent = 1.0;
      } else {
        adjustedPercent = (percent - alignmentThresh) / threshDelta;
      }
      let f = (0.5 - (cos(adjustedPercent * 2.0 * 3.14159) * -0.5 + 0.5)) * uniforms.deltaTime;
      velocity = velocity + normalize(dir) * f;
    }
  }

  // Border forces
  let distToBorderX = BOUNDS - abs(selfPosition.x);
  let distToBorderY = BOUNDS / 2.0 - abs(selfPosition.y);
  let distToBorderZ = BOUNDS / 2.0 - abs(selfPosition.z);
  var force = vec3f(0.0);

  if (distToBorderX < uniforms.borderDistance) {
    force.x = ((uniforms.borderDistance - distToBorderX) / uniforms.borderDistance) * -sign(selfPosition.x);
  }
  if (distToBorderY < uniforms.borderDistance) {
    force.y = ((uniforms.borderDistance - distToBorderY) / uniforms.borderDistance) * -sign(selfPosition.y);
  }
  if (distToBorderZ < uniforms.borderDistance) {
    force.z = ((uniforms.borderDistance - distToBorderZ) / uniforms.borderDistance) * -sign(selfPosition.z);
  }

  velocity = velocity + force * uniforms.borderForce * uniforms.deltaTime;

  // Speed limit
  let speed = length(velocity);
  if (speed > uniforms.speedLimit) {
    velocity = normalize(velocity) * uniforms.speedLimit;
  }

  // Update position
  let position = selfPosition + velocity * uniforms.deltaTime;

  outputPositions[index] = position;
  outputVelocities[index] = velocity;
}
`;

export function useBoidsGPU(
  device: GPUDevice,
  initialPositions: Float32Array,
  initialVelocities: Float32Array,
  FISHES: number,
  BOUNDS: number
) {
  // Create compute pipeline
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

  // Create aligned buffers
  // Pour vec3f, WebGPU nécessite un alignement sur 16 octets (4 float par élément)
  const positionsSize = FISHES * 4 * Float32Array.BYTES_PER_ELEMENT; // 4 floats per position (xyz + padding)
  const velocitiesSize = FISHES * 4 * Float32Array.BYTES_PER_ELEMENT; // 4 floats per velocity (xyz + padding)

  // Convertir les tableaux d'entrée au format aligné (x,y,z,0, x,y,z,0, ...)
  const alignedPositions = new Float32Array(FISHES * 4);
  const alignedVelocities = new Float32Array(FISHES * 4);

  for (let i = 0; i < FISHES; i++) {
    // Copier chaque position vec3 avec padding
    alignedPositions[i * 4] = initialPositions[i * 3]; // x
    alignedPositions[i * 4 + 1] = initialPositions[i * 3 + 1]; // y
    alignedPositions[i * 4 + 2] = initialPositions[i * 3 + 2]; // z
    alignedPositions[i * 4 + 3] = 0; // padding

    // Copier chaque vitesse vec3 avec padding
    alignedVelocities[i * 4] = initialVelocities[i * 3]; // x
    alignedVelocities[i * 4 + 1] = initialVelocities[i * 3 + 1]; // y
    alignedVelocities[i * 4 + 2] = initialVelocities[i * 3 + 2]; // z
    alignedVelocities[i * 4 + 3] = 0; // padding
  }

  // Create buffers for compute shader
  const computeUniformBufferSize = 32; // Size for uniforms
  const computeUniformBuffer = device.createBuffer({
    size: computeUniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    label: "Compute Uniform Buffer",
  });

  // Create GPUBuffers for positions and velocities with proper alignment
  const positionsBufferA = device.createBuffer({
    size: positionsSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    label: "Positions Buffer A",
  });
  device.queue.writeBuffer(positionsBufferA, 0, alignedPositions);

  const positionsBufferB = device.createBuffer({
    size: positionsSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    label: "Positions Buffer B",
  });
  device.queue.writeBuffer(positionsBufferB, 0, alignedPositions);

  const velocityBufferA = device.createBuffer({
    size: velocitiesSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    label: "Velocity Buffer A",
  });
  device.queue.writeBuffer(velocityBufferA, 0, alignedVelocities);

  const velocityBufferB = device.createBuffer({
    size: velocitiesSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
    label: "Velocity Buffer B",
  });
  device.queue.writeBuffer(velocityBufferB, 0, alignedVelocities);

  // Create compute bind groups
  const computeBindGroupA = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: positionsBufferA } },
      { binding: 1, resource: { buffer: velocityBufferA } },
      { binding: 2, resource: { buffer: positionsBufferB } },
      { binding: 3, resource: { buffer: velocityBufferB } },
      { binding: 4, resource: { buffer: computeUniformBuffer } },
    ],
    label: "Compute Bind Group A",
  });

  const computeBindGroupB = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: positionsBufferB } },
      { binding: 1, resource: { buffer: velocityBufferB } },
      { binding: 2, resource: { buffer: positionsBufferA } },
      { binding: 3, resource: { buffer: velocityBufferA } },
      { binding: 4, resource: { buffer: computeUniformBuffer } },
    ],
    label: "Compute Bind Group B",
  });

  // Create staging buffer for reading results
  const positionsStagingBuffer = device.createBuffer({
    size: positionsSize,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    label: "Positions Staging Buffer",
  });

  let direction: "AtoB" | "BtoA" = "AtoB";

  async function compute({
    deltaTime,
    separation,
    alignment,
    cohesion,
    currentTime,
    borderForce,
    borderDistance,
    bounds,
  }: {
    deltaTime: number;
    separation: number;
    alignment: number;
    cohesion: number;
    currentTime: number;
    borderForce: number;
    borderDistance: number;
    bounds: number;
  }) {
    // Update compute uniforms
    const computeUniformData = new Float32Array(computeUniformBufferSize / 4);
    computeUniformData[0] = deltaTime;
    computeUniformData[1] = separation;
    computeUniformData[2] = alignment;
    computeUniformData[3] = cohesion;
    computeUniformData[4] = borderForce;
    computeUniformData[5] = borderDistance;
    computeUniformData[6] = 9.0; // SPEED_LIMIT
    computeUniformData[7] = 0; // Padding

    // Write compute uniforms
    device.queue.writeBuffer(computeUniformBuffer, 0, computeUniformData);

    // Create compute command encoder
    const computeEncoder = device.createCommandEncoder({
      label: "Compute Command Encoder",
    });
    const computePass = computeEncoder.beginComputePass();

    // Set pipeline and bind group
    computePass.setPipeline(computePipeline);
    computePass.setBindGroup(0, direction === "AtoB" ? computeBindGroupA : computeBindGroupB);

    // Dispatch compute work
    computePass.dispatchWorkgroups(Math.ceil(FISHES / 64));

    computePass.end();

    // Copy results to staging buffer
    const positionResultBuffer = direction === "AtoB" ? positionsBufferB : positionsBufferA;

    computeEncoder.copyBufferToBuffer(positionResultBuffer, 0, positionsStagingBuffer, 0, positionsStagingBuffer.size);

    // Submit compute commands and wait for completion
    device.queue.submit([computeEncoder.finish()]);
    await device.queue.onSubmittedWorkDone();

    // Map staging buffer
    await positionsStagingBuffer.mapAsync(GPUMapMode.READ);

    // Create a copy of the data before unmapping
    const alignedPositionsArray = new Float32Array(positionsStagingBuffer.getMappedRange().slice(0));

    // Convert back to vec3 format for the return value
    const positionsArray = new Float32Array(FISHES * 3);
    for (let i = 0; i < FISHES; i++) {
      positionsArray[i * 3] = alignedPositionsArray[i * 4]; // x
      positionsArray[i * 3 + 1] = alignedPositionsArray[i * 4 + 1]; // y
      positionsArray[i * 3 + 2] = alignedPositionsArray[i * 4 + 2]; // z
    }

    // Now we can safely unmap
    positionsStagingBuffer.unmap();

    // Swap direction for next frame
    direction = direction === "AtoB" ? "BtoA" : "AtoB";

    return {
      positions: positionsArray,
    };
  }

  return {
    compute,
  };
}
