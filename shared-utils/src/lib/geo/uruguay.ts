/** Bounding box aprox. Uruguay (+padding costa). */
export const URUGUAY_BOUNDS = {
  south: -35.0,
  north: -30.05,
  west: -58.5,
  east: -53.05,
} as const;

export const URUGUAY_CENTER: readonly [number, number] = [-32.65, -55.8];

export const URUGUAY_DEFAULT_ZOOM = 7;

export function isInUruguay(lat: number | null | undefined, lng: number | null | undefined): boolean {
  if (lat == null || lng == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return (
    lat >= URUGUAY_BOUNDS.south &&
    lat <= URUGUAY_BOUNDS.north &&
    lng >= URUGUAY_BOUNDS.west &&
    lng <= URUGUAY_BOUNDS.east
  );
}

export function leafletUruguayMaxBounds(): [[number, number], [number, number]] {
  return [
    [URUGUAY_BOUNDS.south, URUGUAY_BOUNDS.west],
    [URUGUAY_BOUNDS.north, URUGUAY_BOUNDS.east],
  ];
}
