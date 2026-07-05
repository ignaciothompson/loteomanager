import type { ImportacionFilasResponse, ImportacionesResponse } from '@loteomanager/shared-types';

export type FilaExtendida = Omit<ImportacionFilasResponse, 'mensajes'> & {
  ref_barrio?: string;
  barrio_resuelto_id?: string;
  mensajes?: string[];
};

export type ImportacionExtendida = ImportacionesResponse & {
  nombre_archivo?: string;
};
