/**
 * Root component for the admin app.
 * Simply renders the router outlet — all layout logic lives in AppLayout.
 */
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterModule],
    template: `<router-outlet></router-outlet>`
})
export class AppComponent {}
