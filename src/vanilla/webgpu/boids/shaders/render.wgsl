struct Uniforms {
  projectionMatrix: mat4x4f,
  viewMatrix: mat4x4f,
  lightDirection: vec3f,
  lightColor: vec3f,
  ambientColor: vec3f,
  scale: f32,
}

@binding(0) @group(0) var<uniform> uniforms: Uniforms;
@binding(1) @group(0) var<storage, read> positions: array<vec3f>;
@binding(2) @group(0) var<storage, read> velocities: array<vec3f>;
@binding(3) @group(0) var<storage, read> colors: array<vec4f>;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

@vertex
fn vertexMain(
  @location(0) position: vec4f,
  @location(1) normal: vec3f,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
  var output: VertexOutput;
  let modelPosition = vec4f(positions[instanceIndex], 1.0);
  let scale = uniforms.scale;

  // Construct a rotation matrix that aligns the object's forward axis with the velocity direction
  let velocity = velocities[instanceIndex];
  let forward = normalize(velocity);
  let right = normalize(cross(vec3f(0.0, 1.0, 0.0), forward));
  let up = cross(forward, right);

  let rotationMatrix = mat4x4f(
    right.x, right.y, right.z, 0.0,
    up.x, up.y, up.z, 0.0,
    forward.x, forward.y, forward.z, 0.0,
    0.0, 0.0, 0.0, 1.0
  );
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
  let modelMatrix = translateMatrix * rotationMatrix * scaleMatrix;
  let modelViewMatrix = uniforms.viewMatrix * modelMatrix;

  output.position = uniforms.projectionMatrix * modelViewMatrix * position;

  let color = colors[instanceIndex];
  let vertexNormal = (modelViewMatrix * vec4f(normal, 0.0)).xyz;
  let lightDirection = (uniforms.viewMatrix * vec4f(uniforms.lightDirection, 0.0)).xyz;
  let diffuse = uniforms.lightColor * max(dot(vertexNormal, lightDirection), 0.0);
  let ambient = uniforms.ambientColor;
  output.color = vec4f((diffuse + ambient) * color.rgb, color.a);

  return output;
}

@fragment
fn fragmentMain(@location(0) color: vec4f) -> @location(0) vec4f {
  return color;
}
