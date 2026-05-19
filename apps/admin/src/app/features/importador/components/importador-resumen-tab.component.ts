import { Component, Input } from '@angular/core';
import { ImportacionesResponse } from '@loteomanager/shared-types';
import { ImportacionFilasResponse } from '@loteomanager/shared-types';

interface FilaExtendida extends ImportacionFilasResponse {
  tipo_fila: 'barrio' | 'unidad';
  mensajes: string[];
  registro_creado_id?: string;
  error_aplicacion?: string;
}

@Component({
  selector: 'app-importador-resumen-tab',
  standalone: true,
  imports: [],
  template: `
    <div class="grid gap-3" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));">
      <!-- OK -->
      <div class="p-3 border-round border-1 text-center" style="border-color: #22c55e; background: #f0fdf4;">
        <i class="pi pi-check-circle text-3xl mb-2 block" style="color: #22c55e;"></i>
        <div class="text-3xl font-bold" style="color: #16a34a;">{{ importacion?.filas_ok ?? 0 }}</div>
        <div class="text-sm font-semibold mt-1" style="color: #15803d;">OK</div>
      </div>
      <!-- Duplicados -->
      <div class="p-3 border-round border-1 text-center" style="border-color: #eab308; background: #fefce8;">
        <i class="pi pi-copy text-3xl mb-2 block" style="color: #eab308;"></i>
        <div class="text-3xl font-bold" style="color: #ca8a04;">{{ importacion?.filas_duplicado ?? 0 }}</div>
        <div class="text-sm font-semibold mt-1" style="color: #a16207;">Duplicados</div>
      </div>
      <!-- Errores -->
      <div class="p-3 border-round border-1 text-center" style="border-color: #ef4444; background: #fef2f2;">
        <i class="pi pi-times-circle text-3xl mb-2 block" style="color: #ef4444;"></i>
        <div class="text-3xl font-bold" style="color: #dc2626;">{{ importacion?.filas_error ?? 0 }}</div>
        <div class="text-sm font-semibold mt-1" style="color: #b91c1c;">Errores</div>
      </div>
      <!-- Advertencias -->
      <div class="p-3 border-round border-1 text-center" style="border-color: #f97316; background: #fff7ed;">
        <i class="pi pi-exclamation-triangle text-3xl mb-2 block" style="color: #f97316;"></i>
        <div class="text-3xl font-bold" style="color: #ea580c;">{{ importacion?.filas_advertencia ?? 0 }}</div>
        <div class="text-sm font-semibold mt-1" style="color: #c2410c;">Advertencias</div>
      </div>
    </div>

    <div class="mt-4">
      <div class="flex gap-4 text-sm text-500">
        <span><strong class="text-900">Total filas:</strong> {{ importacion?.total_filas ?? 0 }}</span>
        <span><strong class="text-900">Tipo:</strong> {{ importacion?.tipo ?? '—' }}</span>
        <span><strong class="text-900">Origen:</strong> {{ importacion?.origen ?? '—' }}</span>
      </div>
    </div>
  `,
})
export class ImportadorResumenTabComponent {
  @Input() importacion: ImportacionesResponse | null = null;
  @Input() filas: FilaExtendida[] = [];
}
