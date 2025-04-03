import { mat4 } from "gl-matrix";
import { useBoidsGPU } from "../boids/webgpu";
import { createSphereGeometry } from "./models/sphere";
import { loadOBJ } from "./models/objLoader";

const COUNT = 1000;
const BOUNDS = 100;

const shaderSource = `
struct Uniforms {
  projectionMatrix: mat4x4f,
  viewMatrix: mat4x4f,
  lightDirection: vec3f,
  lightColor: vec3f,
  ambientColor: vec3f,
  scale: f32,
}

@binding(0) @group(0) var<uniform> uniforms: Uniforms;
@binding(1) @group(0) var<storage, read> positions: array<vec3f>;
@binding(2) @group(0) var<storage, read> velocities: array<vec3f>;
@binding(3) @group(0) var<storage, read> colors: array<vec4f>;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) color: vec4f,
}

@vertex
fn vertexMain(
  @location(0) position: vec4f,
  @location(1) normal: vec3f,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOutput {
  var output: VertexOutput;
  let modelPosition = vec4f(positions[instanceIndex], 1.0);
  let scale = uniforms.scale;

  // Construct a rotation matrix that aligns the object's forward axis with the velocity direction
  let velocity = velocities[instanceIndex];
  let forward = normalize(velocity);
  let right = normalize(cross(vec3f(0.0, 1.0, 0.0), forward));
  let up = cross(forward, right);

  let rotationMatrix = mat4x4f(
    right.x, right.y, right.z, 0.0,
    up.x, up.y, up.z, 0.0,
    forward.x, forward.y, forward.z, 0.0,
    0.0, 0.0, 0.0, 1.0
  );

  let modelMatrix = mat4x4f(
    scale * rotationMatrix[0][0], scale * rotationMatrix[0][1], scale * rotationMatrix[0][2], 0.0,
    scale * rotationMatrix[1][0], scale * rotationMatrix[1][1], scale * rotationMatrix[1][2], 0.0,
    scale * rotationMatrix[2][0], scale * rotationMatrix[2][1], scale * rotationMatrix[2][2], 0.0,
    modelPosition.x, modelPosition.y, modelPosition.z, 1.0
  );
  let modelViewMatrix = uniforms.viewMatrix * modelMatrix;

  output.position = uniforms.projectionMatrix * modelViewMatrix * position;

  let color = colors[instanceIndex];
  let vertexNormal = (modelViewMatrix * vec4f(normal, 0.0)).xyz;
  let lightDirection = (uniforms.viewMatrix * vec4f(uniforms.lightDirection, 0.0)).xyz;
  let diffuse = uniforms.lightColor * max(dot(vertexNormal, lightDirection), 0.0);
  let ambient = uniforms.ambientColor;
  output.color = vec4f((diffuse + ambient) * color.rgb, color.a);

  return output;
}

@fragment
fn fragmentMain(@location(0) color: vec4f) -> @location(0) vec4f {
  return color;
}
`;

/******************************************************************* */
/***************************** INIT **********************************/
/******************************************************************* */

document.getElementById("objects")!.innerText = COUNT.toString();
document.getElementById("api")!.innerText = "WebGPU";

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
    label: "Render Bind Group Layout",
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
        binding: 2, // velocities
        visibility: GPUShaderStage.VERTEX,
        buffer: {
          type: "read-only-storage",
        },
      },
      {
        binding: 3, // colors
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

  // const geometry = createSphereGeometry(1.0);
  const geometry = await loadOBJ("fish.obj");

  const positionBuffer = device.createBuffer({
    size: geometry.positions.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    label: "Position Vertex Buffer",
  });
  device.queue.writeBuffer(positionBuffer, 0, geometry.positions);

  const normalBuffer = device.createBuffer({
    size: geometry.normals.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    label: "Normal Vertex Buffer",
  });
  device.queue.writeBuffer(normalBuffer, 0, geometry.normals);

  const colorsBuffer = device.createBuffer({
    size: colors.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    label: "Colors Storage Buffer",
  });
  device.queue.writeBuffer(colorsBuffer, 0, colors);

  const indexBuffer = device.createBuffer({
    size: geometry.indices.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    label: "Index Buffer",
  });
  device.queue.writeBuffer(indexBuffer, 0, geometry.indices);

  // boids parameters
  const separationDistance = 8.0;
  const alignmentDistance = 6.0;
  const cohesionDistance = 8.0;
  const borderForce = 0.3;
  const borderDistance = 50.0;
  const scale = 1;

  const speed = 0.015;
  let lastTime = performance.now();

  // Create uniform buffer for view/projection matrices and lighting
  const uniformBufferSize = 196; // Size for:
  // - projectionMatrix (mat4x4f): 64 bytes
  // - viewMatrix (mat4x4f): 64 bytes
  // - lightDirection (vec3f + padding): 16 bytes
  // - lightColor (vec3f + padding): 16 bytes
  // - ambientColor (vec3f + padding): 16 bytes
  // - scale (float): 4 bytes
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
  mat4.translate(viewMatrix, viewMatrix, [0, 0, -BOUNDS * 2]);
  mat4.rotateX(viewMatrix, viewMatrix, Math.PI / 6);

  const lightDirection = [0.5, 0.7, 0];
  const lightColor = [1.5, 1.5, 1.5];
  const ambientColor = [0.2, 0.2, 0.2];

  // Update uniforms
  const uniformData = new Float32Array(uniformBufferSize / 4);
  uniformData.set(projectionMatrix, 0); // 16 floats
  uniformData.set(viewMatrix, 16); // 16 floats
  uniformData.set(lightDirection, 32); // 3 floats, padded to 4
  uniformData[35] = 0;
  uniformData.set(lightColor, 36); // 3 floats, padded to 4
  uniformData[39] = 0;
  uniformData.set(ambientColor, 40); // 3 floats
  uniformData[43] = scale;

  device.queue.writeBuffer(uniformBuffer, 0, uniformData);

  const renderElement = document.getElementById("render")!;
  const computeElement = document.getElementById("compute")!;
  const jsElement = document.getElementById("js")!;

  const computeBoids = useBoidsGPU(device, initialPositions, initialVelocities, colorsBuffer, COUNT);

  /******************************************************************* */
  /***************************** RENDER ********************************/
  /******************************************************************* */

  function drawScene(positionsBuffer: GPUBuffer, velocitiesBuffer: GPUBuffer) {
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
        { binding: 2, resource: { buffer: velocitiesBuffer } },
        { binding: 3, resource: { buffer: colorsBuffer } },
      ],
      label: "Render Bind Group",
    });
    renderPass.setBindGroup(0, bindGroup);

    renderPass.setVertexBuffer(0, positionBuffer);
    renderPass.setVertexBuffer(1, normalBuffer);
    renderPass.setIndexBuffer(indexBuffer, "uint16");

    renderPass.drawIndexed(geometry.indices.length, COUNT, 0, 0, 0);

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
      separationDistance,
      alignmentDistance,
      cohesionDistance,
      borderForce,
      borderDistance,
      bounds: BOUNDS,
    }).then(({ positionsBuffer, velocitiesBuffer }) => {
      const compute = performance.measure("compute", "compute");
      computeElement.textContent = compute.duration.toFixed(2) + "ms";

      performance.mark("render");

      drawScene(positionsBuffer, velocitiesBuffer);

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
