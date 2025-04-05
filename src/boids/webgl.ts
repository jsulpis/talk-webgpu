const updatePositionsFragmentShader = `#version 300 es
precision highp float;
uniform sampler2D positions;
uniform sampler2D velocities;
uniform float deltaTime;

in vec2 vUv;
out vec4 fragColor;

void main() {
  vec3 position = texture(positions, vUv).xyz;
  vec3 velocity = texture(velocities, vUv).xyz;

  // Update position
  position += velocity * deltaTime;

  fragColor = vec4(position, 1.0);
}
`;

const updateVelocitiesFragmentShader = `#version 300 es
precision highp float;
uniform sampler2D positions;
uniform sampler2D velocities;
uniform sampler2D colors;
uniform float deltaTime;
uniform float separationDistance;
uniform float alignmentDistance;
uniform float cohesionDistance;
uniform float borderForce;
uniform float borderDistance;
uniform float bounds;
uniform vec2 resolution;

in vec2 vUv;
out vec4 fragColor;

void main() {
  vec3 position = texture(positions, vUv).xyz;
  vec3 velocity = texture(velocities, vUv).xyz;
  vec3 color = texture(colors, vUv).xyz;
  float initialSpeed = length(velocity);

  // Forces for boids rules
  vec3 alignment = vec3(0.0);
  vec3 cohesion = vec3(0.0);
  float alignmentCount = 0.0;
  float cohesionCount = 0.0;

  vec3 acceleration = vec3(0.0);
  vec3 centerOfMass = vec3(0.0);

  float separationWeight = 1.5;
  float alignmentWeight = 1.0;
  float cohesionWeight = 1.0;

  // We need to iterate through all boids
  // In WebGL, we can't randomly access array elements like in WebGPU
  // So we iterate through texture coordinates
  for (float y = 0.0; y < 1.0; y += 1.0/resolution.y) {
    for (float x = 0.0; x < 1.0; x += 1.0/resolution.x) {
      vec2 otherUv = vec2(x, y);

      // Skip self
      if (distance(otherUv, vUv) < 0.001) continue;

      vec3 otherPosition = texture(positions, otherUv).xyz;
      vec3 otherVelocity = texture(velocities, otherUv).xyz;
      vec3 otherColor = texture(colors, otherUv).xyz;

      bool sameColor = all(lessThan(abs(color - otherColor), vec3(0.01)));

      vec3 diff = position - otherPosition;
      float distance = length(diff);

      if (sameColor) {
        // Alignment - align with the direction of other boids
        if (distance < alignmentDistance) {
          alignment += otherVelocity;
          alignmentCount += 1.0;
        }

        // Cohesion - move towards the center of nearby boids
        if (distance < cohesionDistance) {
          centerOfMass += otherPosition;
          cohesionCount += 1.0;
        }
      }

      // Separation - avoid collisions with nearby boids
      if (distance > 0.0 && distance < separationDistance) {
        vec3 repulsionForce = normalize(diff) * (separationDistance / distance - 1.0);
        acceleration += repulsionForce * separationWeight;
      }
    }
  }

  // Alignment force
  if (alignmentCount > 0.0) {
    vec3 averageVelocity = alignment / alignmentCount;
    vec3 alignmentForce = averageVelocity - velocity;
    acceleration += alignmentForce * alignmentWeight;
  }

  // Cohesion force
  if (cohesionCount > 0.0) {
    vec3 averagePosition = centerOfMass / cohesionCount;
    vec3 cohesionForce = averagePosition - position;
    acceleration += normalize(cohesionForce) * cohesionWeight;
  }

  // Apply a force near the borders to keep boids within limits
  if (position.x < -bounds + borderDistance) {
    acceleration.x += borderForce;
  } else if (position.x > bounds - borderDistance) {
    acceleration.x -= borderForce;
  }

  if (position.y < -bounds + borderDistance) {
    acceleration.y += borderForce;
  } else if (position.y > bounds - borderDistance) {
    acceleration.y -= borderForce;
  }

  if (position.z < -bounds + borderDistance) {
    acceleration.z += borderForce;
  } else if (position.z > bounds - borderDistance) {
    acceleration.z -= borderForce;
  }

  velocity += acceleration * deltaTime;

  // Limit speed
  float speed = length(velocity);
  velocity = velocity * (min(4.0, max(1.0, speed)) / speed);

  fragColor = vec4(velocity, 1.0);
}
`;

const vertexShader = `#version 300 es
precision highp float;
in vec2 position;
out vec2 vUv;

void main() {
  vUv = 0.5 * (position + 1.0);
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

class PingPongBuffer {
  private gl: WebGL2RenderingContext;
  private width: number;
  private height: number;
  private internalFormat: number;
  private format: number;
  private type: number;
  private numComponents: number;
  private framebuffers: WebGLFramebuffer[];
  private textures: WebGLTexture[];
  private index: number;

  constructor(
    gl: WebGL2RenderingContext,
    width: number,
    height: number,
    internalFormat: number,
    format: number,
    type: number,
    numComponents: number,
    data?: Float32Array
  ) {
    this.gl = gl;
    this.width = width;
    this.height = height;
    this.internalFormat = internalFormat;
    this.format = format;
    this.type = type;
    this.numComponents = numComponents;

    this.framebuffers = [this.createFramebuffer(), this.createFramebuffer()];
    this.textures = [this.createTexture(), this.createTexture()];

    // Bind textures to framebuffers
    for (let i = 0; i < 2; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[i]);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.textures[i], 0);
    }

    // Initialize with data if provided
    if (data) {
      gl.bindTexture(gl.TEXTURE_2D, this.textures[0]);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, this.format, this.type, data);

      gl.bindTexture(gl.TEXTURE_2D, this.textures[1]);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, this.format, this.type, data);
    }

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    this.index = 0;
  }

  private createTexture(): WebGLTexture {
    const { gl, width, height, internalFormat, format, type } = this;
    const texture = gl.createTexture();
    if (!texture) throw new Error("Failed to create texture");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, null);
    return texture;
  }

  private createFramebuffer(): WebGLFramebuffer {
    const framebuffer = this.gl.createFramebuffer();
    if (!framebuffer) throw new Error("Failed to create framebuffer");
    return framebuffer;
  }

  public swap(): void {
    this.index = (this.index + 1) % 2;
  }

  public get read(): { texture: WebGLTexture } {
    return {
      texture: this.textures[this.index],
    };
  }

  public get write(): { texture: WebGLTexture; framebuffer: WebGLFramebuffer } {
    return {
      texture: this.textures[(this.index + 1) % 2],
      framebuffer: this.framebuffers[(this.index + 1) % 2],
    };
  }

  // Helper to read data back to CPU
  public readPixels(): Float32Array {
    const { gl, width, height, format, type, numComponents } = this;
    const pixels = new Float32Array(width * height * numComponents);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[this.index]);
    gl.readPixels(0, 0, width, height, format, type, pixels);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return pixels;
  }
}

export function useBoidsWebGL(
  gl: WebGL2RenderingContext,
  initialPositions: Float32Array,
  initialVelocities: Float32Array,
  initialColors: Float32Array,
  COUNT: number
) {
  // Get the side length of a square texture that can hold all boids
  const textureSide = Math.ceil(Math.sqrt(COUNT));
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

  // Create position and velocity buffers with ping-pong technique
  const positionBuffer = new PingPongBuffer(
    gl,
    textureSide,
    textureSide,
    gl.RGBA32F,
    gl.RGBA,
    gl.FLOAT,
    4,
    paddedPositions
  );

  const velocityBuffer = new PingPongBuffer(
    gl,
    textureSide,
    textureSide,
    gl.RGBA32F,
    gl.RGBA,
    gl.FLOAT,
    4,
    paddedVelocities
  );

  // Create static color texture
  const colorTexture = gl.createTexture();
  if (!colorTexture) throw new Error("Failed to create color texture");
  gl.bindTexture(gl.TEXTURE_2D, colorTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, textureSide, textureSide, 0, gl.RGBA, gl.FLOAT, paddedColors);

  // Create quad for fullscreen rendering
  const quadBuffer = gl.createBuffer();
  if (!quadBuffer) throw new Error("Failed to create quad buffer");
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  // Create and compile shaders
  function createShader(type: number, source: string): WebGLShader {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Failed to create shader");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      throw new Error("Failed to compile shader");
    }
    return shader;
  }

  function createProgram(vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram {
    const program = gl.createProgram();
    if (!program) throw new Error("Failed to create program");
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      throw new Error("Failed to link program");
    }
    return program;
  }

  const vs = createShader(gl.VERTEX_SHADER, vertexShader);
  const updatePositionsFS = createShader(gl.FRAGMENT_SHADER, updatePositionsFragmentShader);
  const updateVelocitiesFS = createShader(gl.FRAGMENT_SHADER, updateVelocitiesFragmentShader);

  const updatePositionsProgram = createProgram(vs, updatePositionsFS);
  const updateVelocitiesProgram = createProgram(vs, updateVelocitiesFS);

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
    const u = (i % textureSize) / textureSize;
    const v = Math.floor(i / textureSize) / textureSize;
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
  }: {
    deltaTime: number;
    separationDistance: number;
    alignmentDistance: number;
    cohesionDistance: number;
    borderForce: number;
    borderDistance: number;
    bounds: number;
  }) {
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

    // Return read buffers for rendering
    return {
      positionsTexture: positionBuffer.read.texture,
      velocitiesTexture: velocityBuffer.read.texture,
      // Optional: read back data to CPU if needed
      getPositions: () => {
        const data = positionBuffer.readPixels();
        // Convert from RGBA to RGB format for compatibility with original code
        const positions = new Float32Array(COUNT * 3);
        for (let i = 0; i < COUNT; i++) {
          positions[i * 3] = data[i * 4];
          positions[i * 3 + 1] = data[i * 4 + 1];
          positions[i * 3 + 2] = data[i * 4 + 2];
        }
        return positions;
      },
      getVelocities: () => {
        const data = velocityBuffer.readPixels();
        const velocities = new Float32Array(COUNT * 3);
        for (let i = 0; i < COUNT; i++) {
          velocities[i * 3] = data[i * 4];
          velocities[i * 3 + 1] = data[i * 4 + 1];
          velocities[i * 3 + 2] = data[i * 4 + 2];
        }
        return velocities;
      },
    };
  }

  return {
    compute,
    coords,
    colorTexture,
  };
}
