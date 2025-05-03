export function generateInitialPositions(count: number, bounds: number) {
  let initialPositions = new Float32Array(count * 4);

  for (let i = 0; i < initialPositions.length; i += 4) {
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.acos(2 * Math.random() - 1);
    const radius = Math.cbrt(Math.random()) * bounds * 0.8;

    initialPositions[i + 0] = radius * Math.sin(phi) * Math.cos(theta);
    initialPositions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
    initialPositions[i + 2] = radius * Math.cos(phi);
    initialPositions[i + 3] = 0; // data alignment on 16 bytes
  }

  return initialPositions;
}

export function generateColors(count: number) {
  let colors = new Float32Array(count * 4);
  const red = [1, 0.7, 0.1, 1];
  const green = [0, 0.3, 1, 1];
  const cyan = [0, 0.7, 1, 1];

  for (let i = 0; i < colors.length; i += 4) {
    const random = Math.random();
    if (random < 1 / 3) {
      colors.set(red, i);
    } else if (random < 2 / 3) {
      colors.set(green, i);
    } else {
      colors.set(cyan, i);
    }
  }

  return colors;
}
