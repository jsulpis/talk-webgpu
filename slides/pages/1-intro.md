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

<div class="stack -translate-y-10">
  <img v-click.hide class="transition-duration-0 scale-110" src="/render-pipeline-base.png" alt="Render pipeline" />
  <img v-after class="transition-duration-0 scale-110" src="/render-pipeline.png" alt="Render pipeline" />
</div>
