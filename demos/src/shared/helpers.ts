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
