---
layout: statement
---

<h1>Web<span class="gpu">GPU</span></h1>

---
layout: center
---

<img class="h-80" src="/webgpu-diagram.png" alt="WebGPU diagram" />

---
layout: default
---

# Render Pipeline

<img class="mt-8 scale-110" src="/render-pipeline.png" alt="Render pipeline" />

---
layout: default
---

# API WebGL

```js
gl.bindFramebuffer(gl.FRAMEBUFFER, null);
gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
gl.clearColor(1, 1, 1, 1);
gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
...
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.vertexAttribPointer(vertexPosition, 3, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(vertexPosition);
...
gl.useProgram(program);
gl.uniformMatrix4fv(projectionMatrix, false, uniforms.projectionMatrix);
gl.uniformMatrix4fv(viewMatrix, false, uniforms.viewMatrix);
gl.uniform3fv(lightDirection, uniforms.lightDirection);
gl.uniform3fv(lightColor, uniforms.lightColor);
...
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
```

<style>
  .shiki {
    --slidev-code-font-size: 0.85rem;
  }
</style>

---
layout: default
---

# API WebGPU

```js
const pipeline = device.createRenderPipeline({
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
    ],
  },
  ...
  primitive: {
    topology: "triangle-list",
    cullMode: "back",
  },
});
```

<style>
  .shiki {
    --slidev-code-font-size: 0.85rem;
  }
</style>

---
layout: default
---

# API WebGPU

```js {all|1-5|7-20}
function setup() {
  const pipeline = device.createRenderPipeline(...);
  const bindGroup = device.createBindGroup(...);
  ...
}

function loop() {
  const commandEncoder = device.createCommandEncoder();
  const renderPass = commandEncoder.beginRenderPass(...);

  renderPass.setPipeline(pipeline);
  renderPass.setVertexBuffer(0, positionBuffer);
  renderPass.setBindGroup(0, bindGroup);
  renderPass.draw(...);
  renderPass.end();

  device.queue.submit([commandEncoder.finish()]);
}
```

<style>
  .shiki {
    --slidev-code-font-size: 0.85rem;
  }
</style>

---
layout: default
---

# WebGPU

<img class="mt-8" src="/webgpu-cpu-overhead.png" alt="WebGPU CPU Overhead" />

---
layout: none
---

<DemoIframe path="/webgl/objects?count=15000" fallbackTitle="WebGL objets" />

---
layout: none
---

<DemoIframe path="/webgpu/objects" fallbackTitle="WebGPU objets" />

---
layout: none
---

<Youtube id="gKTQ3VWn0cU?start=3&mute=1&rel=0"  width="100%" height="100%"  />

<style>
  iframe {
    margin: auto;
  }
</style>

---
layout: default
---

# WebGPU Render Bundles

```ts{all|1-10|12,16}
function setup() {
  const bundleEncoder = device.createRenderBundleEncoder(...);
  for (let object of objects) {
    bundleEncoder.setPipeline(pipeline);
    bundleEncoder.setVertexBuffer(0, positionBuffer);
    bundleEncoder.setBindGroup(0, object.bindGroup);
    bundleEncoder.draw(...);
  }
  renderBundle = bundleEncoder.finish();
}

function loop() {
  const commandEncoder = device.createCommandEncoder();
  const renderPass = commandEncoder.beginRenderPass(...);

  renderPass.executeBundles([renderBundle]);

  renderPass.end();
  device.queue.submit([commandEncoder.finish()]);
}
```

<style>
  .shiki {
    --slidev-code-font-size: 0.85rem;
  }
</style>

---
layout: default
---

# WebGPU Render Bundles

Rendu de scènes complexes en temps CPU constant 🎉

<img class="mt-15" src="/webgpu-render-bundle.png" alt="WebGPU Render Bundle" />

---
layout: center
---

# GPGPU

General Purpose computing on Graphics Processing Units

---
layout: default
---

# WebGL - GPGPU

<img class="" src="/gpgpu-pipeline2.png" alt="Render pipeline avec texture de positions" />

---
layout: default
---

# WebGPU - Compute Pipeline

<img class="mt-10" src="/compute-pipeline.png" alt="WebGPU CPU Overhead" />

---
layout: default
---

# WebGPU - Compute Pipeline

```ts
const computePipeline = device.createComputePipeline({
  layout: "auto",
  compute: {
    module: device.createShaderModule({
      label: "Compute Shader",
      code: computeShaderSource,
    }),
    entryPoint: "main",
  },
});
```

---
layout: default
---

# Compute Shader

<em>compute.wgsl</em>

```wgsl {all|1-2|3-10|all}
@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, write> output: array<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let index = id.x;
  output[index] = input[index] * 2.0;
}
```

---
layout: default
---

# GPGPU

Calcul de la nouvelle position des poissons

<RenderWhen :context="['visible']">
  <LineGraph :datasets="[
    {
      label: 'JavaScript',
      borderDash: [],
      data: [1.4, 2.4, 9.9, 37],
      color: `hsl(40deg 90% 60%)`,
    }, 
    {
      label: 'WebGL',
      borderDash: [2, 6],
      data: [0.2, 0.4, 1.2, 2.6],
      color: `hsl(200deg 80% 45%)`,
    }, 
    {
      label: 'WebGPU',
      borderDash: [12, 8],
      data: [0.1, 0.2, 0.6, 1.1],
      color: `hsl(0deg 80% 45%)`,
    }
  ]" />
</RenderWhen>

---
layout: none
---

<DemoIframe path="/webgpu/boids" fallbackTitle="WebGPU boids" delay="500ms" />

---
layout: default
---

# Compute Pipeline

<img mt-13 src="/compute-pipeline.png" alt="WebGPU Compute Pipeline" />

---
layout: default
---

# Compute Pipeline

## Traitement d'image

<img src="/compute-pictures.png" alt="Traitement d'images avec un compute shader" />

---
layout: default
---

# Compute Pipeline

<h2>Maths<span v-click>, physique, graphes, IA...</span></h2>

<img src="/compute-matrices.png" alt="Multiplication de matrices avec un compute shader" />

---
layout: center
---

| **WebGL**                    | **WebGPU**                               |
| ---------------------------- | ---------------------------------------- |
| syntaxe proche du C          | objets JS, Promise                       |
| état global                  | opérations encapsulées dans des "passes" |
| surcharge CPU                | charge CPU très réduite (render bundles) |
| calculs via fragment shaders | calculs via compute shaders              |

<style>
  td, th {
    font-size: 1.2em;
    padding-inline: 2rem;
  }
</style>
