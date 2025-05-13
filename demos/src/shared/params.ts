import { mat4 } from "gl-matrix";
import { MovingAverage } from "./helpers";

export const BOUNDS = 200;
export const speed = 0.015;
export const canvasBackground = [0.8, 0.9, 1, 1] as const;

export const renderElement = document.getElementById("render")!;
export const computeElement = document.getElementById("compute")!;

export const computeTime = new MovingAverage(100);
export const renderTime = new MovingAverage(100);
export const jsTime = new MovingAverage(10);

const fieldOfView = (60 * Math.PI) / 180;
const aspect = window.innerWidth / window.innerHeight;
const zNear = 0.1;
const zFar = 1000.0;
export const projectionMatrix = mat4.create();
mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

export const viewMatrix = mat4.create();
mat4.translate(viewMatrix, viewMatrix, [0, 0, -BOUNDS]);

export const boidsUniforms = {
  deltaTime: 0,
  separationDistance: 8,
  alignmentDistance: 9,
  cohesionDistance: 12,
  borderForce: 0.3,
  borderDistance: BOUNDS * 0.25,
  bounds: BOUNDS * 0.5,
};

export type BoidsUniforms = typeof boidsUniforms;

export const renderUniforms = {
  projectionMatrix,
  viewMatrix,
  lightDirection: [0.5, 0.7, 0],
  lightColor: [1.5, 1.5, 1.5],
  ambientColor: canvasBackground.slice(0, 3).map((c) => c * 0.7),
  scale: 0.8,
};
