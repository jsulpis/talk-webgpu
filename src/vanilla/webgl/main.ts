import { loadOBJ } from "../models/objLoader";
import { useBoidsWebGL } from "./gpgpu";
import {
  boidsUniforms,
  colors,
  computeElement,
  computeTime,
  COUNT,
  initialPositions,
  initialVelocities,
  jsElement,
  jsTime,
  renderElement,
  renderTime,
  renderUniforms,
  speed,
} from "../shared";
import { initProgram, createStaticBuffer } from "./utils";
import vsSource from "./shaders/render.vert?raw";
import fsSource from "./shaders/render.frag?raw";

document.getElementById("objects")!.innerText = COUNT.toString();
document.getElementById("api")!.innerText = "WebGL";

async function main() {
  const canvas = document.createElement("canvas");
  canvas.width = window.innerWidth * devicePixelRatio;
  canvas.height = window.innerHeight * devicePixelRatio;
  document.body.appendChild(canvas);

  const gl = canvas.getContext("webgl2")!;
  if (!gl) {
    console.error("Unable to initialize WebGL. Your browser or machine may not support it.");
    return;
  }

  const shaderProgram = initProgram(gl, vsSource, fsSource);
  if (!shaderProgram) {
    return;
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
      modelMatrix: gl.getUniformLocation(shaderProgram, "uModelMatrix"),
      lightDirection: gl.getUniformLocation(shaderProgram, "uLightDirection"),
      lightColor: gl.getUniformLocation(shaderProgram, "uLightColor"),
      ambientColor: gl.getUniformLocation(shaderProgram, "uAmbientColor"),
      scale: gl.getUniformLocation(shaderProgram, "uScale"),
      positions: gl.getUniformLocation(shaderProgram, "tPositions"),
      velocities: gl.getUniformLocation(shaderProgram, "tVelocities"),
      colors: gl.getUniformLocation(shaderProgram, "tColors"),
    },
  };

  // const geometry = createSphereGeometry();
  const geometry = await loadOBJ("fish.obj");

  const {
    compute: computeBoids,
    coords,
    colorTexture,
  } = useBoidsWebGL(gl, initialPositions, initialVelocities, colors, COUNT);

  const positionBuffer = createStaticBuffer(gl, geometry.positions);
  const normalBuffer = createStaticBuffer(gl, geometry.normals);
  const coordsBuffer = createStaticBuffer(gl, coords);
  const indexBuffer = createStaticBuffer(gl, geometry.indices, gl.ELEMENT_ARRAY_BUFFER);

  let lastTime = performance.now();

  const { isGPUTimeAvailable, updateGPUTime, getGPUTime, endGPUTime } = useGPUTimer(gl);

  function drawScene(positionsTexture: WebGLTexture, velocitiesTexture: WebGLTexture) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.vertexAttribPointer(programInfo.attribLocations.vertexNormal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexNormal);

    gl.bindBuffer(gl.ARRAY_BUFFER, coordsBuffer);
    gl.vertexAttribPointer(programInfo.attribLocations.coords, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.coords);
    gl.vertexAttribDivisor(programInfo.attribLocations.coords, 1);

    gl.useProgram(programInfo.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, positionsTexture);
    gl.uniform1i(programInfo.uniformLocations.positions, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, velocitiesTexture);
    gl.uniform1i(programInfo.uniformLocations.velocities, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, colorTexture);
    gl.uniform1i(programInfo.uniformLocations.colors, 2);

    gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, renderUniforms.projectionMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, renderUniforms.viewMatrix);
    gl.uniform3fv(programInfo.uniformLocations.lightDirection, renderUniforms.lightDirection);
    gl.uniform3fv(programInfo.uniformLocations.lightColor, renderUniforms.lightColor);
    gl.uniform3fv(programInfo.uniformLocations.ambientColor, renderUniforms.ambientColor);
    gl.uniform1f(programInfo.uniformLocations.scale, renderUniforms.scale);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.drawElementsInstanced(gl.TRIANGLES, geometry.indices.length, gl.UNSIGNED_SHORT, 0, COUNT);
  }

  function render() {
    if (!isGPUTimeAvailable()) {
      // still computing the previous frame, skip this frame
      requestAnimationFrame(render);
      return;
    }

    const currentTime = performance.now();
    boidsUniforms.deltaTime = (currentTime - lastTime) * speed;
    lastTime = currentTime;

    getGPUTime();
    const { positionsTexture, velocitiesTexture } = computeBoids(boidsUniforms);
    updateGPUTime();
    drawScene(positionsTexture, velocitiesTexture);
    endGPUTime();

    jsTime.addValue(performance.now() - lastTime);
    jsElement.textContent = jsTime.getAverage().toFixed(1) + "ms";

    requestAnimationFrame(render);
  }

  render();
}

window.onload = main;

function useGPUTimer(gl: WebGL2RenderingContext) {
  const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");
  const query = gl.createQuery();
  gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
  gl.endQuery(ext.TIME_ELAPSED_EXT);

  let measureTarget: "compute" | "render" = "render";

  function isGPUTimeAvailable() {
    return gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE);
  }

  function getGPUTime() {
    const measuredTime = gl.getQueryParameter(query, gl.QUERY_RESULT);

    if (measureTarget === "render") {
      renderTime.addValue(measuredTime / 1e6);
      renderElement.textContent = renderTime.getAverage().toFixed(1) + "ms";
      measureTarget = "compute";
      gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
    } else {
      computeTime.addValue(measuredTime / 1e6);
      computeElement.textContent = computeTime.getAverage().toFixed(1) + "ms";
      measureTarget = "render";
    }
  }

  function updateGPUTime() {
    if (measureTarget === "compute") {
      gl.endQuery(ext.TIME_ELAPSED_EXT);
    } else {
      gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
    }
  }

  function endGPUTime() {
    if (measureTarget === "render") {
      gl.endQuery(ext.TIME_ELAPSED_EXT);
    }
  }

  return {
    isGPUTimeAvailable,
    getGPUTime,
    updateGPUTime,
    endGPUTime,
  };
}
