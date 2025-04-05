import { mat4 } from "gl-matrix";
import { createSphereGeometry } from "./models/sphere";
import { loadOBJ } from "./models/objLoader";
import { useBoidsWebGL } from "../boids/webgl";

const COUNT = 10000;
const BOUNDS = 100;

document.getElementById("objects")!.innerText = COUNT.toString();
document.getElementById("api")!.innerText = "WebGL";

class MovingAverage {
  constructor(private windowSize: number, private values: number[] = []) {}

  addValue(value: number): void {
    this.values.push(value);
    if (this.values.length > this.windowSize) {
      this.values.shift();
    }
  }

  getAverage(): number {
    if (this.values.length === 0) {
      return 0;
    }
    const sum = this.values.reduce((acc, val) => acc + val, 0);
    return sum / this.values.length;
  }
}

// Vertex shader program
const vsSource = `#version 300 es
    precision highp float;
    in vec4 aVertexPosition;
    in vec3 aVertexNormal;
    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uModelMatrix;
    uniform vec3 uLightDirection;
    uniform vec3 uLightColor;
    uniform vec3 uAmbientColor;
    uniform vec4 uInstanceColor;
    uniform sampler2D tPositions;
    uniform sampler2D tVelocities;
    uniform sampler2D tColors;
    out vec4 vColor;
    out vec3 vNormal;
    out vec3 vLightDirection;

    void main(void) {
      vec2 textureSize = vec2(textureSize(tColors, 0));
      int x = gl_InstanceID % int(textureSize.x);
      int y = gl_InstanceID / int(textureSize.x);
      vec2 aCoords = vec2(x, y) / textureSize;

      vec3 modelPosition = texture(tPositions, aCoords).xyz;
      float scale = .5;

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
        scale * rotationMatrix[0][0], scale * rotationMatrix[0][1], scale * rotationMatrix[0][2], 0.0,
        scale * rotationMatrix[1][0], scale * rotationMatrix[1][1], scale * rotationMatrix[1][2], 0.0,
        scale * rotationMatrix[2][0], scale * rotationMatrix[2][1], scale * rotationMatrix[2][2], 0.0,
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

/******************************************************************* */
/***************************** GPGPU *********************************/
/******************************************************************* */

let initialPositions = new Float32Array(COUNT * 4);
let initialVelocities = new Float32Array(COUNT * 4);
let colors = new Float32Array(COUNT * 4);

const red = [1, 0, 0, 1];
const green = [0, 1, 0, 1];
const cyan = [0, 0.5, 1, 1];

for (let i = 0; i < initialVelocities.length; i += 4) {
  initialPositions[i + 0] = (Math.random() - 0.5) * BOUNDS;
  initialPositions[i + 1] = (Math.random() - 0.5) * BOUNDS;
  initialPositions[i + 2] = (Math.random() - 0.5) * BOUNDS;
  initialPositions[i + 3] = 0; // data alignment on 16 bytes

  initialVelocities[i + 0] = Math.random() * 0.5;
  initialVelocities[i + 1] = Math.random() * 0.5;
  initialVelocities[i + 2] = Math.random() * 0.5;
  initialVelocities[i + 3] = 0; // data alignment on 16 bytes

  const random = Math.random();
  if (random < 1 / 3) {
    colors.set(red, i);
  } else if (random < 2 / 3) {
    colors.set(green, i);
  } else {
    colors.set(cyan, i);
  }
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

  const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
  if (!shaderProgram) {
    return;
  }

  const programInfo = {
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
      positions: gl.getUniformLocation(shaderProgram, "tPositions"),
      velocities: gl.getUniformLocation(shaderProgram, "tVelocities"),
      colors: gl.getUniformLocation(shaderProgram, "tColors"),
    },
  };

  // const geometry = createSphereGeometry();
  const geometry = await loadOBJ("fish.obj");

  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.positions), gl.STATIC_DRAW);

  const normalBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.normals), gl.STATIC_DRAW);

  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geometry.indices), gl.STATIC_DRAW);

  const renderElement = document.getElementById("render")!;
  const computeElement = document.getElementById("compute")!;
  const jsElement = document.getElementById("js")!;

  // Add boids parameters
  const separationDistance = 8.0;
  const alignmentDistance = 6.0;
  const cohesionDistance = 8.0;
  const borderForce = 0.3;
  const borderDistance = 50.0;
  const speed = 0.015;

  let lastTime = performance.now();

  const {
    compute: computeBoids,
    coords,
    colorTexture,
  } = useBoidsWebGL(gl, initialPositions, initialVelocities, colors, COUNT);

  const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");
  const query = gl.createQuery();
  gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
  gl.endQuery(ext.TIME_ELAPSED_EXT);

  const computeTime = new MovingAverage(100);
  const renderTime = new MovingAverage(100);
  const jsTime = new MovingAverage(100);

  let measureTarget: "compute" | "render" = "compute";

  function render() {
    const timeAvailable = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE);
    if (!timeAvailable) {
      // still computing the previous frame, skip this frame
      requestAnimationFrame(render);
      return;
    }

    const currentTime = performance.now();
    const deltaTime = (currentTime - lastTime) * speed;
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

    const { positionsTexture, velocitiesTexture } = computeBoids({
      deltaTime,
      separationDistance,
      alignmentDistance,
      cohesionDistance,
      borderForce,
      borderDistance,
      bounds: BOUNDS,
    });

    if (measureTarget === "compute") {
      gl.endQuery(ext.TIME_ELAPSED_EXT);
    } else {
      gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
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
    mat4.translate(viewMatrix, viewMatrix, [0, 0, -BOUNDS * 2]);
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

    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D, positionsTexture);
    gl.uniform1i(programInfo.uniformLocations.positions, 6);
    gl.activeTexture(gl.TEXTURE7);
    gl.bindTexture(gl.TEXTURE_2D, velocitiesTexture);
    gl.uniform1i(programInfo.uniformLocations.velocities, 7);
    gl.activeTexture(gl.TEXTURE8);
    gl.bindTexture(gl.TEXTURE_2D, colorTexture);
    gl.uniform1i(programInfo.uniformLocations.colors, 8);

    gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.viewMatrix, false, viewMatrix);
    gl.uniform3fv(programInfo.uniformLocations.lightDirection, lightDirection);
    gl.uniform3fv(programInfo.uniformLocations.lightColor, lightColor);
    gl.uniform3fv(programInfo.uniformLocations.ambientColor, ambientColor);

    const vertexCount = geometry.indices.length;
    const type = gl.UNSIGNED_SHORT;
    const offset = 0;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.drawElementsInstanced(gl.TRIANGLES, vertexCount, type, offset, COUNT);

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
