const SPEED_LIMIT = 4.0;

function normalize(vec: [number, number, number]): [number, number, number] {
  const length = Math.sqrt(vec[0] * vec[0] + vec[1] * vec[1] + vec[2] * vec[2]);
  return [vec[0] / length, vec[1] / length, vec[2] / length];
}

function length(vec: [number, number, number]): number {
  return Math.sqrt(vec[0] * vec[0] + vec[1] * vec[1] + vec[2] * vec[2]);
}

function subtract(vec1: [number, number, number], vec2: [number, number, number]): [number, number, number] {
  return [vec1[0] - vec2[0], vec1[1] - vec2[1], vec1[2] - vec2[2]];
}

function add(vec1: [number, number, number], vec2: [number, number, number]): [number, number, number] {
  return [vec1[0] + vec2[0], vec1[1] + vec2[1], vec1[2] + vec2[2]];
}

function scale(vec: [number, number, number], scalar: number): [number, number, number] {
  return [vec[0] * scalar, vec[1] * scalar, vec[2] * scalar];
}

function dot(vec1: [number, number, number], vec2: [number, number, number]): number {
  return vec1[0] * vec2[0] + vec1[1] * vec2[1] + vec1[2] * vec2[2];
}

export function computePositions(
  input: Float32Array,
  output: Float32Array,
  velocities: Float32Array,
  deltaTime: number
) {
  for (let i = 0; i < input.length; i += 3) {
    output[i + 0] = input[i + 0] + velocities[i + 0] * deltaTime;
    output[i + 1] = input[i + 1] + velocities[i + 1] * deltaTime;
    output[i + 2] = input[i + 2] + velocities[i + 2] * deltaTime;
  }
}

export function computeVelocities(
  input: Float32Array,
  output: Float32Array,
  positions: Float32Array,
  deltaTime: number,
  separationDistance: number,
  alignmentDistance: number,
  cohesionDistance: number
) {
  const numBoids = input.length / 3;

  for (let i = 0; i < numBoids; i++) {
    const selfPosition: [number, number, number] = [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
    const selfVelocity: [number, number, number] = [input[i * 3], input[i * 3 + 1], input[i * 3 + 2]];
    let velocity: [number, number, number] = selfVelocity;

    let alignment: [number, number, number] = [0, 0, 0];
    let alignmentCount = 0;
    let cohesionCount = 0;

    let acceleration: [number, number, number] = [0, 0, 0];
    let centerOfMass: [number, number, number] = [0, 0, 0];

    const separationWeight = 1.5;
    const alignmentWeight = 1.0;
    const cohesionWeight = 1.0;

    for (let j = 0; j < numBoids; j++) {
      if (i === j) continue;

      const otherPosition: [number, number, number] = [positions[j * 3], positions[j * 3 + 1], positions[j * 3 + 2]];
      const otherVelocity: [number, number, number] = [input[j * 3], input[j * 3 + 1], input[j * 3 + 2]];

      const diff = subtract(selfPosition, otherPosition);
      const distance = length(diff);

      const isInFieldOfView = dot(normalize(selfVelocity), normalize(subtract(otherPosition, selfPosition))) > 0.5;

      if (isInFieldOfView) {
        // Alignment - align with the direction of other boids
        if (distance < alignmentDistance) {
          alignment = add(alignment, otherVelocity);
          alignmentCount++;
        }

        // Cohesion - move towards the center of nearby boids
        if (distance < cohesionDistance) {
          centerOfMass = add(centerOfMass, otherPosition);
          cohesionCount++;
        }
      }

      // Separation - avoid collisions with nearby boids
      if (distance > 0 && distance < separationDistance) {
        const repulsionForce = scale(normalize(diff), (separationDistance / distance - 1.0) * separationWeight);
        acceleration = add(acceleration, repulsionForce);
      }
    }

    // Alignment force
    if (alignmentCount > 0) {
      const averageVelocity = scale(alignment, 1 / alignmentCount);
      const alignmentForce = subtract(averageVelocity, selfVelocity);
      acceleration = add(acceleration, scale(alignmentForce, alignmentWeight));
    }

    // Cohesion force
    if (cohesionCount > 0) {
      const averagePosition = scale(centerOfMass, 1 / cohesionCount);
      const cohesionForce = subtract(averagePosition, selfPosition);
      acceleration = add(acceleration, scale(normalize(cohesionForce), cohesionWeight));
    }

    // add a force towards the center of the scene that increases with the distance to origin
    const distToCenter = length(selfPosition);
    acceleration = add(acceleration, scale(selfPosition, -distToCenter * 0.0003));

    velocity = add(velocity, scale(acceleration, deltaTime));

    const speed = length(velocity);
    if (speed > SPEED_LIMIT) {
      velocity = scale(normalize(velocity), SPEED_LIMIT);
    }

    output[i * 3] = velocity[0];
    output[i * 3 + 1] = velocity[1];
    output[i * 3 + 2] = velocity[2];
  }
}
