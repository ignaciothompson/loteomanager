import { Injectable, computed, inject, signal } from '@angular/core';
import { ExtrasDefinicionesService } from './extras-definiciones.service';
import { EstadosDefinicionesService } from './estados-definiciones.service';
import type { EntidadExtra, EntidadEstado, EstadoDefinicion, ExtrasDefinicion } from '@loteomanager/shared-types';

@Injectable({
  providedIn: 'root'
})
export class DefinicionesCacheService {
  private extrasSvc = inject(ExtrasDefinicionesService);
  private estadosSvc = inject(EstadosDefinicionesService);

  readonly extras = signal<ExtrasDefinicion[]>([]);
  readonly estados = signal<EstadoDefinicion[]>([]);

  readonly extrasByEntidad = computed(() => {
    const m = new Map<EntidadExtra, ExtrasDefinicion[]>();
    for (const e of this.extras()) {
      if (!e.activo) continue;
      if (!m.has(e.entidad)) m.set(e.entidad, []);
      m.get(e.entidad)!.push(e);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => (a.orden_display ?? 0) - (b.orden_display ?? 0));
    }
    return m;
  });

  readonly estadosByEntidad = computed(() => {
    const m = new Map<EntidadEstado, EstadoDefinicion[]>();
    for (const s of this.estados()) {
      if (!s.activo) continue;
      if (!m.has(s.entidad)) m.set(s.entidad, []);
      m.get(s.entidad)!.push(s);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => (a.orden_display ?? 0) - (b.orden_display ?? 0));
    }
    return m;
  });

  extrasActivosPara(entidad: EntidadExtra): ExtrasDefinicion[] {
    return this.extrasByEntidad().get(entidad) ?? [];
  }

  estadosActivosPara(entidad: EntidadEstado): EstadoDefinicion[] {
    return this.estadosByEntidad().get(entidad) ?? [];
  }

  estadoPorCode(entidad: EntidadEstado, code: string): EstadoDefinicion | undefined {
    return this.estados().find((s) => s.entidad === entidad && s.code === code);
  }

  async load(): Promise<void> {
    const [ex, st] = await Promise.all([
      this.extrasSvc.listAllAsync().catch(() => []),
      this.estadosSvc.listAllAsync().catch(() => [])
    ]);
    this.extras.set(ex);
    this.estados.set(st);
  }

  async refresh(): Promise<void> {
    await this.load();
  }
}
