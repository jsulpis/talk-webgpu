#version 300 es
precision highp float;

in vec2 position;
out vec2 vUv;

void main() {
  vUv = 0.5f * (position + 1.0f);
  gl_Position = vec4(position, 0.0f, 1.0f);
}
