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


    let diff = position - otherPosition;
    let distance = length(diff);

    let sameColor = all(abs(color - otherColor) < vec3f(0.01));
    let isInFieldOfView = dot(normalize(velocity), normalize(otherPosition - position)) > 0.;

    if (sameColor && isInFieldOfView) {
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

  // Keep boids within bounds
  let distToCenter = length(position);
  if (distToCenter > uniforms.bounds) {
    acceleration -= position * distToCenter * 0.00003;
  }

  velocity += acceleration * uniforms.deltaTime;

  let speed = length(velocity);
  velocity = velocity * (min(4., max(1., speed)) / speed);

  position += velocity * uniforms.deltaTime;

  outputPositions[index] = position;
  outputVelocities[index] = velocity;
}
