import { loadOBJ } from "./models/objLoader";
import { useBoidsWebGL } from "../boids/webgl";
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
} from "./shared";

document.getElementById("objects")!.innerText = COUNT.toString();
document.getElementById("api")!.innerText = "WebGL";

// Vertex shader program
const vsSource = `#version 300 es
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

      mat4 modelMatrix = mat4(
        uScale * rotationMatrix[0][0], uScale * rotationMatrix[0][1], uScale * rotationMatrix[0][2], 0.0,
        uScale * rotationMatrix[1][0], uScale * rotationMatrix[1][1], uScale * rotationMatrix[1][2], 0.0,
        uScale * rotationMatrix[2][0], uScale * rotationMatrix[2][1], uScale * rotationMatrix[2][2], 0.0,
        modelPosition.x, modelPosition.y, modelPosition.z, 1.0
      );
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
`;

// Fragment shader program
const fsSource = `#version 300 es
    precision highp float;
    in vec4 vColor;
    out vec4 fragColor;

    void main(void) {
      fragColor = vColor;
    }
`;

function initProgram(gl: WebGLRenderingContext, vsSource: string, fsSource: string): WebGLProgram | null {
  const vertexShader = initShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = initShader(gl, gl.FRAGMENT_SHADER, fsSource);

  if (!vertexShader || !fragmentShader) {
    return null;
  }

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.error("Unable to initialize the shader program: " + gl.getProgramInfoLog(shaderProgram));
    return null;
  }

  return shaderProgram;
}

function initShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) {
    return null;
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createStaticBuffer(gl: WebGL2RenderingContext, data: ArrayBufferView, target: GLenum = gl.ARRAY_BUFFER) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(target, buffer);
  gl.bufferData(target, data, gl.STATIC_DRAW);
  return buffer;
}

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

  const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");
  const query = gl.createQuery();
  gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
  gl.endQuery(ext.TIME_ELAPSED_EXT);

  let measureTarget: "compute" | "render" = "render";

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
    const timeAvailable = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE);
    if (!timeAvailable) {
      // still computing the previous frame, skip this frame
      requestAnimationFrame(render);
      return;
    }

    const currentTime = performance.now();
    boidsUniforms.deltaTime = (currentTime - lastTime) * speed;
    lastTime = currentTime;

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

    const { positionsTexture, velocitiesTexture } = computeBoids(boidsUniforms);

    if (measureTarget === "compute") {
      gl.endQuery(ext.TIME_ELAPSED_EXT);
    } else {
      gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
    }

    drawScene(positionsTexture, velocitiesTexture);

    if (measureTarget === "render") {
      gl.endQuery(ext.TIME_ELAPSED_EXT);
    }

    jsTime.addValue(performance.now() - lastTime);
    jsElement.textContent = jsTime.getAverage().toFixed(1) + "ms";

    requestAnimationFrame(render);
  }

  render();
}

window.onload = main;
