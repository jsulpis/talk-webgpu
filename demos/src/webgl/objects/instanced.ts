import vsSource from "./render.vert?raw";
import fsSource from "./render.frag?raw";
import { createStaticBuffer, initProgram } from "../utils";
import { createSphereGeometry } from "../../models/sphere";

export function setupInstanced(
  gl: WebGL2RenderingContext,
  maxCount: number,
  positions: Float32Array,
  colors: Float32Array,
  scales: Float32Array
) {
  const instancedVsSource = vsSource
    .replaceAll("uniform vec4 uPosition", "in vec4 aInstancePosition")
    .replaceAll("uniform vec4 uColor", "in vec4 aInstanceColor")
    .replaceAll("uniform float uScale", "in float aInstanceScale")
    .replaceAll("uPosition", "aInstancePosition")
    .replaceAll("uColor", "aInstanceColor")
    .replaceAll("uScale", "aInstanceScale");

  const shaderProgram = initProgram(gl, instancedVsSource, fsSource);
  if (!shaderProgram) {
    throw new Error("Failed to initialize shader program");
  }

  const programInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition"),
      vertexNormal: gl.getAttribLocation(shaderProgram, "aVertexNormal"),
      coords: gl.getAttribLocation(shaderProgram, "aCoords"),
      instancePosition: gl.getAttribLocation(shaderProgram, "aInstancePosition"),
      instanceColor: gl.getAttribLocation(shaderProgram, "aInstanceColor"),
      instanceScale: gl.getAttribLocation(shaderProgram, "aInstanceScale"),
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(shaderProgram, "uProjectionMatrix"),
      viewMatrix: gl.getUniformLocation(shaderProgram, "uViewMatrix"),
      lightDirection: gl.getUniformLocation(shaderProgram, "uLightDirection"),
      lightColor: gl.getUniformLocation(shaderProgram, "uLightColor"),
      ambientColor: gl.getUniformLocation(shaderProgram, "uAmbientColor"),
    },
  };

  const geometry = createSphereGeometry(1, 9, 18);

  const positionBuffer = createStaticBuffer(gl, geometry.positions);
  const normalBuffer = createStaticBuffer(gl, geometry.normals);
  const indexBuffer = createStaticBuffer(gl, geometry.indices, gl.ELEMENT_ARRAY_BUFFER);

  const instancePositions = new Float32Array(maxCount * 4);
  const instanceColors = new Float32Array(maxCount * 4);

  for (let i = 0; i < maxCount; i++) {
    instancePositions.set(positions.slice(i * 4, i * 4 + 4), i * 4);
    instanceColors.set(colors.slice(i * 4, i * 4 + 4), i * 4);
  }

  const instancePositionBuffer = createStaticBuffer(gl, instancePositions);
  const instanceColorBuffer = createStaticBuffer(gl, instanceColors);
  const instanceScaleBuffer = createStaticBuffer(gl, scales);

  function drawInstanced(objectsCount: number, renderUniforms: typeof import("../../shared/params").renderUniforms) {
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.vertexAttribPointer(programInfo.attribLocations.vertexNormal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexNormal);

    gl.bindBuffer(gl.ARRAY_BUFFER, instancePositionBuffer);
    gl.vertexAttribPointer(programInfo.attribLocations.instancePosition, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(programInfo.attribLocations.instancePosition, 1);
    gl.enableVertexAttribArray(programInfo.attribLocations.instancePosition);

    gl.bindBuffer(gl.ARRAY_BUFFER, instanceColorBuffer);
    gl.vertexAttribPointer(programInfo.attribLocations.instanceColor, 4, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(programInfo.attribLocations.instanceColor, 1);
    gl.enableVertexAttribArray(programInfo.attribLocations.instanceColor);

    gl.bindBuffer(gl.ARRAY_BUFFER, instanceScaleBuffer);
    gl.vertexAttribPointer(programInfo.attribLocations.instanceScale, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(programInfo.attribLocations.instanceScale, 1);
    gl.enableVertexAttribArray(programInfo.attribLocations.instanceScale);

    gl.useProgram(programInfo.program);

    gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, renderUniforms.projectionMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, renderUniforms.viewMatrix);
    gl.uniform3fv(programInfo.uniformLocations.lightDirection, renderUniforms.lightDirection);
    gl.uniform3fv(programInfo.uniformLocations.lightColor, renderUniforms.lightColor);
    gl.uniform3fv(programInfo.uniformLocations.ambientColor, renderUniforms.ambientColor);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.drawElementsInstanced(gl.TRIANGLES, geometry.indices.length, gl.UNSIGNED_SHORT, 0, objectsCount);
  }

  return { drawInstanced };
}
