import { mat4, vec3 } from "gl-matrix";
import { BOUNDS } from "../gpgpu";

// Vertex shader program
const vsSource = `
struct Uniforms {
    modelViewMatrix: mat4x4f,
    projectionMatrix: mat4x4f,
    normalMatrix: mat4x4f,
    lightDirection: vec3f,
    lightColor: vec3f,
    ambientColor: vec3f,
}
@binding(0) @group(0) var<uniform> uniforms: Uniforms;

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f,
    @location(1) normal: vec3f,
    @location(2) lightDirection: vec3f,
}

@vertex
fn vertexMain(
    @location(0) position: vec4f,
    @location(1) color: vec4f,
    @location(2) normal: vec3f,
) -> VertexOutput {
    var output: VertexOutput;
    output.position = uniforms.projectionMatrix * uniforms.modelViewMatrix * position;
    output.normal = (uniforms.normalMatrix * vec4f(normal, 1.0)).xyz;
    output.lightDirection = uniforms.lightDirection;
    output.color = color;
    return output;
}
`;

// Fragment shader program
const fsSource = `
struct Uniforms {
    modelViewMatrix: mat4x4f,
    projectionMatrix: mat4x4f,
    normalMatrix: mat4x4f,
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

const WIDTH = 60;
const FISHES = WIDTH * WIDTH;

document.getElementById("objects")!.innerText = FISHES.toString();
document.getElementById("api")!.innerText = "WebGPU";

let positionsBufferA = new Float32Array(FISHES * 3);
for (let i = 0; i < positionsBufferA.length; i += 3) {
  positionsBufferA[i + 0] = ((Math.random() - 0.5) * BOUNDS) / 4;
  positionsBufferA[i + 1] = ((Math.random() - 0.5) * BOUNDS) / 4;
  positionsBufferA[i + 2] = ((Math.random() - 0.5) * BOUNDS) / 4;
}

interface Buffer {
  position: GPUBuffer;
  color: GPUBuffer;
  normal: GPUBuffer;
  index: GPUBuffer;
  numIndices: number;
}

interface Uniforms {
  modelViewMatrix: Float32Array;
  projectionMatrix: Float32Array;
  normalMatrix: Float32Array;
  lightDirection: Float32Array;
  lightColor: Float32Array;
  ambientColor: Float32Array;
}

function createSphereGeometry(
  position: vec3,
  color: number[],
  radius: number = 0.1,
  stacks: number = 18,
  slices: number = 36
): {
  positions: Float32Array;
  colors: Float32Array;
  normals: Float32Array;
  indices: Uint16Array;
} {
  const positions: number[] = [];
  const colors: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

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

  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
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

  const context = canvas.getContext("webgpu");
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
  });

  const fragmentShaderModule = device.createShaderModule({
    code: fsSource,
  });

  // Create pipeline
  const pipeline = device.createRenderPipeline({
    layout: "auto",
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
          arrayStride: 16, // 4 * 4 bytes
          attributes: [
            { format: "float32x4", offset: 0, shaderLocation: 1 }, // color
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
  });

  // Create uniform buffer
  // Each matrix is 4x4 = 16 floats, each vector is 3 floats
  // We need to align to 16 bytes (4 floats) for WGSL struct alignment
  const uniformBufferSize = 16 * 4 * 3 + 16 * 3; // 3 matrices (16 floats each) + 3 vectors (4 floats each for alignment)
  const uniformBuffer = device.createBuffer({
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // Create buffers for each sphere
  const buffers: Buffer[] = [];
  const colors: number[][] = [];

  for (let i = 0; i < FISHES; i++) {
    const color = [Math.random(), Math.random(), Math.random(), 1.0];
    colors.push(color);
    const position = vec3.fromValues(positionsBufferA[i * 3], positionsBufferA[i * 3 + 1], positionsBufferA[i * 3 + 2]);
    const geometry = createSphereGeometry(position, color);

    const positionBuffer = device.createBuffer({
      size: geometry.positions.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(positionBuffer, 0, geometry.positions);

    const colorBuffer = device.createBuffer({
      size: geometry.colors.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(colorBuffer, 0, geometry.colors);

    const normalBuffer = device.createBuffer({
      size: geometry.normals.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(normalBuffer, 0, geometry.normals);

    const indexBuffer = device.createBuffer({
      size: geometry.indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(indexBuffer, 0, geometry.indices);

    buffers.push({
      position: positionBuffer,
      color: colorBuffer,
      normal: normalBuffer,
      index: indexBuffer,
      numIndices: geometry.indices.length,
    });
  }

  const renderElement = document.getElementById("render")!;

  // Create render bundle
  const bundleEncoder = device.createRenderBundleEncoder({
    colorFormats: [format],
    depthStencilFormat: "depth24plus",
  });

  bundleEncoder.setPipeline(pipeline);
  bundleEncoder.setBindGroup(
    0,
    device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    })
  );

  // Record the common rendering commands in the bundle
  for (let i = 0; i < FISHES; i++) {
    const buffer = buffers[i];
    bundleEncoder.setVertexBuffer(0, buffer.position);
    bundleEncoder.setVertexBuffer(1, buffer.color);
    bundleEncoder.setVertexBuffer(2, buffer.normal);
    bundleEncoder.setIndexBuffer(buffer.index, "uint16");
    bundleEncoder.drawIndexed(buffer.numIndices);
  }

  const renderBundle = bundleEncoder.finish();

  function render() {
    performance.mark("render");

    const fieldOfView = (45 * Math.PI) / 180;
    const aspect = canvas.width / canvas.height;
    const zNear = 0.1;
    const zFar = 100.0;
    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

    const modelViewMatrix = mat4.create();
    mat4.translate(modelViewMatrix, modelViewMatrix, [0.0, 0.0, -6.0]);
    const normalMatrix = mat4.create();
    mat4.invert(normalMatrix, modelViewMatrix);
    mat4.transpose(normalMatrix, normalMatrix);

    const lightDirection = vec3.fromValues(0.5, 0.7, 1.0);
    const lightColor = vec3.fromValues(1.0, 1.0, 1.0);
    const ambientColor = vec3.fromValues(0.2, 0.2, 0.2);

    // Update uniform buffer
    const uniformData = new Float32Array(uniformBufferSize / 4);
    uniformData.set(modelViewMatrix, 0);
    uniformData.set(projectionMatrix, 16);
    uniformData.set(normalMatrix, 32);
    uniformData.set([...lightDirection, 0], 48);
    uniformData.set([...lightColor, 0], 52);
    uniformData.set([...ambientColor, 0], 56);
    device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    // Create command encoder for the current frame
    const commandEncoder = device.createCommandEncoder();
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
    });

    // Execute the render bundle
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
