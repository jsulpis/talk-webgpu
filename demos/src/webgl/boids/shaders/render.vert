#version 300 es
precision highp float;

in vec4 aVertexPosition;
in vec3 aVertexNormal;
in vec2 aCoords;
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
uniform vec3 uLightDirection;
uniform vec3 uLightColor;
uniform vec3 uAmbientColor;
uniform float uScale;
uniform sampler2D tPositions;
uniform sampler2D tVelocities;
uniform sampler2D tColors;
out vec4 vColor;
out vec3 vNormal;
out vec3 vLightDirection;

void main(void) {
  vec3 modelPosition = texture(tPositions, aCoords).xyz;

  // Construct a rotation matrix that aligns the object's forward axis with the velocity direction
  vec3 velocity = texture(tVelocities, aCoords).xyz;
  vec3 forward = normalize(velocity);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
  vec3 up = cross(forward, right);

  mat4 rotationMatrix = mat4(
    right.x, right.y, right.z, 0.0,
    up.x, up.y, up.z, 0.0,
    forward.x, forward.y, forward.z, 0.0,
    0.0, 0.0, 0.0, 1.0
  );
  mat4 scaleMatrix = mat4(
    uScale, 0.0, 0.0, 0.0,
    0.0, uScale, 0.0, 0.0,
    0.0, 0.0, uScale, 0.0,
    0.0, 0.0, 0.0, 1.0
  );
  mat4 translateMatrix = mat4(
    1.0, 0.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 0.0,
    0.0, 0.0, 1.0, 0.0,
    modelPosition.x, modelPosition.y, modelPosition.z, 1.0
  );
  mat4 modelMatrix = translateMatrix * rotationMatrix * scaleMatrix;
  mat4 modelViewMatrix = uViewMatrix * modelMatrix;

  gl_Position = uProjectionMatrix * modelViewMatrix * aVertexPosition;
  vNormal = mat3(modelViewMatrix) * aVertexNormal;
  vLightDirection = (uViewMatrix * vec4(uLightDirection, 0.0)).xyz;

  vec4 color = texture(tColors, aCoords).rgba;
  vec3 vertexNormal = (modelViewMatrix * vec4(aVertexNormal, 0.0)).xyz;
  vec3 lightDirection = (uViewMatrix * vec4(uLightDirection, 0.0)).xyz;
  vec3 diffuse = uLightColor * max(dot(vertexNormal, lightDirection), 0.0);
  vec3 ambient = uAmbientColor;

  vColor = vec4((diffuse + ambient) * color.rgb, color.a);
}
