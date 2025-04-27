---
theme: seriph
background: "rgb(204,229,255)"
demosBaseUrl: http://localhost:4321
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

<DemoIframe path="/three/fishes?count=10&isolateFirst=true" fallbackTitle="Poisson isolé du groupe" />

---
layout: none
---

<DemoIframe path="/three/fishes?count=10&isolateFirst=false" fallbackTitle="Poisson dans le groupe" />

---
layout: none
---

<DemoIframe path="/webgl/objects" fallbackTitle="Démo WebGL objets" />

---
layout: none
---

<DemoIframe path="/webgpu/boids" fallbackTitle="Démo WebGPU boids" />
