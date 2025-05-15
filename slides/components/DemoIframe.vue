<script setup lang="ts">
defineProps<{
  path: string;
  fallbackTitle: string;
  delay?: string;
}>();

const demosBaseUrl = import.meta.env.VITE_DEMOS_BASE_URL;
</script>

<template>
  <RenderWhen :context="['slide']">
    <RenderWhen :context="['visible']">
      <iframe :src="`${demosBaseUrl}${path}`"></iframe>
    </RenderWhen>
    <template #fallback v-if="fallbackTitle">
      <h1 class="fallback">&lt;iframe /&gt; : {{ fallbackTitle }}</h1>
    </template>
  </RenderWhen>
</template>

<style>
:where([frontmatter]:has(iframe, h1.fallback)) {
  display: grid;

  &,
  & > div {
    height: 100%;
    width: 100%;
  }

  & > h1 {
    font-size: 2.5rem;
    place-self: center;
    text-align: center;
  }
}

div:has(> iframe),
iframe {
  height: 100%;
  width: 100%;
}

iframe {
  animation: fadeIn 800ms both;
  animation-delay: v-bind(delay);
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
}
</style>
