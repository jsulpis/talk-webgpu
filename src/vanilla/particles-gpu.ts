import { mat4, vec3 } from "gl-matrix";
import { useBoidsGPU } from "../boids/webgpu";
import { useBoidsCPU } from "../boids/cpu";
import { createSphereGeometry } from "./sphere";

const COUNT = 10000;
const BOUNDS = 100;

const shaderSource = `
struct Uniforms {
  projectionMatrix: mat4x4f,
  viewMatrix: mat4x4f,
  lightDirection: vec3f,
  lightColor: vec3f,
  ambientColor: vec3f,
}
@binding(0) @group(0) var<uniform> uniforms: Uniforms;
@binding(1) @group(0) var<storage, read> positions: array<vec3f>;
@binding(2) @group(0) var<storage, read> colors: array<vec4f>;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
  @location(1) normal: vec3f,
  @location(2) lightDirection: vec3f,
}

@vertex
fn vertexMain(
  @location(0) position: vec4f,
  @location(1) normal: vec3f,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
  var output: VertexOutput;
  let worldPosition = vec4f(positions[instanceIndex], 1.0);
  let modelMatrix = mat4x4f(
    1.0, 0.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 0.0,
    0.0, 0.0, 1.0, 0.0,
    worldPosition.x, worldPosition.y, worldPosition.z, 1.0
  );
  let modelViewMatrix = uniforms.viewMatrix * modelMatrix;
  output.position = uniforms.projectionMatrix * modelViewMatrix * position;

  // Transform normal to view space
  output.normal = (modelViewMatrix * vec4f(normal, 0.0)).xyz;

  // Transform light direction to view space
  output.lightDirection = (uniforms.viewMatrix * vec4f(uniforms.lightDirection, 0.0)).xyz;
  output.color = colors[instanceIndex];
  return output;
}

@fragment
fn fragmentMain(
  @location(0) color: vec4f,
  @location(1) normal: vec3f,
  @location(2) lightDirection: vec3f,
) -> @location(0) vec4f {
  let light = uniforms.lightColor * max(dot(normal, lightDirection), 0.0);
  let ambient = uniforms.ambientColor;
  return vec4f((light + ambient) * color.rgb, color.a);
}
`;

/******************************************************************* */
/***************************** INIT **********************************/
/******************************************************************* */

document.getElementById("objects")!.innerText = COUNT.toString();
document.getElementById("api")!.innerText = "WebGPU";

let initialPositions = new Float32Array(COUNT * 3);
for (let i = 0; i < initialPositions.length; i += 3) {
  initialPositions[i + 0] = ((Math.random() - 0.5) * BOUNDS) / 2;
  initialPositions[i + 1] = ((Math.random() - 0.5) * BOUNDS) / 2;
  initialPositions[i + 2] = ((Math.random() - 0.5) * BOUNDS) / 2;
}

// Add velocity buffers
let initialVelocities = new Float32Array(COUNT * 3);
for (let i = 0; i < initialVelocities.length; i += 3) {
  initialVelocities[i + 0] = Math.random() * 0.5;
  initialVelocities[i + 1] = Math.random() * 0.5;
  initialVelocities[i + 2] = Math.random() * 0.5;
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

  const shaderModule = device.createShaderModule({
    code: shaderSource,
    label: "Combined Shader",
  });

  const renderBindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: {
          type: "uniform",
        },
      },
      {
        binding: 1, // positions
        visibility: GPUShaderStage.VERTEX,
        buffer: {
          type: "read-only-storage",
        },
      },
      {
        binding: 2, // colors
        visibility: GPUShaderStage.VERTEX,
        buffer: {
          type: "read-only-storage",
        },
      },
    ],
  });

  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [renderBindGroupLayout],
  });

  const pipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    label: "Render Pipeline",
    vertex: {
      module: shaderModule,
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
            { format: "float32x3", offset: 0, shaderLocation: 1 }, // normal
          ],
        },
      ],
    },
    fragment: {
      module: shaderModule,
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

  const depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
    label: "Depth Texture",
  });

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

  const colors = new Float32Array(COUNT * 4);
  for (let i = 0; i < COUNT; i++) {
    colors[i * 4] = Math.random();
    colors[i * 4 + 1] = Math.random();
    colors[i * 4 + 2] = Math.random();
    colors[i * 4 + 3] = 1;
  }

  const colorsBuffer = device.createBuffer({
    size: colors.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    label: "Colors Storage Buffer",
  });
  device.queue.writeBuffer(colorsBuffer, 0, colors);

  const indexBuffer = device.createBuffer({
    size: sphereGeometry.indices.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    label: "Index Buffer",
  });
  device.queue.writeBuffer(indexBuffer, 0, sphereGeometry.indices);

  // boids parameters
  const separation = 5.0;
  const alignment = 4.0;
  const cohesion = 10.0;
  const borderForce = 10;
  const speed = 1 / 200;
  let lastTime = performance.now();

  // Create uniform buffer for view/projection matrices and lighting
  const uniformBufferSize = 192; // Size for:
  // - projectionMatrix (mat4x4f): 64 bytes
  // - viewMatrix (mat4x4f): 64 bytes
  // - lightDirection (vec3f + padding): 16 bytes
  // - lightColor (vec3f + padding): 16 bytes
  // - ambientColor (vec3f + padding): 16 bytes
  // Total: 192 bytes, aligned to 256-byte boundary
  const uniformBuffer = device.createBuffer({
    size: uniformBufferSize,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    label: "Uniform Buffer",
  });

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

  // Update uniforms
  const uniformData = new Float32Array(uniformBufferSize / 4);
  uniformData.set(projectionMatrix, 0); // 16 floats
  uniformData.set(viewMatrix, 16); // 16 floats
  uniformData.set(lightDirection, 32); // 3 floats, padded to 4
  uniformData[35] = 0;
  uniformData.set(lightColor, 36); // 3 floats, padded to 4
  uniformData[39] = 0;
  uniformData.set(ambientColor, 40); // 3 floats, padded to 4
  uniformData[43] = 0;

  device.queue.writeBuffer(uniformBuffer, 0, uniformData);

  const renderElement = document.getElementById("render")!;
  const computeElement = document.getElementById("compute")!;
  const jsElement = document.getElementById("js")!;

  // const computeBoids = useBoidsCPU(initialPositions, initialVelocities, FISHES).compute;
  const computeBoids = useBoidsGPU(device, initialPositions, initialVelocities, COUNT).compute;

  /******************************************************************* */
  /***************************** RENDER ********************************/
  /******************************************************************* */

  function drawScene(positionsBuffer: GPUBuffer) {
    const commandEncoder = device.createCommandEncoder({
      label: "Render Command Encoder",
    });
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
      label: "Render Pass",
    });

    renderPass.setPipeline(pipeline);

    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: { buffer: positionsBuffer } },
        { binding: 2, resource: { buffer: colorsBuffer } },
      ],
      label: "Render Bind Group",
    });
    renderPass.setBindGroup(0, bindGroup);

    renderPass.setVertexBuffer(0, positionBuffer);
    renderPass.setVertexBuffer(1, normalBuffer);
    renderPass.setIndexBuffer(indexBuffer, "uint16");

    renderPass.drawIndexed(sphereGeometry.indices.length, COUNT, 0, 0, 0);

    renderPass.end();
    device.queue.submit([commandEncoder.finish()]);
  }

  function render() {
    performance.mark("compute");
    performance.mark("js");

    const currentTime = performance.now();
    const deltaTime = (currentTime - lastTime) * speed;
    lastTime = currentTime;

    computeBoids({
      deltaTime,
      separation,
      alignment,
      cohesion,
      borderForce,
      borderDistance: BOUNDS / 2,
      unpack: false,
    }).then(({ positionsBuffer }) => {
      const compute = performance.measure("compute", "compute");
      computeElement.textContent = compute.duration.toFixed(2) + "ms";

      performance.mark("render");

      drawScene(positionsBuffer);

      const measure = performance.measure("render", "render");
      renderElement.textContent = measure.duration.toFixed(2) + "ms";

      requestAnimationFrame(render);
    });

    const measure = performance.measure("js", "js");
    jsElement.textContent = measure.duration.toFixed(2) + "ms";
  }

  render();
}

window.onload = main;
