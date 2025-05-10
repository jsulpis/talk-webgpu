struct Uniforms {
  projectionMatrix: mat4x4f,
  viewMatrix: mat4x4f,
  lightDirection: vec3f,
  lightColor: vec3f,
  ambientColor: vec3f,
}

struct ModelUniforms {
  position: vec4f,
  color: vec4f,
  scale: f32,
}

@binding(0) @group(0) var<uniform> uniforms: Uniforms;
@binding(1) @group(0) var<uniform> modelUniforms: ModelUniforms;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

@vertex
fn vertexMain(@location(0) position: vec4f, @location(1) normal: vec3f) -> VertexOutput {
  var output: VertexOutput;
  let scale = modelUniforms.scale;
  let modelPosition = modelUniforms.position;
  let modelColor = modelUniforms.color;

   let scaleMatrix = mat4x4f(
    scale, 0.0, 0.0, 0.0,
    0.0, scale, 0.0, 0.0,
    0.0, 0.0, scale, 0.0,
    0.0, 0.0, 0.0, 1.0
  );
  let translateMatrix = mat4x4f(
    1.0, 0.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 0.0,
    0.0, 0.0, 1.0, 0.0,
    modelPosition.x, modelPosition.y, modelPosition.z, 1.0
  );
  let modelMatrix = translateMatrix * scaleMatrix;
  let modelViewMatrix = uniforms.viewMatrix * modelMatrix;

  output.position = uniforms.projectionMatrix * modelViewMatrix * position;

  let vertexNormal = (modelViewMatrix * vec4f(normal, 0.0)).xyz;
  let lightDirection = (uniforms.viewMatrix * vec4f(uniforms.lightDirection, 0.0)).xyz;
  let diffuse = uniforms.lightColor * max(dot(vertexNormal, lightDirection), 0.0);
  let ambient = uniforms.ambientColor;
  output.color = vec4f((diffuse + ambient) * modelColor.rgb, modelColor.a);

  return output;
}

@fragment
fn fragmentMain(@location(0) color: vec4f) -> @location(0) vec4f {
  return color;
}
