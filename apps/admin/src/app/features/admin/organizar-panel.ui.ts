import { Injectable, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService } from 'primeng/api';

export type OrgPanelMode = 'closed' | 'detail' | 'edit' | 'create';

export const ORG_PANEL_MS = 140;

function reducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

@Injectable()
export class OrgPanelUi {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private confirm = inject(ConfirmationService);

  readonly mode = signal<OrgPanelMode>('closed');
  readonly selectedId = signal<string | null>(null);
  readonly leaving = signal(false);
  readonly shown = computed(() => this.mode() !== 'closed' || this.leaving());

  private leaveTimer: ReturnType<typeof setTimeout> | null = null;
  private lastFocusId: string | null = null;

  openDetail(id: string): void {
    this.cancelLeave();
    this.leaving.set(false);
    this.selectedId.set(id);
    this.mode.set('detail');
    this.lastFocusId = id;
    this.writeSel(id);
  }

  openEdit(id: string): void {
    this.cancelLeave();
    this.leaving.set(false);
    this.selectedId.set(id);
    this.mode.set('edit');
    this.lastFocusId = id;
    this.writeSel(id);
  }

  openCreate(): void {
    this.cancelLeave();
    this.leaving.set(false);
    this.selectedId.set(null);
    this.mode.set('create');
    this.writeSel(null);
  }

  toggleRow(id: string, dirty: boolean): void {
    if (this.mode() === 'detail' && this.selectedId() === id) {
      this.requestClose(dirty);
      return;
    }
    this.requestClose(dirty, () => this.openDetail(id));
  }

  requestClose(dirty: boolean, next?: () => void): void {
    const run = () => {
      if (next) next();
      else this.close();
    };
    if (!dirty || (this.mode() !== 'edit' && this.mode() !== 'create')) {
      run();
      return;
    }
    this.confirm.confirm({
      message: 'Hay cambios sin guardar. ¿Descartarlos?',
      header: 'Cambios sin guardar',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Descartar',
      rejectLabel: 'Seguir editando',
      accept: run
    });
  }

  close(): void {
    const focusId = this.lastFocusId;
    this.mode.set('closed');
    this.selectedId.set(null);
    this.writeSel(null);
    if (reducedMotion()) {
      this.leaving.set(false);
      this.focusRow(focusId);
      return;
    }
    this.leaving.set(true);
    this.cancelLeave();
    this.leaveTimer = setTimeout(() => {
      this.leaving.set(false);
      this.leaveTimer = null;
      this.focusRow(focusId);
    }, ORG_PANEL_MS);
  }

  consumeQuerySel(id: string | null, exists: (id: string) => boolean): void {
    if (!id || !exists(id)) return;
    this.openDetail(id);
    queueMicrotask(() => {
      document.getElementById(`org-row-${id}`)?.scrollIntoView({ block: 'nearest' });
    });
  }

  private writeSel(id: string | null): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { sel: id },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  private focusRow(id: string | null): void {
    queueMicrotask(() => {
      const el = id ? document.getElementById(`org-row-${id}`) : null;
      el?.focus();
    });
  }

  private cancelLeave(): void {
    if (this.leaveTimer) {
      clearTimeout(this.leaveTimer);
      this.leaveTimer = null;
    }
  }
}
