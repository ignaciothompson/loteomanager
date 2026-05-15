import { Directive, Input, TemplateRef, ViewContainerRef, inject, effect } from '@angular/core';
import { AuthService } from '@loteomanager/shared-pb-client';

@Directive({
  selector: '[hasRole]',
  standalone: true
})
export class HasRoleDirective {
  private templateRef = inject(TemplateRef<any>);
  private viewContainer = inject(ViewContainerRef);
  private authService = inject(AuthService);

  private hasView = false;
  private allowedRoles: string[] = [];

  constructor() {
    effect(() => {
      const currentRole = this.authService.currentRole();
      
      const hasRole = currentRole ? this.allowedRoles.includes(currentRole) : false;

      if (hasRole && !this.hasView) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.hasView = true;
      } else if (!hasRole && this.hasView) {
        this.viewContainer.clear();
        this.hasView = false;
      }
    });
  }

  @Input() set hasRole(roles: string[]) {
    this.allowedRoles = roles;
  }
}
