import type {
  TipoUnidadIngreso,
  UnidadesOrientacionOptions
} from '@loteomanager/shared-types';

export type PlantillaDraft = {
  localId: string;
  nombre: string;
  patron_codigo: string;
  cantidad: number;
  area_m2?: number | null;
  orientacion?: UnidadesOrientacionOptions | null;
  precio?: number | null;
  moneda: string;
  estado_inicial: string;
  web_visible: boolean;
  modelo?: string;
};

export type UnidadIndividualDraft = {
  localId: string;
  codigo: string;
  area_m2?: number | null;
  orientacion?: UnidadesOrientacionOptions | null;
  precio?: number | null;
  moneda: string;
  estado: string;
  web_visible: boolean;
  modelo?: string;
};

export type TipoUnidadDraft = {
  plantillas: PlantillaDraft[];
  individuales: UnidadIndividualDraft[];
  modo: 'plantilla' | 'individual';
};

export type IngresoPaso2BarrioDraft = {
  descripcion: string;
  planoFile: File | null;
  imagenFile: File | null;
  lat?: number | null;
  lng?: number | null;
  ubicacion_texto?: string;
};

export type IngresoFormMode = 'nuevo' | 'editando' | 'desde_plantilla';

/** Formulario del panel C2 por tipo de unidad */
export type IngresoUnidadForm = {
  codigo: string;
  nombre_plantilla: string;
  patron_codigo: string;
  area_m2?: number | null;
  orientacion?: UnidadesOrientacionOptions | null;
  precio?: number | null;
  moneda: string;
  estado_inicial: string;
  web_visible: boolean;
  modelo?: string;
  fabricante?: string;
  sup_cubierta?: number | null;
  sup_semicubierta?: number | null;
  dormitorios?: number | null;
  banos?: number | null;
  garage?: number | null;
  anio_construccion?: number | null;
  /** Campos custom desde extras_definiciones (no incluye campos fijos del tipo). */
  extras?: Record<string, unknown>;
};

/** @deprecated use IngresoUnidadForm */
export type IngresoPlantillaForm = IngresoUnidadForm;

export function emptyUnidadForm(): IngresoUnidadForm {
  return {
    codigo: '',
    nombre_plantilla: '',
    patron_codigo: 'A-{n}',
    moneda: 'USD',
    estado_inicial: 'disponible',
    web_visible: true,
    extras: {}
  };
}

/** @deprecated use emptyUnidadForm */
export function emptyPlantillaForm(): IngresoUnidadForm {
  return emptyUnidadForm();
}

export function emptyTipoDraft(): TipoUnidadDraft {
  return { plantillas: [], individuales: [], modo: 'plantilla' };
}

export function newLocalId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
