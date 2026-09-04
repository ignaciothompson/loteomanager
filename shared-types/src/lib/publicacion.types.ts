export type TipoCambio = 'nueva' | 'modificada' | 'oculta' | 'eliminada';

export interface CambioCampo {
  campo: string;
  antes: string;
  despues: string;
}

export interface DiffUnidad {
  codigo: string;
  unidadId?: string;
  tipo: TipoCambio;
  campos: CambioCampo[];
}

export interface VersionPublicacion {
  id: string;
  barrioId: string;
  publicadoEn: string;
  publicadoPor: string;
  unidadesCount: number;
}
