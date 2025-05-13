import vsSource from "./render.vert?raw";
import fsSource from "./render.frag?raw";
import { createStaticBuffer, initProgram } from "../utils";
import { createSphereGeometry } from "../../models/sphere";

export function setupNaive(
  gl: WebGL2RenderingContext,
  maxCount: number,
  positions: Float32Array,
  colors: Float32Array,
  scales: Float32Array
) {
  const shaderProgram = initProgram(gl, vsSource, fsSource);
  if (!shaderProgram) {
    throw new Error("Failed to initialize shader program");
  }

  const programInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition"),
      vertexNormal: gl.getAttribLocation(shaderProgram, "aVertexNormal"),
      coords: gl.getAttribLocation(shaderProgram, "aCoords"),
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(shaderProgram, "uProjectionMatrix"),
      viewMatrix: gl.getUniformLocation(shaderProgram, "uViewMatrix"),
      lightDirection: gl.getUniformLocation(shaderProgram, "uLightDirection"),
      lightColor: gl.getUniformLocation(shaderProgram, "uLightColor"),
      ambientColor: gl.getUniformLocation(shaderProgram, "uAmbientColor"),
      position: gl.getUniformLocation(shaderProgram, "uPosition"),
      color: gl.getUniformLocation(shaderProgram, "uColor"),
      scale: gl.getUniformLocation(shaderProgram, "uScale"),
    },
  };

  const geometry = createSphereGeometry(1, 9, 18);

  const positionBuffer = createStaticBuffer(gl, geometry.positions);
  const normalBuffer = createStaticBuffer(gl, geometry.normals);
  const indexBuffer = createStaticBuffer(gl, geometry.indices, gl.ELEMENT_ARRAY_BUFFER);

  const objectsData = Array.from({ length: maxCount }).map((_, i) => ({
    position: positions.slice(i * 4, i * 4 + 4),
    color: colors.slice(i * 4, i * 4 + 4),
    scale: scales[i],
  }));

  function drawNaive(objectsCount: number, renderUniforms: typeof import("../../shared/params").renderUniforms) {
    for (let i = 0; i < objectsCount; i++) {
      const objectData = objectsData[i];

      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

      gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
      gl.vertexAttribPointer(programInfo.attribLocations.vertexNormal, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(programInfo.attribLocations.vertexNormal);

      gl.useProgram(programInfo.program);

      gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, renderUniforms.projectionMatrix);
      gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, renderUniforms.viewMatrix);
      gl.uniform3fv(programInfo.uniformLocations.lightDirection, renderUniforms.lightDirection);
      gl.uniform3fv(programInfo.uniformLocations.lightColor, renderUniforms.lightColor);
      gl.uniform3fv(programInfo.uniformLocations.ambientColor, renderUniforms.ambientColor);
      gl.uniform4fv(programInfo.uniformLocations.position, objectData.position);
      gl.uniform4fv(programInfo.uniformLocations.color, objectData.color);
      gl.uniform1f(programInfo.uniformLocations.scale, objectData.scale);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.drawElements(gl.TRIANGLES, geometry.indices.length, gl.UNSIGNED_SHORT, 0);
    }
  }

  return { drawNaive };
}
