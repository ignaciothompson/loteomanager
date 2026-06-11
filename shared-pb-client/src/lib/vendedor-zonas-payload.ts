/** Payload para crear vendedor_zonas (solo relaciones, sin campo text legacy). */
export function buildVendedorZonaCreatePayload(
  vendedorId: string,
  zonaId: string,
  _zonaNombre?: string,
): Record<string, unknown> {
  return {
    vendedor_id: vendedorId,
    zona_id: zonaId,
  };
}
