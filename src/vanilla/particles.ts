import { mat4, vec3 } from "gl-matrix";
import { useBoidsCPU } from "../boids/cpu";
import { createSphereGeometry } from "./models/sphere";

const COUNT = 400;
const BOUNDS = 100;

document.getElementById("objects")!.innerText = COUNT.toString();
document.getElementById("api")!.innerText = "WebGL";

// Vertex shader program
const vsSource = `#version 300 es
    precision highp float;
    in vec4 aVertexPosition;
    in vec3 aVertexNormal;
    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uModelMatrix;
    uniform vec3 uLightDirection;
    uniform vec4 uInstanceColor;
    out vec4 vColor;
    out vec3 vNormal;
    out vec3 vLightDirection;

    void main(void) {
        gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * aVertexPosition;
        vNormal = mat3(uViewMatrix * uModelMatrix) * aVertexNormal;
        vLightDirection = (uViewMatrix * vec4(uLightDirection, 0.0)).xyz;
        vColor = uInstanceColor;
    }
`;

// Fragment shader program
const fsSource = `#version 300 es
    precision highp float;

    in vec4 vColor;
    in vec3 vNormal;
    in vec3 vLightDirection;
    uniform vec3 uLightColor;
    uniform vec3 uAmbientColor;
    out vec4 fragColor;

    void main(void) {
        highp vec3 light = uLightColor * vColor.rgb * max(dot(vNormal, vLightDirection), 0.0);
        highp vec3 ambient = uAmbientColor;
        highp vec3 color = (light + ambient) * vColor.rgb;
        fragColor = vec4(color, vColor.a);
    }
`;

/******************************************************************* */
/***************************** GPGPU *********************************/
/******************************************************************* */

let initialPositions = new Float32Array(COUNT * 3);
for (let i = 0; i < initialPositions.length; i += 3) {
  initialPositions[i + 0] = ((Math.random() - 0.5) * BOUNDS) / 4;
  initialPositions[i + 1] = ((Math.random() - 0.5) * BOUNDS) / 4;
  initialPositions[i + 2] = ((Math.random() - 0.5) * BOUNDS) / 4;
}

let initialVelocities = new Float32Array(COUNT * 3);
for (let i = 0; i < initialVelocities.length; i += 3) {
  initialVelocities[i + 0] = 0.5;
  initialVelocities[i + 1] = 0.5;
  initialVelocities[i + 2] = 0.5;
}

function initShaderProgram(gl: WebGLRenderingContext, vsSource: string, fsSource: string): WebGLProgram | null {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

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

function loadShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
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

interface ProgramInfo {
  program: WebGLProgram;
  attribLocations: {
    vertexPosition: number;
    vertexNormal: number;
  };
  uniformLocations: {
    projectionMatrix: WebGLUniformLocation | null;
    viewMatrix: WebGLUniformLocation | null;
    modelMatrix: WebGLUniformLocation | null;
    lightDirection: WebGLUniformLocation | null;
    lightColor: WebGLUniformLocation | null;
    ambientColor: WebGLUniformLocation | null;
    instanceColor: WebGLUniformLocation | null;
  };
}

function main() {
  const canvas = document.createElement("canvas");
  canvas.width = window.innerWidth * devicePixelRatio;
  canvas.height = window.innerHeight * devicePixelRatio;
  document.body.appendChild(canvas);

  const gl = canvas.getContext("webgl2")!;
  if (!gl) {
    console.error("Unable to initialize WebGL. Your browser or machine may not support it.");
    return;
  }

  const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
  if (!shaderProgram) {
    return;
  }

  const programInfo: ProgramInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition"),
      vertexNormal: gl.getAttribLocation(shaderProgram, "aVertexNormal"),
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(shaderProgram, "uProjectionMatrix"),
      viewMatrix: gl.getUniformLocation(shaderProgram, "uViewMatrix"),
      modelMatrix: gl.getUniformLocation(shaderProgram, "uModelMatrix"),
      lightDirection: gl.getUniformLocation(shaderProgram, "uLightDirection"),
      lightColor: gl.getUniformLocation(shaderProgram, "uLightColor"),
      ambientColor: gl.getUniformLocation(shaderProgram, "uAmbientColor"),
      instanceColor: gl.getUniformLocation(shaderProgram, "uInstanceColor"),
    },
  };

  const sphereGeometry = createSphereGeometry();

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereGeometry.positions), gl.STATIC_DRAW);

  const normalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sphereGeometry.normals), gl.STATIC_DRAW);

  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(sphereGeometry.indices), gl.STATIC_DRAW);

  const renderElement = document.getElementById("render")!;
  const computeElement = document.getElementById("compute")!;

  const instanceColors = new Float32Array(COUNT * 4);
  for (let i = 0; i < COUNT; i++) {
    instanceColors[i * 4] = Math.random();
    instanceColors[i * 4 + 1] = Math.random();
    instanceColors[i * 4 + 2] = Math.random();
    instanceColors[i * 4 + 3] = 1;
  }

  // Add boids parameters
  const separation = 5.0;
  const alignment = 4.0;
  const cohesion = 10.0;
  const borderForce = 10;
  const speed = 1 / 200;
  let lastTime = performance.now();

  const computeBoids = useBoidsCPU(initialPositions, initialVelocities, COUNT).compute;

  function render() {
    performance.mark("compute");

    const currentTime = performance.now();
    const deltaTime = (currentTime - lastTime) * speed;
    lastTime = currentTime;

    const { positions } = computeBoids({
      deltaTime,
      separation,
      alignment,
      cohesion,
      currentTime,
      bounds: BOUNDS,
      borderForce,
      borderDistance: BOUNDS / 2,
    });

    const compute = performance.measure("compute", "compute");
    computeElement.textContent = compute.duration.toFixed(2) + "ms";

    performance.mark("render");

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const fieldOfView = (60 * Math.PI) / 180;
    const canvas = gl.canvas as HTMLCanvasElement;
    const aspect = canvas.width / canvas.height;
    const zNear = 0.1;
    const zFar = 1000.0;
    const projectionMatrix = mat4.create();

    mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

    const viewMatrix = mat4.create();
    mat4.translate(viewMatrix, viewMatrix, [0.0, -BOUNDS / 4, -BOUNDS]);
    mat4.rotateX(viewMatrix, viewMatrix, Math.PI / 6);

    const lightDirection = [0.5, 0.7, 0];
    const lightColor = [1.5, 1.5, 1.5];
    const ambientColor = [0.2, 0.2, 0.2];

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.vertexAttribPointer(programInfo.attribLocations.vertexNormal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexNormal);

    gl.useProgram(programInfo.program);

    gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, viewMatrix);
    gl.uniform3fv(programInfo.uniformLocations.lightDirection, lightDirection);
    gl.uniform3fv(programInfo.uniformLocations.lightColor, lightColor);
    gl.uniform3fv(programInfo.uniformLocations.ambientColor, ambientColor);

    // Draw each instance
    for (let i = 0; i < COUNT; i++) {
      const modelMatrix = mat4.create();
      const position = vec3.fromValues(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      mat4.translate(modelMatrix, modelMatrix, position);
      gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrix, false, modelMatrix);

      // Set color for this instance
      const color = instanceColors.slice(i * 4, (i + 1) * 4);
      gl.uniform4fv(programInfo.uniformLocations.instanceColor, color);

      const vertexCount = sphereGeometry.indices.length;
      const type = gl.UNSIGNED_SHORT;
      const offset = 0;
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
      gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
    }

    const measure = performance.measure("render", "render");
    renderElement.textContent = measure.duration.toFixed(2) + "ms";

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

window.onload = main;
