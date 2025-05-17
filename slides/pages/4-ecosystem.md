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

<img class="h-full" src="/webgpu-ecosystem-apps.png" alt="WebGPU apps ecosystem" />

---
layout: default
---

# Hugging Face

```ts{all|5|all}
import { pipeline } from "@huggingface/transformers";

// Create a feature-extraction pipeline
const extractor = await pipeline("feature-extraction", "mixedbread-ai/mxbai-embed-xsmall-v1",
  { device: "webgpu" },
);

// Compute embeddings
const texts = ["Hello world!", "This is an example sentence."];
const embeddings = await extractor(texts, { pooling: "mean", normalize: true });
console.log(embeddings.tolist());
// [
//   [-0.016986183822155, 0.03228696808218956, -0.0013630966423079371, ... ],
//   [0.09050482511520386, 0.07207386940717697, 0.05762749910354614, ... ],
// ]
```

---
layout: image
image: /cloudflare-workers.png
---
