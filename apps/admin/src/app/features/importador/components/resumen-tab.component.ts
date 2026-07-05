import { Component, Input, computed } from '@angular/core';
import type { ImportacionesResponse } from '@loteomanager/shared-types';
import type { FilaExtendida } from '../importador-types';

@Component({
  selector: 'app-resumen-tab',
  standalone: true,
  template: `
    <div class="grid gap-3" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));">
      <div class="p-3 border-round border-1 text-center" style="border-color: #22c55e; background: #f0fdf4;">
        <i class="pi pi-check-circle text-3xl mb-2 block" style="color: #22c55e;"></i>
        <div class="text-3xl font-bold" style="color: #16a34a;">{{ importacion?.filas_ok ?? 0 }}</div>
        <div class="text-sm font-semibold mt-1" style="color: #15803d;">OK</div>
      </div>
      <div class="p-3 border-round border-1 text-center" style="border-color: #eab308; background: #fefce8;">
        <i class="pi pi-copy text-3xl mb-2 block" style="color: #eab308;"></i>
        <div class="text-3xl font-bold" style="color: #ca8a04;">{{ importacion?.filas_duplicado ?? 0 }}</div>
        <div class="text-sm font-semibold mt-1" style="color: #a16207;">Duplicados</div>
      </div>
      <div class="p-3 border-round border-1 text-center" style="border-color: #ef4444; background: #fef2f2;">
        <i class="pi pi-times-circle text-3xl mb-2 block" style="color: #ef4444;"></i>
        <div class="text-3xl font-bold" style="color: #dc2626;">{{ importacion?.filas_error ?? 0 }}</div>
        <div class="text-sm font-semibold mt-1" style="color: #b91c1c;">Errores</div>
      </div>
    </div>

    @if (barriosDuplicados() > 0) {
      <p class="mt-4 mb-0 text-sm text-600">
        <i class="pi pi-info-circle mr-1"></i>
        {{ barriosDuplicados() }} barrio(s) ya existen — sus unidades se importarán igualmente.
      </p>
    }

    <div class="mt-4 text-sm text-500 flex gap-4 flex-wrap">
      <span><strong class="text-900">Total filas:</strong> {{ importacion?.total_filas ?? 0 }}</span>
      <span><strong class="text-900">Tipo:</strong> {{ importacion?.tipo ?? '—' }}</span>
    </div>
  `,
})
export class ResumenTabComponent {
  @Input() importacion: ImportacionesResponse | null = null;
  @Input() filas: FilaExtendida[] = [];

  barriosDuplicados = computed(
    () =>
      this.filas.filter((f) => f.tipo_fila === 'barrio' && f.estado_fila === 'duplicado').length
  );
}
