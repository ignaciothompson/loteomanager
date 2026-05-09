/**
 * Main navigation menu for the LoteoManager admin panel.
 * Defines the sidebar menu structure with real business sections.
 */
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { AppMenuitem } from './app.menuitem';

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

    ngOnInit() {
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
                label: 'Inventario',
                icon: 'pi pi-fw pi-box',
                path: '/inventario',
                items: [
                    {
                        label: 'Barrios',
                        icon: 'pi pi-fw pi-map',
                        routerLink: ['/barrios']
                    },
                    {
                        label: 'Lotes',
                        icon: 'pi pi-fw pi-th-large',
                        routerLink: ['/lotes']
                    }
                ]
            },
            {
                label: 'Ventas',
                icon: 'pi pi-fw pi-shopping-cart',
                path: '/ventas',
                items: [
                    {
                        label: 'Interesados',
                        icon: 'pi pi-fw pi-users',
                        routerLink: ['/interesados']
                    },
                    {
                        label: 'Enlaces compartibles',
                        icon: 'pi pi-fw pi-link',
                        routerLink: ['/enlaces']
                    }
                ]
            },
            {
                label: 'Directorio',
                icon: 'pi pi-fw pi-address-book',
                path: '/directorio',
                items: [
                    {
                        label: 'Arquitectos',
                        icon: 'pi pi-fw pi-building',
                        routerLink: ['/arquitectos']
                    },
                    {
                        label: 'Usuarios',
                        icon: 'pi pi-fw pi-user',
                        routerLink: ['/usuarios']
                    }
                ]
            }
        ];
    }
}
