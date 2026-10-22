// A conservative, garbage-collected heap growth guard for repeated SPA navigation.
// Samples must be collected only after warmup with Chromium HeapProfiler GC.
export function heapRetentionResult(samplesBytes, { maxGrowthBytes = 7 * 1024 * 1024, maxGrowthRatio = 0.35 } = {}) {
  if (!Array.isArray(samplesBytes) || samplesBytes.length < 3 ||
      !samplesBytes.every(v => Number.isFinite(v) && v >= 0)) {
    throw new Error("Three or more valid heap checkpoints required");
  }
  const [warm] = samplesBytes;
  const end = samplesBytes.at(-1);
  const growthBytes = end - warm;
  const threshold = Math.max(maxGrowthBytes, warm * maxGrowthRatio);
  return {
    pass: growthBytes <= threshold,
    growthBytes,
    thresholdBytes: threshold,
    checkpointsMiB: samplesBytes.map(bytes => +(bytes / 1048576).toFixed(2)),
  };
}
