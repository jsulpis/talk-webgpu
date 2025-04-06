import { resolveTimingQuery, initTimingObjects, readTimingBuffer, useBoidsGPU } from "../boids/webgpu";
import { loadOBJ } from "./models/objLoader";
import {
  boidsUniforms,
  colors,
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

const shaderSource = /* wgsl */ `
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

document.getElementById("objects")!.innerText = COUNT.toString();
document.getElementById("api")!.innerText = "WebGPU";

async function main() {
  if (!navigator.gpu) {
    console.error("WebGPU not supported");
    return;
  }

  const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
  if (!adapter) {
    console.error("No GPU adapter found");
    return;
  }

  const device = await adapter.requestDevice({
    requiredFeatures: ["timestamp-query"],
  });

  const { querySet, resolveBuffer, resultBuffer, timestampWrites } = initTimingObjects(device);

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

  const uniformData = new Float32Array(uniformBufferSize / 4);
  uniformData.set(renderUniforms.projectionMatrix, 0); // 16 floats
  uniformData.set(renderUniforms.viewMatrix, 16); // 16 floats
  uniformData.set(renderUniforms.lightDirection, 32); // 3 floats, padded to 4
  uniformData[35] = 0;
  uniformData.set(renderUniforms.lightColor, 36); // 3 floats, padded to 4
  uniformData[39] = 0;
  uniformData.set(renderUniforms.ambientColor, 40); // 3 floats
  uniformData[43] = renderUniforms.scale;

  device.queue.writeBuffer(uniformBuffer, 0, uniformData);

  const computeBoids = useBoidsGPU(device, initialPositions, initialVelocities, colorsBuffer, COUNT);

  function drawScene(positionsBuffer: GPUBuffer, velocitiesBuffer: GPUBuffer) {
    const commandEncoder = device.createCommandEncoder({
      label: "Render Command Encoder",
    });
    const renderPass = commandEncoder.beginRenderPass({
      label: "Render Pass",
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
      timestampWrites,
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
    resolveTimingQuery(querySet, resultBuffer, commandEncoder, resolveBuffer);
    device.queue.submit([commandEncoder.finish()]);

    readTimingBuffer(resultBuffer).then((measure) => {
      if (measure && measure > 0) {
        renderTime.addValue(measure);
        renderElement.textContent = renderTime.getAverage().toFixed(1) + "ms";
      }
    });
  }

  function render() {
    const currentTime = performance.now();
    boidsUniforms.deltaTime = (currentTime - lastTime) * speed;

    const { positionsBuffer, velocitiesBuffer } = computeBoids(boidsUniforms);

    drawScene(positionsBuffer, velocitiesBuffer);

    jsTime.addValue(performance.now() - currentTime);
    jsElement.textContent = jsTime.getAverage().toFixed(1) + "ms";

    lastTime = currentTime;
    requestAnimationFrame(render);
  }

  render();
}

window.onload = main;
