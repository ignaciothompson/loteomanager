import { computed, signal, type WritableSignal } from '@angular/core';
import type {
  PreferenciasListadoService,
  ListadoKey,
  PreferenciasListadoPayload
} from '@loteomanager/shared-pb-client';
import type { ColumnDef, ColumnFilterValue, ColumnFilters, ListadoOrden } from './column-def';
import {
  countActiveFilters,
  defaultVisibleIds,
  isFilterActive,
  rowMatchesFilters,
  sanitizeColumnIds,
  sortRows
} from './listado-filter.util';

export class ListadoPrefsController<T> {
  readonly visibleIds: WritableSignal<string[]>;
  readonly orden = signal<ListadoOrden>(null);
  readonly filters = signal<ColumnFilters>({});
  readonly search = signal('');
  readonly prefsLoaded = signal(false);
  readonly filterRemovedNotice = signal<string | null>(null);

  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private catalogFn: () => ColumnDef<T>[];

  constructor(
    private listado: ListadoKey,
    catalogFn: () => ColumnDef<T>[],
    private prefsSvc: PreferenciasListadoService,
    private getUserId: () => string | undefined
  ) {
    this.catalogFn = catalogFn;
    this.visibleIds = signal(defaultVisibleIds(catalogFn()));
  }

  readonly activeFilterCount = computed(() => countActiveFilters(this.filters()));

  readonly visibleColumns = computed(() => {
    const catalog = this.catalogFn();
    const byId = new Map(catalog.map((c) => [c.id, c]));
    return this.visibleIds()
      .map((id) => byId.get(id))
      .filter((c): c is ColumnDef<T> => !!c);
  });

  applyPipeline(allRows: T[]): T[] {
    const catalog = this.catalogFn();
    const filtered = allRows.filter((row) =>
      rowMatchesFilters(row, catalog, this.filters(), this.search())
    );
    return sortRows(filtered, catalog, this.orden());
  }

  async load(): Promise<void> {
    const userId = this.getUserId();
    if (!userId) {
      this.resetToDefaults(false);
      this.prefsLoaded.set(true);
      return;
    }
    try {
      const pref = await this.prefsSvc.getForUser(userId, this.listado);
      if (pref) {
        this.visibleIds.set(sanitizeColumnIds(pref.columnas as string[] | null, this.catalogFn()));
        this.orden.set((pref.orden as ListadoOrden) ?? null);
        this.filters.set(this.sanitizeFilters((pref.filtros as ColumnFilters) ?? {}));
      } else {
        this.resetToDefaults(false);
      }
    } catch (err) {
      console.warn('[ListadoPrefs] load failed', err);
      this.resetToDefaults(false);
    } finally {
      this.prefsLoaded.set(true);
    }
  }

  resyncCatalog(): void {
    this.visibleIds.update((ids) => sanitizeColumnIds(ids, this.catalogFn()));
    this.filters.update((f) => this.sanitizeFilters(f));
  }

  setSearch(value: string): void {
    this.search.set(value);
    this.scheduleSave();
  }

  setFilter(colId: string, value: ColumnFilterValue): void {
    this.filters.update((f) => {
      const next = { ...f };
      if (!isFilterActive(value)) delete next[colId];
      else next[colId] = value;
      return next;
    });
    this.scheduleSave();
  }

  clearFilters(): void {
    this.filters.set({});
    this.search.set('');
    this.filterRemovedNotice.set(null);
    this.scheduleSave();
  }

  toggleSort(colId: string): void {
    const col = this.catalogFn().find((c) => c.id === colId);
    if (!col?.ordenable) return;
    const cur = this.orden();
    if (!cur || cur.campo !== colId) {
      this.orden.set({ campo: colId, dir: 'asc' });
    } else if (cur.dir === 'asc') {
      this.orden.set({ campo: colId, dir: 'desc' });
    } else {
      this.orden.set(null);
    }
    this.scheduleSave();
  }

  setVisibleIds(ids: string[]): void {
    const prev = this.visibleIds();
    const removed = prev.filter((id) => !ids.includes(id));
    const notices: string[] = [];
    this.filters.update((f) => {
      const next = { ...f };
      for (const id of removed) {
        if (isFilterActive(next[id])) {
          const label = this.catalogFn().find((c) => c.id === id)?.label ?? id;
          notices.push(label);
          delete next[id];
        }
      }
      return next;
    });
    this.visibleIds.set(sanitizeColumnIds(ids, this.catalogFn()));
    if (notices.length) {
      this.filterRemovedNotice.set(
        notices.length === 1
          ? `Se quitó el filtro de "${notices[0]}"`
          : `Se quitaron filtros de: ${notices.map((n) => `"${n}"`).join(', ')}`
      );
    }
    this.scheduleSave();
  }

  restoreDefaults(): void {
    this.resetToDefaults(true);
  }

  private resetToDefaults(persist: boolean): void {
    this.visibleIds.set(defaultVisibleIds(this.catalogFn()));
    this.orden.set(null);
    this.filters.set({});
    this.search.set('');
    this.filterRemovedNotice.set(null);
    if (persist) this.scheduleSave();
  }

  private sanitizeFilters(raw: ColumnFilters): ColumnFilters {
    const known = new Set(this.catalogFn().map((c) => c.id));
    const out: ColumnFilters = {};
    for (const [k, v] of Object.entries(raw ?? {})) {
      if (known.has(k) && isFilterActive(v)) out[k] = v;
    }
    return out;
  }

  private scheduleSave(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.persist(), 800);
  }

  private async persist(): Promise<void> {
    const userId = this.getUserId();
    if (!userId) return;
    const payload: PreferenciasListadoPayload = {
      columnas: this.visibleIds(),
      orden: this.orden(),
      filtros: this.filters()
    };
    try {
      await this.prefsSvc.upsertForUser(userId, this.listado, payload);
    } catch (err) {
      console.warn('[ListadoPrefs] save failed', err);
    }
  }
}
