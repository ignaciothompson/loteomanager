/**
 * Main navigation menu for the LoteoManager admin panel.
 * Defines the sidebar menu structure with real business sections.
 */
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { AppMenuitem } from './app.menuitem';
import { AuthService } from '@loteomanager/shared-pb-client';

@Component({
    selector: 'app-menu',
    standalone: true,
    imports: [CommonModule, AppMenuitem, RouterModule],
    template: `<ul class="layout-menu">
        @for (item of model; track item.label) {
            @if (!item.separator) {
                <li app-menuitem [item]="item" [root]="true"></li>
            } @else {
                <li class="menu-separator"></li>
            }
        }
    </ul> `,
})
export class AppMenu {
    model: MenuItem[] = [];
    private authService = inject(AuthService);

    ngOnInit() {
        const role = this.authService.currentRole() || 'vendedor';

        this.model = [
            {
                label: 'Home',
                items: [
                    {
                        label: 'Dashboard',
                        icon: 'pi pi-fw pi-home',
                        routerLink: ['/']
                    }
                ]
            },
            {
                label: 'Mi Cuenta',
                items: [
                    { label: 'Mi Perfil', icon: 'pi pi-fw pi-user', routerLink: ['/mi-perfil'] }
                ]
            },
            {
                label: 'Inventario',
                icon: 'pi pi-fw pi-box',
                items: [
                    {
                        label: 'Barrios',
                        icon: 'pi pi-fw pi-map',
                        routerLink: ['/barrios']
                    },
                    {
                        label: 'Lotes / Unidades',
                        icon: 'pi pi-fw pi-th-large',
                        routerLink: ['/lotes']
                    }
                ]
            },
            {
                label: 'Ventas',
                icon: 'pi pi-fw pi-shopping-cart',
                items: [
                    {
                        label: 'Interesados',
                        icon: 'pi pi-fw pi-users',
                        routerLink: ['/interesados']
                    },
                    {
                        label: 'Comparativas',
                        icon: 'pi pi-fw pi-link',
                        routerLink: ['/enlaces']
                    }
                ]
            }
        ];

        if (role === 'admin') {
            this.model.push({
                label: 'Directorio y Configuración',
                icon: 'pi pi-fw pi-cog',
                items: [
                    {
                        label: 'Extras',
                        icon: 'pi pi-fw pi-list',
                        routerLink: ['/config/extras']
                    },
                    {
                        label: 'Estados',
                        icon: 'pi pi-fw pi-flag',
                        routerLink: ['/config/estados']
                    },
                    {
                        label: 'Arquitectos',
                        icon: 'pi pi-fw pi-building',
                        routerLink: ['/arquitectos']
                    },
                    {
                        label: 'Usuarios',
                        icon: 'pi pi-fw pi-user',
                        routerLink: ['/usuarios']
                    },
                    {
                        label: 'Importador',
                        icon: 'pi pi-fw pi-cloud-upload',
                        routerLink: ['/importador']
                    }
                ]
            });
        }
    }
}
