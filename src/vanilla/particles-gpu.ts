import { mat4, vec3 } from "gl-matrix";
import { BOUNDS, computePositions, computeVelocities } from "../gpgpu";

const WIDTH = 30;
const FISHES = WIDTH * WIDTH;

// Vertex shader program
const vsSource = `
struct Uniforms {
    projectionMatrix: mat4x4f,
    viewMatrix: mat4x4f,
    lightDirection: vec3f,
    lightColor: vec3f,
    ambientColor: vec3f,
}
@binding(0) @group(0) var<uniform> uniforms: Uniforms;

struct InstanceUniforms {
    modelMatrix: mat4x4f,
}
@binding(1) @group(0) var<storage> instances: array<InstanceUniforms>;

struct InstanceColors {
    colors: array<vec4f, ${FISHES}>,
}
@binding(2) @group(0) var<uniform> instanceColors: InstanceColors;

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f,
    @location(1) normal: vec3f,
    @location(2) lightDirection: vec3f,
}

@vertex
fn vertexMain(
    @location(0) position: vec4f,
    @location(2) normal: vec3f,
    @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
    var output: VertexOutput;
    let modelMatrix = instances[instanceIndex].modelMatrix;
    let modelViewMatrix = uniforms.viewMatrix * modelMatrix;
    output.position = uniforms.projectionMatrix * modelViewMatrix * position;

    // Transform normal to view space
    // Since we're only using translation and rotation (no scaling),
    // we can use the modelViewMatrix directly
    output.normal = (modelViewMatrix * vec4f(normal, 0.0)).xyz;

    // Transform light direction to view space
    output.lightDirection = (uniforms.viewMatrix * vec4f(uniforms.lightDirection, 0.0)).xyz;
    output.color = instanceColors.colors[instanceIndex];
    return output;
}
`;

// Fragment shader program
const fsSource = `
struct Uniforms {
    projectionMatrix: mat4x4f,
    viewMatrix: mat4x4f,
    lightDirection: vec3f,
    lightColor: vec3f,
    ambientColor: vec3f,
}
@binding(0) @group(0) var<uniform> uniforms: Uniforms;

@fragment
fn fragmentMain(
    @location(0) color: vec4f,
    @location(1) normal: vec3f,
    @location(2) lightDirection: vec3f,
) -> @location(0) vec4f {
    let light = uniforms.lightColor * color.rgb * max(dot(normal, lightDirection), 0.0);
    let ambient = uniforms.ambientColor;
    return vec4f((light + ambient) * color.rgb, color.a);
}
`;

/******************************************************************* */
/***************************** GPGPU *********************************/
/******************************************************************* */

document.getElementById("objects")!.innerText = FISHES.toString();
document.getElementById("api")!.innerText = "WebGPU";

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

function createSphereGeometry(
  radius: number = 0.5,
  stacks: number = 18,
  slices: number = 36
): {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint16Array;
} {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  const x = 0;
  const y = 0;
  const z = 0;

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

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
  };
}

async function main() {
  if (!navigator.gpu) {
    console.error("WebGPU not supported");
    return;
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    console.error("No GPU adapter found");
    return;
  }

  const device = await adapter.requestDevice();

  const canvas = document.createElement("canvas");
  canvas.width = window.innerWidth * devicePixelRatio;
  canvas.height = window.innerHeight * devicePixelRatio;
  document.body.appendChild(canvas);

  const context = canvas.getContext("webgpu")!;
  if (!context) {
    console.error("WebGPU context not available");
    return;
  }

  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format,
    alphaMode: "premultiplied",
  });

  // Create shader modules
  const vertexShaderModule = device.createShaderModule({
    code: vsSource,
    label: "Vertex Shader",
  });

  const fragmentShaderModule = device.createShaderModule({
    code: fsSource,
    label: "Fragment Shader",
  });

  // Create pipeline
  const pipeline = device.createRenderPipeline({
    layout: "auto",
    label: "Render Pipeline",
    vertex: {
      module: vertexShaderModule,
      entryPoint: "vertexMain",
      buffers: [
        {
          arrayStride: 12, // 3 * 4 bytes
          attributes: [
            { format: "float32x3", offset: 0, shaderLocation: 0 }, // position
          ],
        },
        {
          arrayStride: 12, // 3 * 4 bytes
          attributes: [
            { format: "float32x3", offset: 0, shaderLocation: 2 }, // normal
          ],
        },
      ],
    },
    fragment: {
      module: fragmentShaderModule,
      entryPoint: "fragmentMain",
      targets: [{ format }],
    },
    primitive: {
      topology: "triangle-list",
      cullMode: "back",
    },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: "less",
      format: "depth24plus",
    },
  });

  // Create depth texture
  const depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
    label: "Depth Texture",
  });

  // Create uniform buffer for view/projection matrices
  // Size calculation with proper alignment:
  // - projectionMatrix: 16 floats (64 bytes)
  // - viewMatrix: 16 floats (64 bytes)
  // - lightDirection: 4 floats (16 bytes, padded from 3)
  // - lightColor: 4 floats (16 bytes, padded from 3)
  // - ambientColor: 4 floats (16 bytes, padded from 3)
  const uniformBufferSize = 256; // Aligned to 256 bytes
  const uniformBuffer = device.createBuffer({
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    label: "Main Uniform Buffer",
  });

  // Create instance uniform buffer for model matrices
  const instanceUniformBufferSize = 256; // Aligned to 256 bytes
  const instanceUniformBuffer = device.createBuffer({
    size: instanceUniformBufferSize * FISHES,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    label: "Instance Uniform Buffer",
  });

  // Create instance colors uniform buffer
  const instanceColorsBufferSize = FISHES * 16; // 4 floats per color (RGBA)
  const instanceColorsBuffer = device.createBuffer({
    size: instanceColorsBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    label: "Instance Colors Buffer",
  });

  // Create colors array for all instances
  const colors: number[][] = [];
  for (let i = 0; i < FISHES; i++) {
    colors.push([Math.random(), Math.random(), Math.random(), 1.0]);
  }

  // Write initial colors to the buffer
  const colorData = new Float32Array(FISHES * 4);
  for (let i = 0; i < FISHES; i++) {
    const color = colors[i];
    colorData[i * 4] = color[0];
    colorData[i * 4 + 1] = color[1];
    colorData[i * 4 + 2] = color[2];
    colorData[i * 4 + 3] = color[3];
  }
  device.queue.writeBuffer(instanceColorsBuffer, 0, colorData);

  // Create a single sphere geometry at origin
  const sphereGeometry = createSphereGeometry(1.0);

  const positionBuffer = device.createBuffer({
    size: sphereGeometry.positions.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    label: "Position Vertex Buffer",
  });
  device.queue.writeBuffer(positionBuffer, 0, sphereGeometry.positions);

  const normalBuffer = device.createBuffer({
    size: sphereGeometry.normals.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    label: "Normal Vertex Buffer",
  });
  device.queue.writeBuffer(normalBuffer, 0, sphereGeometry.normals);

  const indexBuffer = device.createBuffer({
    size: sphereGeometry.indices.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    label: "Index Buffer",
  });
  device.queue.writeBuffer(indexBuffer, 0, sphereGeometry.indices);

  const renderElement = document.getElementById("render")!;
  const computeElement = document.getElementById("compute")!;

  // Create render bundle
  const bundleEncoder = device.createRenderBundleEncoder({
    colorFormats: [format],
    depthStencilFormat: "depth24plus",
    label: "Render Bundle Encoder",
  });

  bundleEncoder.setPipeline(pipeline);

  // Set bind group for the render bundle
  bundleEncoder.setBindGroup(
    0,
    device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: { buffer: instanceUniformBuffer } },
        { binding: 2, resource: { buffer: instanceColorsBuffer } },
      ],
      label: "Render Bundle Bind Group",
    })
  );

  // Set vertex buffers
  bundleEncoder.setVertexBuffer(0, positionBuffer);
  bundleEncoder.setVertexBuffer(1, normalBuffer);
  bundleEncoder.setIndexBuffer(indexBuffer, "uint16");

  // Draw all instances at once
  bundleEncoder.drawIndexed(sphereGeometry.indices.length, FISHES, 0, 0, 0);

  const renderBundle = bundleEncoder.finish();

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

    // Update view/projection matrices
    const fieldOfView = (60 * Math.PI) / 180;
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

    // Update uniform buffer with proper alignment
    const uniformData = new Float32Array(uniformBufferSize / 4);
    // Projection matrix (16 floats)
    uniformData.set(projectionMatrix, 0);
    // View matrix (16 floats)
    uniformData.set(viewMatrix, 16);
    // Light direction (3 floats, padded to 4)
    uniformData.set(lightDirection, 32);
    uniformData[35] = 0; // Padding
    // Light color (3 floats, padded to 4)
    uniformData.set(lightColor, 36);
    uniformData[39] = 0; // Padding
    // Ambient color (3 floats, padded to 4)
    uniformData.set(ambientColor, 40);
    uniformData[43] = 0; // Padding
    device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    // Update instance matrices
    const instanceData = new Float32Array(FISHES * 64); // 16 floats per matrix, but padded to 256 bytes
    for (let i = 0; i < FISHES; i++) {
      const modelMatrix = mat4.create();
      const position = vec3.fromValues(
        positionsBuffers.read[i * 3],
        positionsBuffers.read[i * 3 + 1],
        positionsBuffers.read[i * 3 + 2]
      );
      mat4.translate(modelMatrix, modelMatrix, position);
      instanceData.set(modelMatrix, i * 64); // Write to the start of each 256-byte aligned block
    }
    device.queue.writeBuffer(instanceUniformBuffer, 0, instanceData);

    // Create command encoder for the current frame
    const commandEncoder = device.createCommandEncoder({
      label: "Command Encoder",
    });
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
      label: "Render Pass",
    });

    renderPass.executeBundles([renderBundle]);

    renderPass.end();
    device.queue.submit([commandEncoder.finish()]);

    const measure = performance.measure("render", "render");
    renderElement.textContent = measure.duration.toFixed(2) + "ms";

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

window.onload = main;
