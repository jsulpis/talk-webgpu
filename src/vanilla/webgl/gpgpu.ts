import { BoidsUniforms } from "../shared";
import { createDataTexture, initProgram } from "./utils";
import updatePositionsFragmentShader from "./shaders/positions.frag?raw";
import updateVelocitiesFragmentShader from "./shaders/velocities.frag?raw";
import vertexShader from "./shaders/compute.vert?raw";

class PingPongBuffer {
  private framebuffers: WebGLFramebuffer[];
  private textures: WebGLTexture[];
  private index: number;

  constructor(private gl: WebGL2RenderingContext, width: number, height: number, data?: Float32Array) {
    this.framebuffers = [this.createFramebuffer(), this.createFramebuffer()];
    this.textures = [createDataTexture(gl, width, height, data), createDataTexture(gl, width, height, data)];

    // Bind textures to framebuffers
    for (let i = 0; i < 2; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[i]);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.textures[i], 0);
    }

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this.index = 0;
  }

  private createFramebuffer() {
    const framebuffer = this.gl.createFramebuffer();
    if (!framebuffer) throw new Error("Failed to create framebuffer");
    return framebuffer;
  }

  public swap() {
    this.index = (this.index + 1) % 2;
  }

  public get read() {
    return {
      texture: this.textures[this.index],
    };
  }

  public get write() {
    return {
      texture: this.textures[(this.index + 1) % 2],
      framebuffer: this.framebuffers[(this.index + 1) % 2],
    };
  }
}

export function useBoidsWebGL(
  gl: WebGL2RenderingContext,
  initialPositions: Float32Array,
  initialVelocities: Float32Array,
  initialColors: Float32Array,
  count: number
) {
  // Get the side length of a square texture that can hold all boids
  const textureSide = Math.ceil(Math.sqrt(count));
  const textureSize = textureSide * textureSide;

  // Pad the input arrays to fill the texture completely
  const paddedPositions = new Float32Array(textureSize * 4).map(() => -1);
  paddedPositions.set(initialPositions);
  const paddedVelocities = new Float32Array(textureSize * 4).map(() => -1);
  paddedVelocities.set(initialVelocities);
  const paddedColors = new Float32Array(textureSize * 4).map(() => -1);
  paddedColors.set(initialColors);

  // Check for the extension
  const ext = gl.getExtension("EXT_color_buffer_float") || gl.getExtension("WEBGL_color_buffer_float");
  if (!ext) {
    throw new Error("Floating point textures are not supported by your browser.");
  }

  const positionBuffer = new PingPongBuffer(gl, textureSide, textureSide, paddedPositions);
  const velocityBuffer = new PingPongBuffer(gl, textureSide, textureSide, paddedVelocities);

  const colorTexture = createDataTexture(gl, textureSide, textureSide, paddedColors);

  // Create quad for fullscreen rendering
  const quadBuffer = gl.createBuffer();
  if (!quadBuffer) throw new Error("Failed to create quad buffer");
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const updatePositionsProgram = initProgram(gl, vertexShader, updatePositionsFragmentShader);
  const updateVelocitiesProgram = initProgram(gl, vertexShader, updateVelocitiesFragmentShader);
  if (!updatePositionsProgram || !updateVelocitiesProgram) throw new Error("Failed to create gpgpu programs");

  // Get shader uniforms and attributes
  const positionsProgramUniforms = {
    positions: gl.getUniformLocation(updatePositionsProgram, "positions"),
    velocities: gl.getUniformLocation(updatePositionsProgram, "velocities"),
    deltaTime: gl.getUniformLocation(updatePositionsProgram, "deltaTime"),
  };

  const velocitiesProgramUniforms = {
    positions: gl.getUniformLocation(updateVelocitiesProgram, "positions"),
    velocities: gl.getUniformLocation(updateVelocitiesProgram, "velocities"),
    colors: gl.getUniformLocation(updateVelocitiesProgram, "colors"),
    deltaTime: gl.getUniformLocation(updateVelocitiesProgram, "deltaTime"),
    separationDistance: gl.getUniformLocation(updateVelocitiesProgram, "separationDistance"),
    alignmentDistance: gl.getUniformLocation(updateVelocitiesProgram, "alignmentDistance"),
    cohesionDistance: gl.getUniformLocation(updateVelocitiesProgram, "cohesionDistance"),
    borderForce: gl.getUniformLocation(updateVelocitiesProgram, "borderForce"),
    borderDistance: gl.getUniformLocation(updateVelocitiesProgram, "borderDistance"),
    bounds: gl.getUniformLocation(updateVelocitiesProgram, "bounds"),
    resolution: gl.getUniformLocation(updateVelocitiesProgram, "resolution"),
  };

  const positionAttribLocation = gl.getAttribLocation(updatePositionsProgram, "position");
  const velocityAttribLocation = gl.getAttribLocation(updateVelocitiesProgram, "position");

  const elementsCount = initialPositions.length / 4;
  const coords = new Float32Array(elementsCount * 2);
  for (let i = 0; i < elementsCount; i++) {
    const u = (i % textureSide) / textureSide;
    const v = Math.floor(i / textureSide) / textureSide;
    coords.set([u, v], i * 2);
  }

  function compute({
    deltaTime,
    separationDistance,
    alignmentDistance,
    cohesionDistance,
    borderForce,
    borderDistance,
    bounds,
  }: BoidsUniforms) {
    // First update velocities
    gl.useProgram(updateVelocitiesProgram);

    gl.uniform1f(velocitiesProgramUniforms.deltaTime, deltaTime);
    gl.uniform1f(velocitiesProgramUniforms.separationDistance, separationDistance);
    gl.uniform1f(velocitiesProgramUniforms.alignmentDistance, alignmentDistance);
    gl.uniform1f(velocitiesProgramUniforms.cohesionDistance, cohesionDistance);
    gl.uniform1f(velocitiesProgramUniforms.borderForce, borderForce);
    gl.uniform1f(velocitiesProgramUniforms.borderDistance, borderDistance);
    gl.uniform1f(velocitiesProgramUniforms.bounds, bounds);
    gl.uniform2f(velocitiesProgramUniforms.resolution, textureSide, textureSide);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, positionBuffer.read.texture);
    gl.uniform1i(velocitiesProgramUniforms.positions, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, velocityBuffer.read.texture);
    gl.uniform1i(velocitiesProgramUniforms.velocities, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, colorTexture);
    gl.uniform1i(velocitiesProgramUniforms.colors, 2);

    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.enableVertexAttribArray(velocityAttribLocation);
    gl.vertexAttribPointer(velocityAttribLocation, 2, gl.FLOAT, false, 0, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, velocityBuffer.write.framebuffer);
    gl.viewport(0, 0, textureSide, textureSide);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    velocityBuffer.swap();

    // Then update positions using the new velocities
    gl.useProgram(updatePositionsProgram);

    gl.uniform1f(positionsProgramUniforms.deltaTime, deltaTime);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, positionBuffer.read.texture);
    gl.uniform1i(positionsProgramUniforms.positions, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, velocityBuffer.read.texture);
    gl.uniform1i(positionsProgramUniforms.velocities, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.enableVertexAttribArray(positionAttribLocation);
    gl.vertexAttribPointer(positionAttribLocation, 2, gl.FLOAT, false, 0, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, positionBuffer.write.framebuffer);
    gl.viewport(0, 0, textureSide, textureSide);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    positionBuffer.swap();

    return {
      positionsTexture: positionBuffer.read.texture,
      velocitiesTexture: velocityBuffer.read.texture,
    };
  }

  return {
    compute,
    coords,
    colorTexture,
  };
}
