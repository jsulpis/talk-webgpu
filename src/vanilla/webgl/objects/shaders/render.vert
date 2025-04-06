#version 300 es
precision highp float;

in vec4 aVertexPosition;
in vec3 aVertexNormal;
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform vec3 uLightDirection;
uniform vec3 uLightColor;
uniform vec3 uAmbientColor;
uniform vec4 uPosition;
uniform vec4 uColor;
uniform float uScale;
out vec4 vColor;
out vec3 vNormal;
out vec3 vLightDirection;

void main(void) {
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
    uPosition.x, uPosition.y, uPosition.z, 1.0
  );
  mat4 modelMatrix = translateMatrix * scaleMatrix;
  mat4 modelViewMatrix = uViewMatrix * modelMatrix;

  vec4 clipPos = uProjectionMatrix * modelViewMatrix * aVertexPosition;
  gl_Position = clipPos;
  vNormal = mat3(modelViewMatrix) * aVertexNormal;
  vLightDirection = (uViewMatrix * vec4(uLightDirection, 0.0)).xyz;

  vec3 vertexNormal = (modelViewMatrix * vec4(aVertexNormal, 0.0)).xyz;
  vec3 lightDirection = (uViewMatrix * vec4(uLightDirection, 0.0)).xyz;
  vec3 diffuse = uLightColor * max(dot(vertexNormal, lightDirection), 0.0);
  vec3 ambient = uAmbientColor;

  vColor = vec4((diffuse + ambient) * uColor.rgb, uColor.a);
}
