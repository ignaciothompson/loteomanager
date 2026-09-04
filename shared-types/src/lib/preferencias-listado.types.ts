/**
 * Preferencias de columnas/filtros por usuario y listado.
 * Complementa pocketbase-types hasta el próximo `npm run pb:types`.
 */

export type PreferenciasListadoListadoOptions = 'barrios' | 'interesados';

export type PreferenciasListadoRecord = {
  id: string;
  user_id: string;
  listado: PreferenciasListadoListadoOptions;
  columnas?: string[] | null;
  orden?: { campo: string; dir: 'asc' | 'desc' } | null;
  filtros?: Record<string, unknown> | null;
};

export type PreferenciasListadoResponse = PreferenciasListadoRecord & {
  created?: string;
  updated?: string;
  collectionId?: string;
  collectionName?: string;
};
