import type {
  ImportacionFilasRecord,
  ImportacionesRecord,
} from '@loteomanager/shared-types';

/** Evita `Required<>` de Response types al extender filas/importaciones del importador. */
export type FilaExtendida = ImportacionFilasRecord<
  unknown,
  Record<string, unknown>,
  string[]
>;

export type ImportacionExtendida = ImportacionesRecord<
  Record<string, string | null>,
  Record<string, string | null>
>;
