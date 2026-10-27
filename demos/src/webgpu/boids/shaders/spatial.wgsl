// Optimized boids: dense uniform grid + counting sort, 4 dispatches per frame
// in ONE compute pass (WebGPU orders dispatches within a pass and makes
// memory visible between them):
//   1. gridCount   - each boid atomic-adds into its cell counter
//   2. gridScan    - single workgroup exclusive prefix sum -> cell start offsets
//   3. gridScatter - each boid claims a slot in its cell -> sortedBoids
//   4. simulate    - forces computed only over the 27 neighbor cells
// vs compute.wgsl, where every boid reads every other boid (O(n^2)).

struct Uniforms {
  deltaTime: f32,
  separationDistance: f32,
  alignmentDistance: f32,
  cohesionDistance: f32,
  borderForce: f32,
  borderDistance: f32,
  bounds: f32,
  cellSize: f32,
  gridDim: f32, // cells per axis
  gridOrigin: f32, // world coordinate of cell 0 on each axis
}

@group(0) @binding(0) var<storage, read> inputPositions: array<vec3f>;
@group(0) @binding(1) var<storage, read> inputVelocities: array<vec3f>;
@group(0) @binding(2) var<storage, read_write> outputPositions: array<vec3f>;
@group(0) @binding(3) var<storage, read_write> outputVelocities: array<vec3f>;
@group(0) @binding(4) var<storage, read> colors: array<vec3f>;
@group(0) @binding(5) var<uniform> uniforms: Uniforms;
@group(0) @binding(6) var<storage, read_write> cellCounts: array<atomic<u32>>;
@group(0) @binding(7) var<storage, read_write> cursor: array<atomic<u32>>;
@group(0) @binding(8) var<storage, read_write> sortedBoids: array<u32>;

// Dense grid over the bounded world: no hash collisions, and cellSize >= max
// interaction radius guarantees every interaction partner lives in the 27
// neighboring cells (clamping is monotone, so partners within cellSize never
// end up more than one cell apart per axis). Positions outside the grid
// clamp into edge cells.
fn cellIndex(p: vec3f) -> u32 {
  let g = u32(uniforms.gridDim);
  let ix = u32(clamp(floor((p.x - uniforms.gridOrigin) / uniforms.cellSize), 0.0, uniforms.gridDim - 1.0));
  let iy = u32(clamp(floor((p.y - uniforms.gridOrigin) / uniforms.cellSize), 0.0, uniforms.gridDim - 1.0));
  let iz = u32(clamp(floor((p.z - uniforms.gridOrigin) / uniforms.cellSize), 0.0, uniforms.gridDim - 1.0));
  return ix + iy * g + iz * g * g;
}

@compute @workgroup_size(64)
fn gridCount(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= arrayLength(&inputPositions)) {
    return;
  }
  atomicAdd(&cellCounts[cellIndex(inputPositions[id.x])], 1u);
}

var<workgroup> chunkSum: array<u32, 256>;

// single-workgroup scan, fine up to ~100k cells (each thread walks
// cells/256 sequentially); switch to a multi-workgroup scan beyond that.
@compute @workgroup_size(256)
fn gridScan(@builtin(local_invocation_id) lid: vec3u) {
  let t = lid.x;
  let g = u32(uniforms.gridDim);
  let totalCells = g * g * g;

  // Each thread sums its strided chunk of cellCounts
  var sum = 0u;
  for (var c = t; c < totalCells; c = c + 256u) {
    sum += atomicLoad(&cellCounts[c]);
  }
  chunkSum[t] = sum;
  workgroupBarrier();

  // Hillis-Steele inclusive scan of the 256 chunk sums
  for (var offset = 1u; offset < 256u; offset = offset * 2u) {
    var add = 0u;
    if (t >= offset) {
      add = chunkSum[t - offset];
    }
    let mine = chunkSum[t];
    workgroupBarrier();
    chunkSum[t] = mine + add;
    workgroupBarrier();
  }

  // Exclusive prefix -> scatter start cursor per cell
  var running = 0u;
  if (t > 0u) {
    running = chunkSum[t - 1u];
  }
  for (var c = t; c < totalCells; c = c + 256u) {
    atomicStore(&cursor[c], running);
    running += atomicLoad(&cellCounts[c]);
  }
}

@compute @workgroup_size(64)
fn gridScatter(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= arrayLength(&inputPositions)) {
    return;
  }
  let cell = cellIndex(inputPositions[id.x]);
  let slot = atomicAdd(&cursor[cell], 1u);
  sortedBoids[slot] = id.x;
}

@compute @workgroup_size(64)
fn simulate(@builtin(global_invocation_id) id: vec3u) {
  let index = id.x;
  if (index >= arrayLength(&inputPositions)) {
    return;
  }

  let position = inputPositions[index];
  var velocity = inputVelocities[index];
  let color = colors[index];

  // Forces for boids rules
  var alignment = vec3f(0.0);
  var centerOfMass = vec3f(0.0);
  var alignmentCount = 0u;
  var cohesionCount = 0u;

  var acceleration = vec3f(0.0);

  let separationWeight = 1.5;
  let alignmentWeight = 1.0;
  let cohesionWeight = 1.0;

  let g = u32(uniforms.gridDim);
  let gd = i32(g);
  let cell = cellIndex(position);
  let ix = i32(cell % g);
  let iy = i32((cell / g) % g);
  let iz = i32(cell / (g * g));

  // After gridScatter, cursor[cell] = start + count, so the cell's boids are
  // exactly sortedBoids[start .. end]
  for (var dz = -1; dz <= 1; dz++) {
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        let nx = ix + dx;
        let ny = iy + dy;
        let nz = iz + dz;
        if (nx < 0 || ny < 0 || nz < 0 || nx >= gd || ny >= gd || nz >= gd) {
          continue;
        }
        let nb = u32(nx) + u32(ny) * g + u32(nz) * g * g;

        let end = atomicLoad(&cursor[nb]);
        let start = end - atomicLoad(&cellCounts[nb]);

        for (var s = start; s < end; s++) {
          let other = sortedBoids[s];
          if (other == index) {
            continue; // Ignore the boid itself
          }

          let otherPosition = inputPositions[other];
          let otherVelocity = inputVelocities[other];
          let otherColor = colors[other];

          let diff = position - otherPosition;
          let distance = length(diff);

          let sameColor = all(abs(color - otherColor) < vec3f(0.01));
          let isInFieldOfView = dot(normalize(velocity), normalize(otherPosition - position)) > 0.;

          if (sameColor && isInFieldOfView) {
            // Alignment - align with the direction of other boids
            if (distance < uniforms.alignmentDistance) {
              alignment += otherVelocity;
              alignmentCount++;
            }
            // Cohesion - move towards the center of nearby boids
            if (distance < uniforms.cohesionDistance) {
              centerOfMass += otherPosition;
              cohesionCount++;
            }
          }

          // Separation - avoid collisions with nearby boids
          if (distance > 0.0 && distance < uniforms.separationDistance) {
            let repulsionForce = normalize(diff) * (uniforms.separationDistance / distance - 1.0);
            acceleration += repulsionForce * separationWeight;
          }
        }
      }
    }
  }

  // Alignment force
  if (alignmentCount > 0u) {
    let averageVelocity = alignment / f32(alignmentCount);
    let alignmentForce = averageVelocity - velocity;
    acceleration += alignmentForce * alignmentWeight;
  }

  // Cohesion force
  if (cohesionCount > 0u) {
    let averagePosition = centerOfMass / f32(cohesionCount);
    let cohesionForce = averagePosition - position;
    acceleration += normalize(cohesionForce) * cohesionWeight;
  }

  // Keep boids within bounds
  let distToCenter = length(position);
  if (distToCenter > uniforms.bounds) {
    acceleration -= position * distToCenter * 0.00003;
  }

  velocity += acceleration * uniforms.deltaTime;

  let speed = length(velocity);
  velocity = velocity * (min(4., max(1., speed)) / speed);

  outputPositions[index] = position + velocity * uniforms.deltaTime;
  outputVelocities[index] = velocity;
}
