/**
 * Entry point for the LoteoManager admin application.
 * Bootstraps the Angular app with the provided configuration.
 */
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app.config';
import { AppComponent } from './app.component';

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
