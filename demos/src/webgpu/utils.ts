export function initTimingObjects(device: GPUDevice) {
  const querySet = device.createQuerySet({
    type: "timestamp",
    count: 2,
  });
  const resolveBuffer = device.createBuffer({
    size: querySet.count * 8,
    usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
  });
  const resultBuffer = device.createBuffer({
    size: resolveBuffer.size,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  const timestampWrites = {
    querySet: querySet,
    beginningOfPassWriteIndex: 0,
    endOfPassWriteIndex: 1,
  };

  return { querySet, resolveBuffer, resultBuffer, timestampWrites };
}

export function resolveTimingQuery(
  querySet: GPUQuerySet,
  resultBuffer: GPUBuffer,
  commandEncoder: GPUCommandEncoder,
  resolveBuffer: GPUBuffer
) {
  commandEncoder.resolveQuerySet(querySet, 0, querySet.count, resolveBuffer, 0);

  if (resultBuffer.mapState === "unmapped") {
    commandEncoder.copyBufferToBuffer(resolveBuffer, 0, resultBuffer, 0, resultBuffer.size);
  }
}

export async function readTimingBuffer(resultBuffer: GPUBuffer) {
  if (resultBuffer.mapState === "unmapped") {
    await resultBuffer.mapAsync(GPUMapMode.READ);
    const times = new BigInt64Array(resultBuffer.getMappedRange());
    const measure = Number(times[1] - times[0]) / 1e6;
    resultBuffer.unmap();
    return measure;
  }
}
