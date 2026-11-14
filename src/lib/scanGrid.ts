// Stub: reader for /data/scan_grid.bin, published later by the Python pipeline.
// Until the pipeline exists, every lookup returns null ("from global scan (pending)").

export interface ScanGridSample {
  analogTotal: number;
  trafficableFrac: number | null;
}

export async function sampleScanGrid(): Promise<ScanGridSample | null> {
  return null;
}
