import { mat4 } from "gl-matrix";

export class MovingAverage {
  constructor(private windowSize: number, private values: number[] = []) {}

  addValue(value: number): void {
    this.values.push(value);
    if (this.values.length > this.windowSize) {
      this.values.shift();
    }
  }

  getAverage(): number {
    if (this.values.length === 0) {
      return 0;
    }
    const sum = this.values.reduce((acc, val) => acc + val, 0);
    return sum / this.values.length;
  }
}

export const COUNT = 10000;
export const BOUNDS = 100;

export const renderElement = document.getElementById("render")!;
export const computeElement = document.getElementById("compute")!;

export const computeTime = new MovingAverage(100);
export const renderTime = new MovingAverage(100);
export const jsTime = new MovingAverage(10);

export const speed = 0.015;

export let initialPositions = new Float32Array(COUNT * 4);
export let initialVelocities = new Float32Array(COUNT * 4);
export let colors = new Float32Array(COUNT * 4);

const red = [1, 0.7, 0.1, 1];
const green = [0, 0.3, 1, 1];
const cyan = [0, 0.7, 1, 1];

export const canvasBackground = [0.8, 0.9, 1, 1] as const;

for (let i = 0; i < initialVelocities.length; i += 4) {
  const theta = Math.random() * 2 * Math.PI;
  const phi = Math.acos(2 * Math.random() - 1);
  const radius = Math.cbrt(Math.random()) * BOUNDS * 0.8;

  initialPositions[i + 0] = radius * Math.sin(phi) * Math.cos(theta);
  initialPositions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
  initialPositions[i + 2] = radius * Math.cos(phi);
  initialPositions[i + 3] = 0; // data alignment on 16 bytes

  initialVelocities[i + 0] = Math.random() * 0.5;
  initialVelocities[i + 1] = Math.random() * 0.5;
  initialVelocities[i + 2] = Math.random() * 0.5;
  initialVelocities[i + 3] = 0; // data alignment on 16 bytes

  const random = Math.random();
  if (random < 1 / 3) {
    colors.set(red, i);
  } else if (random < 2 / 3) {
    colors.set(green, i);
  } else {
    colors.set(cyan, i);
  }
}

export const boidsUniforms = {
  deltaTime: 0,
  separationDistance: 8,
  alignmentDistance: 9,
  cohesionDistance: 12,
  borderForce: 0.3,
  borderDistance: BOUNDS * 0.5,
  bounds: BOUNDS,
};

export type BoidsUniforms = typeof boidsUniforms;

const fieldOfView = (60 * Math.PI) / 180;
const aspect = window.innerWidth / window.innerHeight;
const zNear = 0.1;
const zFar = 1000.0;
export const projectionMatrix = mat4.create();
mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

export const viewMatrix = mat4.create();
mat4.translate(viewMatrix, viewMatrix, [0, 0, -BOUNDS * 2]);

export const renderUniforms = {
  projectionMatrix,
  viewMatrix,
  lightDirection: [0.5, 0.7, 0],
  lightColor: [1.5, 1.5, 1.5],
  ambientColor: canvasBackground.slice(0, 3).map((c) => c * 0.7),
  scale: 0.8,
};

/**
 * Sets up an animation loop that calls the provided `loop` function on each frame
 * and pauses when the tab is not active
 */
export function setAnimationLoop(loop: (params: { deltaTime: number; startTime: number }) => void) {
  let rafId = 0;
  let lastTime = 0;

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
    } else {
      lastTime = performance.now();
      rafId = requestAnimationFrame(animate);
    }
  });

  function animate() {
    const startTime = performance.now();
    const deltaTime = startTime - lastTime;

    loop({ deltaTime, startTime });

    lastTime = startTime;

    if (!document.hidden) {
      rafId = requestAnimationFrame(animate);
    }
  }

  requestAnimationFrame(animate);
}
