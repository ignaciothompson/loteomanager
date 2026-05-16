import { Directive, Input, TemplateRef, ViewContainerRef, inject, effect, signal } from '@angular/core';
import { PermisosService, Permiso } from '@loteomanager/shared-pb-client';

@Directive({
  selector: '[hasPermiso]',
  standalone: true,
})
export class HasPermisoDirective {
  private templateRef = inject(TemplateRef<unknown>);
  private viewContainer = inject(ViewContainerRef);
  private permisosService = inject(PermisosService);

  private hasView = false;
  private permisos = signal<Permiso[]>([]);

  constructor() {
    effect(() => {
      const permisoList = this.permisos();
      const hasPermiso = permisoList.length > 0
        ? this.permisosService.canAll(...permisoList)
        : false;

      if (hasPermiso && !this.hasView) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.hasView = true;
      } else if (!hasPermiso && this.hasView) {
        this.viewContainer.clear();
        this.hasView = false;
      }
    });
  }

  @Input() set hasPermiso(value: Permiso | Permiso[]) {
    this.permisos.set(Array.isArray(value) ? value : [value]);
  }
}
