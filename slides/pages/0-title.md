---
layout: statement
---

<div class="text-left absolute text-2xl line-height-1.2 top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] text-center -mt-5">
  <h1 class="w-[32ch] text-[2.5rem]! line-height-[1.2]!">La révolution WebGPU : toute la puissance du GPU, sur le web et en dehors 🚀</h1>
  <div class="flex gap-10 items-center">
    <img v-if="$brand.logoVertical" :src="$brand.logoVertical" class="h-22 mt-8" />
    <div>
      <strong class="text-3xl mt-8! block">Julien Sulpis</strong>
      <p v-if="$event.name" class="mt-2! mb-2!">{{ $event.name }}</p>
      <p v-if="$event.date" class="m-0! text-5">{{ $event.date }}</p>
    </div>
  </div>
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
