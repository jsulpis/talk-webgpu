---
theme: default
defaults:
  layout: center
colorSchema: light
background: "rgb(204,229,255)"
drawings:
  persist: false
transition: fade
title: "La révolution WebGPU : des animations plus folles, des calculs plus rapides, hors du navigateur ? 🤯"
info: "Présentation sur WebGPU"
layout: statement
---

<div class="text-left absolute text-2xl line-height-1.2 top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] text-center -mt-5">
  <h1 class="w-[32ch] text-[2.5rem]! line-height-[1.2]!">La révolution WebGPU : toute la puissance du GPU, sur le web et en dehors 🚀</h1>
  <strong class="text-3xl mt-8! block">Julien Sulpis</strong>

  <p class="mt-2! mb-2!">Technozaure - Zenika Lyon</p>
  <p class="m-0! text-xl">16/05/2025</p>
</div>

<div class="iframe-container">
  <DemoIframe class="iframe-intro" path="/three/fishes?count=1" />
</div>

<style>
  .iframe-container {
    position: absolute;
    pointer-events: none;
    width: 100%;
    aspect-ratio: 2;
    transform-origin: top left;
    transform: scale(1.3);
    bottom: 0;
    right: 0;
  }
</style>

---
src: ./pages/1-intro.md
---

---
src: ./pages/2-webgl.md
---

---
src: ./pages/3-webgpu.md
---

---
src: ./pages/4-ecosystem.md
---

---
src: ./pages/5-outro.md
---
