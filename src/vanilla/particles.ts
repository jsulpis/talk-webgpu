import { mat4, vec3 } from "gl-matrix";
import { BOUNDS } from "../gpgpu";

// Vertex shader program
const vsSource = `
    precision highp float;
    attribute vec4 aVertexPosition;
    attribute vec4 aVertexColor;
    attribute vec3 aVertexNormal;
    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;
    uniform mat4 uNormalMatrix;
    uniform vec3 uLightDirection;
    varying lowp vec4 vColor;
    varying highp vec3 vNormal;
    varying highp vec3 vLightDirection;

    void main(void) {
        gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
        vNormal = mat3(uNormalMatrix) * aVertexNormal;
        vLightDirection = uLightDirection;
        vColor = aVertexColor;
    }
`;

// Fragment shader program
const fsSource = `
    precision highp float;

    varying lowp vec4 vColor;
    varying highp vec3 vNormal;
    varying highp vec3 vLightDirection;
    uniform vec3 uLightColor;
    uniform vec3 uAmbientColor;

    void main(void) {
        highp vec3 light = uLightColor * vec3(vColor) * max(dot(vNormal, vLightDirection), 0.0);
        highp vec3 ambient = uAmbientColor;
        highp vec3 color = (light + ambient) * vec3(vColor);
        gl_FragColor = vec4(color, vColor.a);
    }
`;

/******************************************************************* */
/***************************** GPGPU *********************************/
/******************************************************************* */

const WIDTH = 60;
const FISHES = WIDTH * WIDTH;

document.getElementById("objects")!.innerText = FISHES.toString();

let positionsBufferA = new Float32Array(FISHES * 3);
for (let i = 0; i < positionsBufferA.length; i += 3) {
  positionsBufferA[i + 0] = ((Math.random() - 0.5) * BOUNDS) / 4;
  positionsBufferA[i + 1] = ((Math.random() - 0.5) * BOUNDS) / 4;
  positionsBufferA[i + 2] = ((Math.random() - 0.5) * BOUNDS) / 4;
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
  color: WebGLBuffer;
  normal: WebGLBuffer;
  index: WebGLBuffer;
  numIndices: number;
}

function initBuffers(gl: WebGLRenderingContext, position: vec3, color: number[]): Buffer {
  const positions: number[] = [];
  const colors: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const radius = 0.1;
  const stacks = 18;
  const slices = 36;

  const x = position[0];
  const y = position[1];
  const z = position[2];

  // Create a sphere at (x, y, z) with radius
  for (let stack = 0; stack <= stacks; ++stack) {
    const theta = (stack * Math.PI) / stacks;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let slice = 0; slice <= slices; ++slice) {
      const phi = (slice * 2 * Math.PI) / slices;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      const x1 = x + radius * sinTheta * cosPhi;
      const y1 = y + radius * sinTheta * sinPhi;
      const z1 = z + radius * cosTheta;

      positions.push(x1, y1, z1);
      colors.push(...color);

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

  const colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

  const normalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

  return {
    position: positionBuffer,
    color: colorBuffer,
    normal: normalBuffer,
    index: indexBuffer,
    numIndices: indices.length,
  };
}

interface ProgramInfo {
  program: WebGLProgram;
  attribLocations: {
    vertexPosition: number;
    vertexColor: number;
    vertexNormal: number;
  };
  uniformLocations: {
    projectionMatrix: WebGLUniformLocation | null;
    modelViewMatrix: WebGLUniformLocation | null;
    normalMatrix: WebGLUniformLocation | null;
    lightDirection: WebGLUniformLocation | null;
    lightColor: WebGLUniformLocation | null;
    ambientColor: WebGLUniformLocation | null;
  };
}

function drawScene(gl: WebGLRenderingContext, programInfo: ProgramInfo, buffers: Buffer): void {
  const fieldOfView = (45 * Math.PI) / 180;
  const canvas = gl.canvas as HTMLCanvasElement;
  const aspect = canvas.clientWidth / canvas.clientHeight;
  const zNear = 0.1;
  const zFar = 100.0;
  const projectionMatrix = mat4.create();

  mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

  const modelViewMatrix = mat4.create();
  mat4.translate(modelViewMatrix, modelViewMatrix, [0.0, 0.0, -6.0]);
  const normalMatrix = mat4.create();
  mat4.invert(normalMatrix, modelViewMatrix);
  mat4.transpose(normalMatrix, normalMatrix);

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
    const numComponents = 4;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
    gl.vertexAttribPointer(programInfo.attribLocations.vertexColor, numComponents, type, normalize, stride, offset);
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexColor);
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
  gl.uniformMatrix4fv(programInfo.uniformLocations.modelViewMatrix, false, modelViewMatrix);
  gl.uniformMatrix4fv(programInfo.uniformLocations.normalMatrix, false, normalMatrix);

  const lightDirection = vec3.fromValues(0.5, 0.7, 1.0);
  const lightColor = vec3.fromValues(1.0, 1.0, 1.0);
  const ambientColor = vec3.fromValues(0.2, 0.2, 0.2);

  gl.uniform3fv(programInfo.uniformLocations.lightDirection, lightDirection);
  gl.uniform3fv(programInfo.uniformLocations.lightColor, lightColor);
  gl.uniform3fv(programInfo.uniformLocations.ambientColor, ambientColor);

  {
    const vertexCount = buffers.numIndices;
    const type = gl.UNSIGNED_SHORT;
    const offset = 0;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.index);
    gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
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
      vertexColor: gl.getAttribLocation(shaderProgram, "aVertexColor"),
      vertexNormal: gl.getAttribLocation(shaderProgram, "aVertexNormal"),
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(shaderProgram, "uProjectionMatrix"),
      modelViewMatrix: gl.getUniformLocation(shaderProgram, "uModelViewMatrix"),
      normalMatrix: gl.getUniformLocation(shaderProgram, "uNormalMatrix"),
      lightDirection: gl.getUniformLocation(shaderProgram, "uLightDirection"),
      lightColor: gl.getUniformLocation(shaderProgram, "uLightColor"),
      ambientColor: gl.getUniformLocation(shaderProgram, "uAmbientColor"),
    },
  };

  const buffers: Buffer[] = [];
  const colors: number[][] = [];

  const renderElement = document.getElementById("render")!;

  // Initialize buffers for each sphere
  for (let i = 0; i < FISHES; i++) {
    const color = [Math.random(), Math.random(), Math.random(), 1.0];
    colors.push(color);
    const position = vec3.fromValues(positionsBufferA[i * 3], positionsBufferA[i * 3 + 1], positionsBufferA[i * 3 + 2]);
    const buffer = initBuffers(gl, position, color);
    buffers.push(buffer);
  }

  function render() {
    performance.mark("render");

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Draw each sphere
    for (let i = 0; i < FISHES; i++) {
      drawScene(gl, programInfo, buffers[i]);
    }

    const measure = performance.measure("render", "render");
    renderElement.textContent = measure.duration.toFixed(2) + "ms";

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

window.onload = main;
