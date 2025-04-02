interface Geometry {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint16Array;
}

export async function loadOBJ(url: string): Promise<Geometry> {
  const response = await fetch(url);
  const objFileContent = await response.text();

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  const objPositions: number[][] = [];
  const objNormals: number[][] = [];

  const vertexMap: Map<string, number> = new Map();
  let currentVertexIndex = 0;

  const lines = objFileContent.split("\n");

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine === "" || trimmedLine.startsWith("#")) {
      continue;
    }

    const parts = trimmedLine.split(/\s+/);
    const prefix = parts[0];

    switch (prefix) {
      case "v":
        objPositions.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
        break;

      case "vn":
        objNormals.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
        break;

      case "f":
        for (let i = 1; i <= parts.length - 3; i++) {
          processTriangle(parts[1], parts[i + 1], parts[i + 2]);
        }
        break;
    }
  }

  function processTriangle(v1: string, v2: string, v3: string): void {
    const index1 = processVertex(v1);
    const index2 = processVertex(v2);
    const index3 = processVertex(v3);

    indices.push(index1, index2, index3);
  }

  function processVertex(vertexString: string): number {
    const vertexParts = vertexString.split("/");

    const positionIndex = parseInt(vertexParts[0]) - 1;
    const normalIndex = vertexParts.length > 2 && vertexParts[2] !== "" ? parseInt(vertexParts[2]) - 1 : -1;
    const key = `${positionIndex}/${normalIndex}`;

    if (vertexMap.has(key)) {
      return vertexMap.get(key)!;
    }

    positions.push(...objPositions[positionIndex]);

    if (normalIndex !== -1) {
      normals.push(...objNormals[normalIndex]);
    }

    vertexMap.set(key, currentVertexIndex);

    return currentVertexIndex++;
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint16Array(indices),
  };
}
