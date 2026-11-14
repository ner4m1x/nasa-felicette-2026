// Phase 6 stub: NASA POWER climatology client.
// Parameter names and units must be confirmed with curl and read from the response, never hard-coded.
// TODO_VERIFY: endpoint behaviour and CORS not yet tested.

export interface PowerClimatology {
  lat: number;
  lon: number;
  /** parameter id -> { units, annual, monthly[12] }, all taken from the API response */
  parameters: Record<string, { units: string; annual: number | null; monthly: (number | null)[] }>;
}

export async function fetchPowerClimatology(): Promise<PowerClimatology | null> {
  return null;
}
