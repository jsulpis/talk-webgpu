#version 300 es
precision highp float;

uniform sampler2D positions;
uniform sampler2D velocities;
uniform sampler2D colors;
uniform float deltaTime;
uniform float separationDistance;
uniform float alignmentDistance;
uniform float cohesionDistance;
uniform float borderForce;
uniform float borderDistance;
uniform float bounds;
uniform vec2 resolution;

in vec2 vUv;
out vec4 fragColor;

void main() {
   vec3 position = texture(positions, vUv).xyz;
   vec3 velocity = texture(velocities, vUv).xyz;
   vec3 color = texture(colors, vUv).xyz;
   float initialSpeed = length(velocity);

  // Forces for boids rules
   vec3 alignment = vec3(0.0);
   vec3 cohesion = vec3(0.0);
   float alignmentCount = 0.0;
   float cohesionCount = 0.0;

   vec3 acceleration = vec3(0.0);
   vec3 centerOfMass = vec3(0.0);

   float separationWeight = 1.5;
   float alignmentWeight = 1.0;
   float cohesionWeight = 1.0;

  // Iterate through all boids
   for (float y = 0.0; y < 1.0; y += 1.0 / resolution.y) {
      for (float x = 0.0; x < 1.0; x += 1.0 / resolution.x) {
        vec2 otherUv = vec2(x, y);

        // Skip self
        if (distance(otherUv, vUv) < 0.001)
          continue;

        vec3 otherPosition = texture(positions, otherUv).xyz;
        vec3 otherVelocity = texture(velocities, otherUv).xyz;
        vec3 otherColor = texture(colors, otherUv).xyz;

        bool sameColor = all(lessThan(abs(color - otherColor), vec3(0.01)));

        vec3 diff = position - otherPosition;
        float distance = length(diff);

        if (sameColor) {
          // Alignment - align with the direction of other boids
          if (distance < alignmentDistance) {
              alignment += otherVelocity;
              alignmentCount += 1.0;
          }

          // Cohesion - move towards the center of nearby boids
          if (distance < cohesionDistance) {
              centerOfMass += otherPosition;
              cohesionCount += 1.0;
          }
        }

        // Separation - avoid collisions with nearby boids
        if (distance > 0.0 && distance < separationDistance) {
          vec3 repulsionForce = normalize(diff) * (separationDistance / distance - 1.0);
          acceleration += repulsionForce * separationWeight;
        }
      }
   }

  // Alignment force
   if (alignmentCount > 0.0) {
      vec3 averageVelocity = alignment / alignmentCount;
      vec3 alignmentForce = averageVelocity - velocity;
      acceleration += alignmentForce * alignmentWeight;
   }

  // Cohesion force
   if (cohesionCount > 0.0) {
      vec3 averagePosition = centerOfMass / cohesionCount;
      vec3 cohesionForce = averagePosition - position;
      acceleration += normalize(cohesionForce) * cohesionWeight;
   }

  // Apply a force near the borders to keep boids within limits
   if (position.x < -bounds + borderDistance) {
      acceleration.x += borderForce;
   } else if (position.x > bounds - borderDistance) {
      acceleration.x -= borderForce;
   }

   if (position.y < -bounds + borderDistance) {
      acceleration.y += borderForce;
   } else if (position.y > bounds - borderDistance) {
      acceleration.y -= borderForce;
   }

   if (position.z < -bounds + borderDistance) {
      acceleration.z += borderForce;
   } else if (position.z > bounds - borderDistance) {
      acceleration.z -= borderForce;
   }

   velocity += acceleration * deltaTime;

  // Limit speed
   float speed = length(velocity);
   velocity = velocity * (min(4.0, max(1.0, speed)) / speed);

   fragColor = vec4(velocity, 1.0);
}
