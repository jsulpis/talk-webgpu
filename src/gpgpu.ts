export const BOUNDS = 100;

const SPEED_LIMIT = 9.0;

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
  cohesionDistance: number,
  time: number,
  borderForce: number,
  borderDistance: number
) {
  const width = Math.sqrt(positions.length / 3);
  const height = width;

  const zoneRadius = separationDistance + alignmentDistance + cohesionDistance;
  const separationThresh = separationDistance / zoneRadius;
  const alignmentThresh = (separationDistance + alignmentDistance) / zoneRadius;
  const zoneRadiusSquared = zoneRadius * zoneRadius;

  for (let i = 0; i < input.length; i += 3) {
    const selfPosition: [number, number, number] = [positions[i], positions[i + 1], positions[i + 2]];
    const selfVelocity: [number, number, number] = [input[i], input[i + 1], input[i + 2]];
    let velocity: [number, number, number] = selfVelocity;

    const central: [number, number, number] = [0, 0, 0];
    let dir: [number, number, number] = subtract(selfPosition, central);
    const distToCenter = length(dir);
    dir[1] *= 2.5;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const ref = [(x + 0.5) / width, (y + 0.5) / height];
        const birdPosition: [number, number, number] = [
          positions[(y * width + x) * 3],
          positions[(y * width + x) * 3 + 1],
          positions[(y * width + x) * 3 + 2],
        ];

        dir = subtract(birdPosition, selfPosition);
        const dist = length(dir);

        if (dist < 0.0001) continue;

        const distSquared = dist * dist;

        if (distSquared > zoneRadiusSquared) continue;

        const percent = distSquared / zoneRadiusSquared;

        if (percent < separationThresh) {
          const f = (separationThresh / percent - 1.0) * deltaTime;
          velocity = subtract(velocity, scale(normalize(dir), f));
        } else if (percent < alignmentThresh) {
          const threshDelta = alignmentThresh - separationThresh;
          const adjustedPercent = (percent - separationThresh) / threshDelta;

          const birdVelocity: [number, number, number] = [
            input[(y * width + x) * 3],
            input[(y * width + x) * 3 + 1],
            input[(y * width + x) * 3 + 2],
          ];

          const f = (0.5 - Math.cos(adjustedPercent * 2 * Math.PI) * 0.5 + 0.5) * deltaTime;
          velocity = add(velocity, scale(normalize(birdVelocity), f));
        } else {
          const threshDelta = 1.0 - alignmentThresh;
          const adjustedPercent = threshDelta === 0 ? 1 : (percent - alignmentThresh) / threshDelta;

          const f = (0.5 - (Math.cos(adjustedPercent * 2 * Math.PI) * -0.5 + 0.5)) * deltaTime;
          velocity = add(velocity, scale(normalize(dir), f));
        }
      }
    }

    const distToBorderX = BOUNDS - Math.abs(selfPosition[0]);
    const distToBorderY = BOUNDS / 2 - Math.abs(selfPosition[1]);
    const distToBorderZ = BOUNDS / 2 - Math.abs(selfPosition[2]);
    let forceX = 0;
    let forceY = 0;
    let forceZ = 0;

    if (distToBorderX < borderDistance) {
      forceX = ((borderDistance - distToBorderX) / borderDistance) * -Math.sign(selfPosition[0]);
    }
    if (distToBorderY < borderDistance) {
      forceY = ((borderDistance - distToBorderY) / borderDistance) * -Math.sign(selfPosition[1]);
    }
    if (distToBorderZ < borderDistance) {
      forceZ = ((borderDistance - distToBorderZ) / borderDistance) * -Math.sign(selfPosition[2]);
    }

    velocity = add(velocity, scale([forceX, forceY, forceZ], borderForce * deltaTime));

    if (length(velocity) > SPEED_LIMIT) {
      velocity = scale(normalize(velocity), SPEED_LIMIT);
    }
    const rotationAngle = 0.02 * Math.sin(time / 100 + (i / input.length) * 2 * Math.PI);

    const cosTheta = Math.cos(rotationAngle);
    const sinTheta = Math.sin(rotationAngle);
    const rotationMatrix = [
      [cosTheta, 0, sinTheta],
      [0, 1, 0],
      [-sinTheta, 0, cosTheta],
    ];

    const rotatedVelocity = [
      rotationMatrix[0][0] * velocity[0] + rotationMatrix[0][1] * velocity[1] + rotationMatrix[0][2] * velocity[2],
      rotationMatrix[1][0] * velocity[0] + rotationMatrix[1][1] * velocity[1] + rotationMatrix[1][2] * velocity[2],
      rotationMatrix[2][0] * velocity[0] + rotationMatrix[2][1] * velocity[1] + rotationMatrix[2][2] * velocity[2],
    ];
    output[i] = rotatedVelocity[0];
    output[i + 1] = rotatedVelocity[1];
    output[i + 2] = rotatedVelocity[2];
  }
}
