export function createSphereGeometry(radius = 1, stacks = 18, slices = 36) {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  // Create a sphere at origin
  for (let stack = 0; stack <= stacks; ++stack) {
    const theta = (stack * Math.PI) / stacks;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let slice = 0; slice <= slices; ++slice) {
      const phi = (slice * 2 * Math.PI) / slices;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      const x = radius * sinTheta * cosPhi;
      const y = radius * sinTheta * sinPhi;
      const z = radius * cosTheta;
      positions.push(x, y, z);

      normals.push(sinTheta * cosPhi, sinTheta * sinPhi, cosTheta);
    }
  }

  // Generate indices for the sphere
  for (let stack = 0; stack < stacks; ++stack) {
    for (let slice = 0; slice < slices; ++slice) {
      const first = stack * (slices + 1) + slice;
      const second = first + slices + 1;

      indices.push(first, second, first + 1);
      indices.push(second, second + 1, first + 1);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
  };
}
