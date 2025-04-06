#version 300 es
precision highp float;

uniform sampler2D positions;
uniform sampler2D velocities;
uniform float deltaTime;

in vec2 vUv;
out vec4 fragColor;

void main() {
  vec3 position = texture(positions, vUv).xyz;
  vec3 velocity = texture(velocities, vUv).xyz;
  position += velocity * deltaTime;
  fragColor = vec4(position, 1.0f);
}
