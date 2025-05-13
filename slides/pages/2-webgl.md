---
layout: statement
---

<div class="container">
  <h1>Web<span class="gl">GL</span></h1>
  <h1>Web<span class="gpu">GPU</span></h1>
</div>
 
<style>
.container {
  position: relative;
  display: grid;
  place-items: center;
}
h1:first-child {
  animation:
    slide 2.5s 0.5s both cubic-bezier(0.5, 0, 0, 1),
    slideWebGL 1.5s 0.2s both cubic-bezier(0.4, 0, 0.2, 1);
}
h1:last-child {
  position: absolute;
  animation:
    slide 2.5s 0.5s both cubic-bezier(0.5, 0, 0, 1),
    slideWebGPU 1.5s 0.2s both ease-in;
}
@keyframes slide {
  from {
    transform: translateY(-80%);
  }
}
@keyframes slideWebGL {
  0% {
    opacity: 0;
  }
  50% {
    opacity: 0;
  }
  90% {
    opacity: 1;
  }
}
@keyframes slideWebGPU {
  0%, 20% {
    opacity: 0;
  }
  55% {
    opacity: 0.3;
  }
  70% {
    animation-timing-function: ease-out;
    opacity: 0;
  }
  100% {
    opacity: 0;
  }
}
</style>

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

<img class="mt-8 scale-110" src="/render-pipeline.png" alt="Render pipeline" />

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

<img class="mt-8 scale-110" src="/render-pipeline.png" alt="Render pipeline" />

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
<img v-click="['+1', '+1']" src="/gif-marin.gif" />

<style>
  img {
    mask-image: linear-gradient(to right, transparent 50%, black 50%);
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-75%, -50%);
  }
</style>

---
layout: default
---

# WebGL : les inconvénients

<v-clicks>

- API verbeuse, éloignée du JavaScript moderne
- état global difficile à gérer
- surcharge CPU sur les grosses scènes
- pixelliser des triangles pour faire des calculs

</v-clicks>

<style>
  ul {
    font-size: 1.25em;
    margin-top: 2em;

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
