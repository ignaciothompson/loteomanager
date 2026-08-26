import type { ImportacionFilasResponse, ImportacionesResponse } from '@loteomanager/shared-types';
import type { CorreccionSugerida, MapeoGeografia } from './parser/types';

export type FilaExtendida = Omit<ImportacionFilasResponse, 'mensajes' | 'correcciones_sugeridas'> & {
  ref_barrio?: string;
  barrio_resuelto_id?: string;
  mensajes?: string[];
  correcciones_sugeridas?: CorreccionSugerida[] | null;
  nombre_hoja?: string;
};

export type ImportacionExtendida = ImportacionesResponse & {
  nombre_archivo?: string;
  mapeo_geografia?: MapeoGeografia | null;
};
