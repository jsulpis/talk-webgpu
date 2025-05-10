<script setup lang="ts">
defineProps<{
  path: string;
  fallbackTitle: string;
  delay?: string;
}>();
</script>

<template>
  <RenderWhen :context="['slide']">
    <RenderWhen :context="['visible']">
      <iframe :src="`${$slidev.configs.demosBaseUrl}${path}`"></iframe>
    </RenderWhen>
    <template #fallback>
      <h1 class="fallback">&lt;iframe /&gt; : {{ fallbackTitle }}</h1>
    </template>
  </RenderWhen>
</template>

<style>
[frontmatter]:has(iframe, h1.fallback) {
  display: grid;

  &,
  & > div,
  & > div > iframe {
    height: 100%;
    width: 100%;
  }

  & > h1 {
    font-size: 2.5rem;
    place-self: center;
    text-align: center;
  }
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
