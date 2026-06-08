/** Payload para crear vendedor_zonas; incluye `zona` text si el schema legacy aún lo exige. */
export function buildVendedorZonaCreatePayload(
  vendedorId: string,
  zonaId: string,
  zonaNombre?: string,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    vendedor_id: vendedorId,
    zona_id: zonaId,
  };

  const nombre = (zonaNombre ?? '').trim();
  if (nombre) {
    payload['zona'] = nombre;
  }

  return payload;
}
