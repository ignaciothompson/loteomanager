/**
 * Footer component for the admin panel.
 */
import { Component } from '@angular/core';

@Component({
    standalone: true,
    selector: 'app-footer',
    template: `<div class="layout-footer">
        LoteoManager &copy; {{ currentYear }} — Panel de Administración
    </div>`
})
export class AppFooter {
    currentYear = new Date().getFullYear();
}
