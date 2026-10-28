/** Attribution required by OSM + CARTO terms. */
export const CARTO_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const CARTO_TEMPLATES = {
  voyager:
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  dark_all: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
} as const;

export type CartoBasemap = keyof typeof CARTO_TEMPLATES;

/** Raster basemaps require `?key=` since 2026-09-25. */
export function resolveCartoBasemapsKey(): string {
  if (typeof window === 'undefined') return '';
  const env = (window as Window & { __env?: { CARTO_BASEMAPS_KEY?: string } }).__env;
  return env?.CARTO_BASEMAPS_KEY?.trim() ?? '';
}

export function cartoTileUrl(
  style: CartoBasemap,
  key = resolveCartoBasemapsKey(),
): string {
  const base = CARTO_TEMPLATES[style];
  const k = key.trim();
  if (!k) {
    console.warn(
      '[carto] CARTO_BASEMAPS_KEY vacío — tiles muestran API KEY REQUIRED. Pedí una en https://carto.com/basemaps/apikey/',
    );
    return base;
  }
  return `${base}?key=${encodeURIComponent(k)}`;
}
