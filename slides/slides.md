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
---

# {{$slidev.configs.title}}

---
layout: none
---

<DemoIframe path="/three/fishes?count=1" fallbackTitle="Poisson seul" />

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

<em>vertex.glsl</em>

```glsl{all|1|3-5|7-9|all}
in vec4 aPosition;

uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

void main() {
  gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * aPosition;
}
```

---

<div class="stack">
  <img class="h-[70%]" src="/pixelate-1.png" alt="vertices" />
  <img class="h-[70%]" v-click src="/pixelate-2.png" alt="triangle" />
  <img class="h-[70%]" v-click src="/pixelate-3.png" alt="pixelated" />
  <img class="h-[70%]" v-click src="/pixelate-4.png" alt="pixels in triangle" />
</div>

---

<em>fragment.glsl</em>

```glsl{all|1-3|6-9|all}
uniform sampler2D uColorTexture;
uniform vec4 uLightColor;
uniform vec3 uLightDirection;
...

void main() {
  vec4 color = ...;
  gl_FragColor = color;
}
```

<style>
  .shiki {
    --slidev-code-font-size: 1rem;
  }
</style>

---

<div class="stack">
  <img class="h-[70%]" src="/blending.png" alt="blending" />
</div>

---
layout: default
---

# Render Pipeline

<img class="-mt-20 -z-1 scale-110 relative" src="/render-pipeline.png" alt="Render pipeline" />

---

# WebGL

---
layout: default
---

# WebGL

<em>main.js</em>

```js
const canvas = document.querySelector("canvas");
const gl = canvas.getContext("webgl2");
```

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
layout: image-right
image: /render-pipeline.png
backgroundSize: contain
---

# WebGL

<em>main.js</em>

```js
gl.bindFramebuffer(...);
gl.viewport(...);
gl.clearColor(...);
gl.clear(...);
...
gl.bindBuffer(...);
gl.vertexAttribPointer(...);
gl.enableVertexAttribArray(...);
...
gl.useProgram(...);
gl.uniformMatrix4fv(...);
gl.uniformMatrix4fv(...);
gl.uniform3fv(...);
gl.uniform3fv(...);
...
gl.bindBuffer(...);
gl.drawElements(...);
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

<DemoIframe path="/three/fishes?count=10&isolateFirst=true" fallbackTitle="Poisson isolé du groupe" />

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

<DemoIframe path="/three/fishes?count=10&isolateFirst=false" fallbackTitle="Poisson dans le groupe" />

---
layout: none
---

<DemoIframe path="/webgl/boids" fallbackTitle="Démo WebGL boids" />

---
layout: none
---

<DemoIframe path="/webgpu/objects" fallbackTitle="Démo WebGPU objets" />

---
layout: none
---

<DemoIframe path="/webgpu/boids" fallbackTitle="Démo WebGPU boids" />
