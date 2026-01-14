---
layout: center
---

<div :class="['grid place-items-center', $event.qrCodeUrl && 'grid-cols-2']">
  <div>
    <h1>Julien Sulpis</h1>
    <p>Tech Lead - Consultant Web</p>
    <div class="flex gap-4 items-center">
      <a href="https://github.com/jsulpis">
        <fa6-brands-github/>
      </a>
      <a href="https://bsky.app/profile/jsulpis.dev">
        <fa6-brands-bluesky/>
      </a>
      <a href="https://www.linkedin.com/in/julien-sulpis/">
        <fa6-brands-linkedin/>
      </a>
      <strong>&middot;</strong>
      <a href="https://www.jsulpis.dev/fr">www.jsulpis.dev</a>
    </div>
    <img v-if="$brand.logoHorizontal" class="h-12 mt-8 ml-5" :src="$brand.logoHorizontal" alt="Logo Zenika" />
  </div>

  <div v-if="$event.qrCodeUrl" class="h-full grid place-items-center relative grid-rows-1">
    <img class="h-90 mx-6" :src="$event.qrCodeUrl" alt="qr code with links" />
    <div class="iframe-container">
      <DemoIframe class="iframe-intro" path="/three/fish" />
    </div>
    <a :href="$event.referencesUrl" target="_blank" class="absolute text-xs top-[98%]">
      {{ $event.referencesUrl.replace('https://', '') }}
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

  h1, a {
    font-weight: 500;
  }

  p {
    opacity: 1 !important;
  }

  .iframe-container {
    position: absolute;
    pointer-events: none;
    width: 80%;
    aspect-ratio: 2;
    top: 50%;
    left: 50%;
    transform:  translate(-50%, -50%);
  }
</style>
