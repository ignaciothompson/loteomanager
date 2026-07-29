/**
 * Main navigation menu for the LoteoManager admin panel.
 * Defines the sidebar menu structure with real business sections.
 */
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { AppMenuitem } from './app.menuitem';
import { AuthService, PermisosService } from '@loteomanager/shared-pb-client';

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
    private permisos = inject(PermisosService);

    ngOnInit() {
        const role = this.authService.currentRole() || 'vendedor';

        const inventarioItems: MenuItem[] = [
            {
                label: 'Barrios',
                icon: 'pi pi-fw pi-map',
                routerLink: ['/barrios']
            },
        ];
        if (this.permisos.can('web.publish')) {
            inventarioItems.push({
                label: 'Actualizacion Web',
                icon: 'pi pi-fw pi-cloud-upload',
                routerLink: ['/actualizacion-web']
            });
        }

        this.model = [
            {
                items: [
                    {
                        label: 'Dashboard',
                        icon: 'pi pi-fw pi-home',
                        routerLink: ['/']
                    }
                ]
            },
            {
                label: 'Inventario',
                icon: 'pi pi-fw pi-box',
                items: inventarioItems
            },
            {
                label: 'Ventas',
                icon: 'pi pi-fw pi-shopping-cart',
                items: [
                    {
                        label: 'Contactos',
                        icon: 'pi pi-fw pi-users',
                        routerLink: ['/interesados']
                    },
                    {
                        label: 'Comparativas',
                        icon: 'pi pi-fw pi-link',
                        routerLink: ['/enlaces']
                    },
                ]
            }
        ];

        if (role === 'admin') {
            this.model.push({
                label: 'Directorio y Configuración',
                icon: 'pi pi-fw pi-cog',
                items: [
                    {
                        label: 'Organizar',
                        icon: 'pi pi-fw pi-sliders-h',
                        path: '/config',
                        items: [
                            {
                                label: 'Departamentos',
                                icon: 'pi pi-fw pi-sitemap',
                                routerLink: ['/config/departamentos']
                            },
                            {
                                label: 'Zonas',
                                icon: 'pi pi-fw pi-map',
                                routerLink: ['/config/zonas']
                            },
                            {
                                label: 'Extras',
                                icon: 'pi pi-fw pi-list',
                                routerLink: ['/config/extras']
                            },
                            {
                                label: 'Estados',
                                icon: 'pi pi-fw pi-flag',
                                routerLink: ['/config/estados']
                            }
                        ]
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
                    },
                    {
                        label: 'Exportador',
                        icon: 'pi pi-fw pi-download',
                        routerLink: ['/exportador']
                    }
                ]
            });
        } else if (role === 'supervisor') {
            const organizarItems: MenuItem[] = [
                {
                    label: 'Zonas',
                    icon: 'pi pi-fw pi-map',
                    routerLink: ['/config/zonas']
                },
            ];
            if (this.permisos.can('extras.crud')) {
                organizarItems.push({
                    label: 'Extras',
                    icon: 'pi pi-fw pi-list',
                    routerLink: ['/config/extras']
                });
            }
            if (this.permisos.can('estados.crud')) {
                organizarItems.push({
                    label: 'Estados',
                    icon: 'pi pi-fw pi-flag',
                    routerLink: ['/config/estados']
                });
            }

            const configItems: MenuItem[] = [
                {
                    label: 'Organizar',
                    icon: 'pi pi-fw pi-sliders-h',
                    path: '/config',
                    items: organizarItems
                },
            ];
            if (this.permisos.can('importador.use')) {
                configItems.push({
                    label: 'Importador',
                    icon: 'pi pi-fw pi-cloud-upload',
                    routerLink: ['/importador']
                });
                configItems.push({
                    label: 'Exportador',
                    icon: 'pi pi-fw pi-download',
                    routerLink: ['/exportador']
                });
            }

            this.model.push({
                label: 'Configuración',
                icon: 'pi pi-fw pi-cog',
                items: configItems
            });
        }
    }
}
