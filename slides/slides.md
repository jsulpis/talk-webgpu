---
theme: default
defaults:
  layout: center
colorSchema: light
background: "rgb(204,229,255)"
demosBaseUrl: http://localhost:4321
drawings:
  persist: false
transition: fade
title: "La Révolution WebGPU : des animations plus folles, des calculs plus rapides, hors du navigateur ? 🤯"
info: "Présentation sur WebGPU"
layout: statement
---

<div class="text-left absolute text-2xl line-height-1.2 top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] text-center">
  <h1 class="w-[32ch] text-[2.5rem]! line-height-[1.2]!">La Révolution WebGPU : des animations plus folles, des calculs plus rapides,<br/>hors du navigateur ? 🤯</h1>
  <strong class="text-3xl mt-8! block">Julien Sulpis</strong>

  <p class="mt-2! mb-2!">Technozaure - Zenika Lyon</p>
  <p class="m-0! text-xl">16/05/2025</p>
</div>

<RenderWhen :context="['slide']">
  <RenderWhen :context="['visible']">
    <iframe class="absolute pointer-events-none w-full h-full transform-origin-[top_left] scale-130 top-0 left-0" :src="`${$slidev.configs.demosBaseUrl}/three/fishes?count=1`"></iframe>
  </RenderWhen>
</RenderWhen>

---
layout: none
---

<div class="stack">
  <img src="/bob-blender-1.webp" alt="Bob Blender" />
  <img v-click src="/bob-blender-2.webp" alt="Bob Blender" />
</div>

---

<em>clownfish.obj</em>

```md{all|4|13}
# Blender 4.3.2
# www.blender.org
o Clownfish
v 0.122026 -0.286331 -2.217837
v 0.107109 0.113186 -2.216171
v 0.112916 0.221553 -2.204184
v 0.117326 -0.212231 -2.234832
v 0.117692 0.366382 -2.145638
v 0.108552 -0.108615 -2.231897
v 0.116878 0.312832 -2.176359
v 0.126934 -0.356902 -2.197896
...
f 203//309 311//309 352//309 300//309
f 203//310 300//310 355//310 310//310
f 204//311 312//311 351//311 277//311
f 204//312 277//312 348//312 313//312
f 204//313 313//313 358//313 297//313
f 204//314 297//314 361//314 312//314
f 205//315 314//315 344//315 284//315
```

<style>
  .shiki {
    --slidev-code-font-size: 0.85rem;
  }
</style>

---
layout: image
image: /bob-blender-2.webp
---

---
layout: none
---

<div class="stack">
  <img src="/fish-global.png" alt="Bob Blender" />
  <img v-click src="/camera-world.png" alt="Bob Blender" />
  <img v-click src="/camera-view.png" alt="Bob Blender" />
  <img v-click src="/camera-projection.png" alt="Bob Blender" />
</div>

---

$$
\begin{aligned}
\underbrace{
\begin{bmatrix}
x_f \\
y_f \\
z_f \\
1
\end{bmatrix}
}_{\text{Position sur le canvas}}
=
\underbrace{
\begin{bmatrix}
1.8 & 0      & 0      & 0 \\
0       & 2.4 & 0     & 0 \\
0       & 0      & -1 & -0.2 \\
0       & 0      & -1     & 0 \\
\end{bmatrix}
}_{\text{Projection en 2D}}
\times
\underbrace{
\begin{bmatrix}
0.7 & -0.4 & 0.6 & 0 \\
0     & 0.8  & 0.6 & 0 \\
-0.7 & -0.4 & 0.6 & -7 \\
0     & 0      & 0     & 1 \\
\end{bmatrix}
}_{\text{Vue de la caméra}}
\times
\underbrace{
\begin{bmatrix}
1 & 0 & 0 & 2 \\
0 & 1 & 0 & 3 \\
0 & 0 & 1 & 1 \\
0 & 0 & 0 & 1 \\
\end{bmatrix}
}_{\text{Position du modèle}}
\times
\underbrace{
\begin{bmatrix}
x_{i} \\
y_{i} \\
z_{i} \\
1
\end{bmatrix}
}_{\text{Position du sommet}}
\end{aligned}
$$

---

<div class="stack">
  <img class="h-[70%]" src="/pixelate-1.png" alt="vertices" />
  <img class="h-[70%]" v-click src="/pixelate-2.png" alt="triangle" />
  <img class="h-[70%]" v-click src="/pixelate-3.png" alt="pixelated" />
  <img class="h-[70%]" v-click src="/pixelate-4.png" alt="pixels in triangle" />
  <img class="h-[70%]" v-click src="/pixelate-5.png" alt="pixels with color" />
  <img class="h-[70%]" v-click src="/blending.png" alt="blending" />
</div>

---
layout: default
---

# Render Pipeline

<img class="-mt-20 -z-1 scale-110 relative" src="/render-pipeline.png" alt="Render pipeline" />

---
layout: statement
---

# WebGL

---
layout: default
---

# WebGL

<em>main.js</em>

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

# WebGL

<em>main.js</em>

```js {all|1-9|10-18|all}
function setup() {
  gl.createBuffer();
  gl.bindBuffer(...);
  gl.vertexAttribPointer(...); // charge les données du modèle
  gl.enableVertexAttribArray(...);
  ...
  gl.bindFramebuffer(...);
  gl.viewport(...); // règle la taille du canvas
}

function loop() {
  gl.clear(...);
  ...
  gl.uniformMatrix4fv(...); // modifie la position du modèle
  gl.uniform3fv(...);
  ...
  gl.drawElements(...); // dessine le modèle
}
```

<style>
  .shiki {
    --slidev-code-font-size: 0.85rem;
  }
</style>

---
layout: none
---

<DemoIframe path="/three/fishes?count=10&isolateFirst=true&start=offscreen" fallbackTitle="Poisson isolé du groupe" />

---
layout: default
---

# Render Pipeline

<img class="-mt-20 -z-1 scale-110 relative" src="/render-pipeline.png" alt="Render pipeline" />

---
layout: default
---

# WebGL

<em>main.js</em>

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

# WebGL

<em>main.js</em>

````md magic-move
```js
function draw(model) {
  ...
  gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
}
```

```js
function draw(model) {
  ...
  gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
}

function loop() {
  ...
  draw(model1);
  draw(model2);
  ...
}
```
````

<style>
  .shiki {
    --slidev-code-font-size: 0.85rem;
  }
</style>

---
layout: default
---

# WebGL

<img class="mt-5" src="/webgl-cpu-overhead.png" alt="WebGL CPU Overhead" />

---
layout: none
---

<DemoIframe path="/webgl/objects" fallbackTitle="WebGL objets" />

---
layout: none
---

<DemoIframe path="/three/fishes?count=10&isolateFirst=true" fallbackTitle="Poisson dans le groupe" />

---
layout: center
---

# Tuto sociabilité

---
layout: default
---

# Cohésion

<img class="h-100 mx-auto -mt-10" src="/boids-1.png" alt="Cohésion" />

---
layout: default
---

# Alignement

<img class="h-100 mx-auto -mt-10" src="/boids-2.png" alt="Alignement" />

---
layout: default
---

# Séparation

<img class="h-100 mx-auto -mt-10" src="/boids-3.png" alt="Séparation" />

---
layout: none
---

<DemoIframe path="/three/fishes?count=10" fallbackTitle="Poisson avec le groupe" />

---
layout: center
---

# GPGPU

General Purpose computing on Graphics Processing Units

---
layout: default
---

# Render Pipeline

<img class="-mt-20 -z-1 scale-110 relative" src="/render-pipeline.png" alt="Render pipeline" />

---
layout: center
---

<div class="stack">
  <img v-click.hide class="h-80 mx-auto" src="/marin-1.png" alt="Image de Marin" />
  <img v-after class="h-80 mx-auto" src="/marin-2.png" alt="Rectangle avec 2 triangles" />
  <img v-click class="h-80 mx-auto" src="/marin-3.png" alt="Rectangle avec 2 triangles pixellisés" />
</div>

---
layout: default
---

# Render Pipeline

<img class="" src="/gpgpu-pipeline.png" alt="Render pipeline avec image" />

---
layout: default
---

# GPGPU

<img class="" src="/gpgpu-pipeline2.png" alt="Render pipeline avec texture de positions" />

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
  ]" />
</RenderWhen>

---
layout: none
---

<DemoIframe path="/webgl/boids" fallbackTitle="WebGL boids" delay="1s" />

---
layout: default
---

# WebGL : les inconvénients

<v-clicks>

- API proche du C
- état global
- surcharge CPU sur les grosses scènes
- pixelliser des triangles pour faire des calculs

</v-clicks>

<style>
  ul {
    font-size: 1.25em;

    li {
      padding-left: .5em;
    }
  }
</style>

---
layout: center
---

<div class="stack">
  <img class="w-full scale-110 mx-auto" src="/graphics-api-1.png" alt="timeline" />
  <img v-click class="w-full scale-110 mx-auto" src="/graphics-api-2.png" alt="webgl 1.0" />
  <img v-click class="w-full scale-110 mx-auto" src="/graphics-api-3.png" alt="opengl es 2.0" />
  <img v-click class="w-full scale-110 mx-auto" src="/graphics-api-4.png" alt="opengl 2.0" />
  <img v-click class="w-full scale-110 mx-auto" src="/graphics-api-5.png" alt="webgl 2.0" />
  <img v-click class="w-full scale-110 mx-auto" src="/graphics-api-6.png" alt="vulkan" />
  <img v-click class="w-full scale-110 mx-auto" src="/graphics-api-7.png" alt="metal - directx12" />
  <img v-click="['+1', '+1']" class="w-full scale-110 mx-auto" src="/graphics-api-8.png" alt="webgpu - 1" />
  <img v-after class="w-full scale-110 mx-auto" src="/graphics-api-9.png" alt="webgpu - 2" />
</div>

---
layout: center
---

# Can I Use ? No.

<img src="/caniuse.png" alt="WebGPU support" />
<span v-click class="absolute right-20 top-20 text-5xl">😎</span>

---
layout: statement
---

# WebGPU

---
layout: center
---

<img class="h-80" src="/webgpu-diagram.png" alt="WebGPU diagram" />

---
layout: default
---

# Render Pipeline

<img class="-mt-20 -z-1 scale-110 relative" src="/render-pipeline.png" alt="Render pipeline" />

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

<Youtube id="gKTQ3VWn0cU?start=3"  width="100%" height="100%" />

<style>
  iframe {
    margin: auto;
  }
</style>

---
layout: default
---

# WebGPU Render Bundles

```ts{1-10|12,16}
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

---
layout: statement
---

# Écosystème WebGPU

---
layout: center
---

<img class="h-80" src="/webgpu-diagram.png" alt="WebGPU diagram" />

---
layout: center
---

<div class="stack">
  <img class="h-90 scale- mx-auto" src="/webgpu-browsers-1.png" alt="timeline" />
  <img v-click class="h-90 scale- mx-auto" src="/webgpu-browsers-2.png" alt="webgl 1.0" />
  <img v-click class="h-90 scale- mx-auto" src="/webgpu-browsers-3.png" alt="opengl es 2.0" />
  <img v-click class="h-90 scale- mx-auto" src="/webgpu-browsers-4.png" alt="opengl 2.0" />
</div>

---
layout: center
---

<img class="h-full" src="/webgpu-ecosystem.png" alt="WebGPU diagram" />

<a class="absolute top-1 ml-2 text-sm" href="https://developer.chrome.com/blog/webgpu-ecosystem" target="_blank">
  https://developer.chrome.com/blog/webgpu-ecosystem
</a>

---
layout: center
---

<div class="grid grid-cols-2 place-items-center gap-10">
  <div>
    <h1>Julien Sulpis</h1>
    <p class="socials">
      <strong>@jsulpis </strong>
      <a href="https://github.com/jsulpis">
        <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="256px" height="250px" viewBox="0 0 256 250" version="1.1" preserveAspectRatio="xMidYMid"><title>GitHub</title><g><path d="M128.00106,0 C57.3172926,0 0,57.3066942 0,128.00106 C0,184.555281 36.6761997,232.535542 87.534937,249.460899 C93.9320223,250.645779 96.280588,246.684165 96.280588,243.303333 C96.280588,240.251045 96.1618878,230.167899 96.106777,219.472176 C60.4967585,227.215235 52.9826207,204.369712 52.9826207,204.369712 C47.1599584,189.574598 38.770408,185.640538 38.770408,185.640538 C27.1568785,177.696113 39.6458206,177.859325 39.6458206,177.859325 C52.4993419,178.762293 59.267365,191.04987 59.267365,191.04987 C70.6837675,210.618423 89.2115753,204.961093 96.5158685,201.690482 C97.6647155,193.417512 100.981959,187.77078 104.642583,184.574357 C76.211799,181.33766 46.324819,170.362144 46.324819,121.315702 C46.324819,107.340889 51.3250588,95.9223682 59.5132437,86.9583937 C58.1842268,83.7344152 53.8029229,70.715562 60.7532354,53.0843636 C60.7532354,53.0843636 71.5019501,49.6441813 95.9626412,66.2049595 C106.172967,63.368876 117.123047,61.9465949 128.00106,61.8978432 C138.879073,61.9465949 149.837632,63.368876 160.067033,66.2049595 C184.49805,49.6441813 195.231926,53.0843636 195.231926,53.0843636 C202.199197,70.715562 197.815773,83.7344152 196.486756,86.9583937 C204.694018,95.9223682 209.660343,107.340889 209.660343,121.315702 C209.660343,170.478725 179.716133,181.303747 151.213281,184.472614 C155.80443,188.444828 159.895342,196.234518 159.895342,208.176593 C159.895342,225.303317 159.746968,239.087361 159.746968,243.303333 C159.746968,246.709601 162.05102,250.70089 168.53925,249.443941 C219.370432,232.499507 256,184.536204 256,128.00106 C256,57.3066942 198.691187,0 128.00106,0 Z M47.9405593,182.340212 C47.6586465,182.976105 46.6581745,183.166873 45.7467277,182.730227 C44.8183235,182.312656 44.2968914,181.445722 44.5978808,180.80771 C44.8734344,180.152739 45.876026,179.97045 46.8023103,180.409216 C47.7328342,180.826786 48.2627451,181.702199 47.9405593,182.340212 Z M54.2367892,187.958254 C53.6263318,188.524199 52.4329723,188.261363 51.6232682,187.366874 C50.7860088,186.474504 50.6291553,185.281144 51.2480912,184.70672 C51.8776254,184.140775 53.0349512,184.405731 53.8743302,185.298101 C54.7115892,186.201069 54.8748019,187.38595 54.2367892,187.958254 Z M58.5562413,195.146347 C57.7719732,195.691096 56.4895886,195.180261 55.6968417,194.042013 C54.9125733,192.903764 54.9125733,191.538713 55.713799,190.991845 C56.5086651,190.444977 57.7719732,190.936735 58.5753181,192.066505 C59.3574669,193.22383 59.3574669,194.58888 58.5562413,195.146347 Z M65.8613592,203.471174 C65.1597571,204.244846 63.6654083,204.03712 62.5716717,202.981538 C61.4524999,201.94927 61.1409122,200.484596 61.8446341,199.710926 C62.5547146,198.935137 64.0575422,199.15346 65.1597571,200.200564 C66.2704506,201.230712 66.6095936,202.705984 65.8613592,203.471174 Z M75.3025151,206.281542 C74.9930474,207.284134 73.553809,207.739857 72.1039724,207.313809 C70.6562556,206.875043 69.7087748,205.700761 70.0012857,204.687571 C70.302275,203.678621 71.7478721,203.20382 73.2083069,203.659543 C74.6539041,204.09619 75.6035048,205.261994 75.3025151,206.281542 Z M86.046947,207.473627 C86.0829806,208.529209 84.8535871,209.404622 83.3316829,209.4237 C81.8013,209.457614 80.563428,208.603398 80.5464708,207.564772 C80.5464708,206.498591 81.7483088,205.631657 83.2786917,205.606221 C84.8005962,205.576546 86.046947,206.424403 86.046947,207.473627 Z M96.6021471,207.069023 C96.7844366,208.099171 95.7267341,209.156872 94.215428,209.438785 C92.7295577,209.710099 91.3539086,209.074206 91.1652603,208.052538 C90.9808515,206.996955 92.0576306,205.939253 93.5413813,205.66582 C95.054807,205.402984 96.4092596,206.021919 96.6021471,207.069023 Z" fill="currentColor"/></g></svg>
      </a>
      <a href="https://bsky.app/profile/jsulpis.dev">
        <svg xmlns="http://www.w3.org/2000/svg" width="256px" height="226px" viewBox="0 0 256 226" version="1.1" preserveAspectRatio="xMidYMid"><title>Bluesky</title><g><path d="M55.4911549,15.1724797 C84.8410141,37.2065079 116.408338,81.8843671 128,105.858226 C139.591662,81.8843671 171.158986,37.2065079 200.508845,15.1724797 C221.686085,-0.726562511 256,-13.0280836 256,26.1164797 C256,33.9343952 251.517746,91.7899445 248.888789,101.183522 C239.750761,133.838395 206.452732,142.167409 176.832451,137.126283 C228.607099,145.938001 241.777577,175.125607 213.333183,204.313212 C159.311775,259.746226 135.689465,190.40493 129.636507,172.637268 C128.526873,169.380029 128.007662,167.856198 128,169.151973 C127.992338,167.856198 127.473127,169.380029 126.363493,172.637268 C120.310535,190.40493 96.6882254,259.746226 42.6668169,204.313212 C14.2224225,175.125607 27.3929014,145.938001 79.1675493,137.126283 C49.5472676,142.167409 16.2492394,133.838395 7.11121127,101.183522 C4.48225352,91.7899445 0,33.9343952 0,26.1164797 C0,-13.0280836 34.3139155,-0.726562511 55.4911549,15.1724797 Z" fill="currentColor"/></g></svg>
      </a>
      <a href="https://www.linkedin.com/in/julien-sulpis/">
        <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="256px" height="256px" viewBox="0 0 256 256" version="1.1" preserveAspectRatio="xMidYMid"><title>LinkedIn</title><g><path d="M218.123122,218.127392 L180.191928,218.127392 L180.191928,158.724263 C180.191928,144.559023 179.939053,126.323993 160.463756,126.323993 C140.707926,126.323993 137.685284,141.757585 137.685284,157.692986 L137.685284,218.123441 L99.7540894,218.123441 L99.7540894,95.9665207 L136.168036,95.9665207 L136.168036,112.660562 L136.677736,112.660562 C144.102746,99.9650027 157.908637,92.3824528 172.605689,92.9280076 C211.050535,92.9280076 218.138927,118.216023 218.138927,151.114151 L218.123122,218.127392 Z M56.9550587,79.2685282 C44.7981969,79.2707099 34.9413443,69.4171797 34.9391618,57.260052 C34.93698,45.1029244 44.7902948,35.2458562 56.9471566,35.2436736 C69.1040185,35.2414916 78.9608713,45.0950217 78.963054,57.2521493 C78.9641017,63.090208 76.6459976,68.6895714 72.5186979,72.8184433 C68.3913982,76.9473153 62.7929898,79.26748 56.9550587,79.2685282 M75.9206558,218.127392 L37.94995,218.127392 L37.94995,95.9665207 L75.9206558,95.9665207 L75.9206558,218.127392 Z M237.033403,0.0182577091 L18.8895249,0.0182577091 C8.57959469,-0.0980923971 0.124827038,8.16056231 -0.001,18.4706066 L-0.001,237.524091 C0.120519052,247.839103 8.57460631,256.105934 18.8895249,255.9977 L237.033403,255.9977 C247.368728,256.125818 255.855922,247.859464 255.999,237.524091 L255.999,18.4548016 C255.851624,8.12438979 247.363742,-0.133792868 237.033403,0.000790807055" fill="currentColor"/></g></svg>
      </a>
    </p>
    <p>Tech Lead - Consultant Web</p>

  </div>
  <div class="h-full grid place-items-center relative grid-rows-1">
    <img class="h-90" src="/qr-code.png" alt="qr code with links" />
      <RenderWhen :context="['slide']">
        <RenderWhen :context="['visible']">
          <iframe class="absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%]" :src="`${$slidev.configs.demosBaseUrl}/three/fish`"></iframe>
        </RenderWhen>
      </RenderWhen>
    <a href="https://bento.me/jsulpis-talk-webgpu" target="_blank" class="absolute top-[98%]">
      bento.me/jsulpis-talk-webgpu
    </a>
  </div>
</div>

<style>
  svg {
    display: inline;
    height: 1em;
    width: auto;
  }

  h1 {
    margin-bottom: .5rem !important;
  }

  p {
    opacity: 1 !important;
  }

  .socials {
    display: flex;
    gap: .5em;
    align-items: center;
    margin-block: 0 1rem !important;
  }
</style>
