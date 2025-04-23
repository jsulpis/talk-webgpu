import { Pane } from "tweakpane";

export interface Params {
  api: "WebGL" | "WebGPU";
  method?: "naive" | "renderBundle";
  objects: number;
  jsTime: string;
  renderTime: string;
  computeTime?: string;
}

export function createPane(params: Params) {
  const pane = new Pane();

  pane.addBinding(params, "api", {
    readonly: true,
    label: "api",
  });

  pane.addBinding(params, "objects", {
    readonly: true,
    label: "objects",
    format: (v) => v.toFixed(0),
  });

  const gpuFolder = pane.addFolder({ title: "GPU" });

  if (params.computeTime) {
    gpuFolder.addBinding(params, "computeTime", {
      label: "compute",
      readonly: true,
    });
  }

  gpuFolder.addBinding(params, "renderTime", {
    label: "render",
    readonly: true,
  });

  const cpuFolder = pane.addFolder({ title: "CPU" });
  cpuFolder.addBinding(params, "jsTime", {
    label: "JS Time",
    readonly: true,
  });

  return pane;
}
