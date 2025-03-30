import { mat4, vec3 } from "gl-matrix";
import { BOUNDS, computePositions, computeVelocities } from "../gpgpu";

const WIDTH = 40;
const FISHES = WIDTH * WIDTH;

document.getElementById("objects")!.innerText = FISHES.toString();
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

let positionsBufferA = new Float32Array(FISHES * 3);
for (let i = 0; i < positionsBufferA.length; i += 3) {
  positionsBufferA[i + 0] = ((Math.random() - 0.5) * BOUNDS) / 4;
  positionsBufferA[i + 1] = ((Math.random() - 0.5) * BOUNDS) / 4;
  positionsBufferA[i + 2] = ((Math.random() - 0.5) * BOUNDS) / 4;
}

// Add velocity buffers
let velocityBufferA = new Float32Array(FISHES * 3);
for (let i = 0; i < velocityBufferA.length; i += 3) {
  velocityBufferA[i + 0] = 0.5;
  velocityBufferA[i + 1] = 0.5;
  velocityBufferA[i + 2] = 0.5;
}

// Add buffer swap functionality
let positionsBufferB = new Float32Array(FISHES * 3);
let velocityBufferB = new Float32Array(FISHES * 3);

const positionsBuffers = {
  read: positionsBufferA,
  write: positionsBufferB,
};

const velocityBuffers = {
  read: velocityBufferA,
  write: velocityBufferB,
};

function swapPositionsBuffers() {
  const temp = positionsBuffers.read;
  positionsBuffers.read = positionsBuffers.write;
  positionsBuffers.write = temp;
}

function swapVelocityBuffers() {
  const temp = velocityBuffers.read;
  velocityBuffers.read = velocityBuffers.write;
  velocityBuffers.write = temp;
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

interface Buffer {
  position: WebGLBuffer;
  normal: WebGLBuffer;
  index: WebGLBuffer;
  numIndices: number;
}

function initBuffers(gl: WebGLRenderingContext): Buffer {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const radius = 1.0;
  const stacks = 18;
  const slices = 36;

  // Create a sphere at origin
  for (let stack = 0; stack <= stacks; ++stack) {
    const theta = (stack * Math.PI) / stacks;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let slice = 0; slice <= slices; ++slice) {
      const phi = (slice * 2 * Math.PI) / slices;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      const x = radius * sinTheta * cosPhi;
      const y = radius * sinTheta * sinPhi;
      const z = radius * cosTheta;

      positions.push(x, y, z);

      // Calculate normals
      const normal = vec3.fromValues(sinTheta * cosPhi, sinTheta * sinPhi, cosTheta);
      normals.push(...normal);
    }
  }

  // Generate indices for the sphere
  for (let stack = 0; stack < stacks; ++stack) {
    for (let slice = 0; slice < slices; ++slice) {
      const first = stack * (slices + 1) + slice;
      const second = first + slices + 1;

      indices.push(first, second, first + 1);
      indices.push(second, second + 1, first + 1);
    }
  }

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  const normalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

  return {
    position: positionBuffer,
    normal: normalBuffer,
    index: indexBuffer,
    numIndices: indices.length,
  };
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

function drawScene(
  gl: WebGL2RenderingContext,
  programInfo: ProgramInfo,
  buffers: Buffer,
  instanceColors: Float32Array
): void {
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

  const lightDirection = vec3.fromValues(0.5, 0.7, 0);
  const lightColor = vec3.fromValues(1.5, 1.5, 1.5);
  const ambientColor = vec3.fromValues(0.2, 0.2, 0.2);

  {
    const numComponents = 3;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, numComponents, type, normalize, stride, offset);
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
  }

  {
    const numComponents = 3;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normal);
    gl.vertexAttribPointer(programInfo.attribLocations.vertexNormal, numComponents, type, normalize, stride, offset);
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexNormal);
  }

  gl.useProgram(programInfo.program);

  gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
  gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, viewMatrix);
  gl.uniform3fv(programInfo.uniformLocations.lightDirection, lightDirection);
  gl.uniform3fv(programInfo.uniformLocations.lightColor, lightColor);
  gl.uniform3fv(programInfo.uniformLocations.ambientColor, ambientColor);

  // Draw each instance
  for (let i = 0; i < FISHES; i++) {
    const modelMatrix = mat4.create();
    const position = vec3.fromValues(
      positionsBuffers.read[i * 3],
      positionsBuffers.read[i * 3 + 1],
      positionsBuffers.read[i * 3 + 2]
    );
    mat4.translate(modelMatrix, modelMatrix, position);
    gl.uniformMatrix4fv(programInfo.uniformLocations.modelMatrix, false, modelMatrix);

    // Set color for this instance
    const color = new Float32Array(4);
    color.set(instanceColors.slice(i * 4, (i + 1) * 4));
    gl.uniform4fv(programInfo.uniformLocations.instanceColor, color);

    {
      const vertexCount = buffers.numIndices;
      const type = gl.UNSIGNED_SHORT;
      const offset = 0;
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.index);
      gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
    }
  }
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

  const buffers = initBuffers(gl);

  const renderElement = document.getElementById("render")!;
  const computeElement = document.getElementById("compute")!;

  // Create colors array for all instances
  const colors: number[][] = [];
  for (let i = 0; i < FISHES; i++) {
    colors.push([Math.random(), Math.random(), Math.random(), 1.0]);
  }

  // Create a single Float32Array for all instance colors
  const instanceColors = new Float32Array(FISHES * 4);
  for (let i = 0; i < FISHES; i++) {
    const color = colors[i];
    instanceColors[i * 4] = color[0];
    instanceColors[i * 4 + 1] = color[1];
    instanceColors[i * 4 + 2] = color[2];
    instanceColors[i * 4 + 3] = color[3];
  }

  // Add boids parameters
  const separation = 5.0;
  const alignment = 4.0;
  const cohesion = 10.0;
  const borderForce = 10;
  const speed = 1 / 200;
  let lastTime = performance.now();

  function render() {
    performance.mark("compute");

    // Calculate deltaTime
    const currentTime = performance.now();
    const deltaTime = (currentTime - lastTime) * speed;
    lastTime = currentTime;

    // Compute new positions and velocities
    computeVelocities(
      velocityBuffers.read,
      velocityBuffers.write,
      positionsBuffers.read,
      deltaTime,
      separation,
      alignment,
      cohesion,
      currentTime,
      borderForce,
      BOUNDS / 2
    );
    swapVelocityBuffers();

    computePositions(positionsBuffers.read, positionsBuffers.write, velocityBuffers.read, deltaTime);
    swapPositionsBuffers();

    const compute = performance.measure("compute", "compute");
    computeElement.textContent = compute.duration.toFixed(2) + "ms";

    performance.mark("render");

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    drawScene(gl, programInfo, buffers, instanceColors);

    const measure = performance.measure("render", "render");
    renderElement.textContent = measure.duration.toFixed(2) + "ms";

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

window.onload = main;
