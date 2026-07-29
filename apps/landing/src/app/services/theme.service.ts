import { Injectable, signal, computed, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  private _theme = signal<Theme>('light');

  readonly currentTheme = this._theme.asReadonly();
  readonly isDark = computed(() => false);

  constructor() {
    if (this.isBrowser) {
      effect(() => {
        // Light-only: never apply .dark
        document.documentElement.classList.remove('dark');
        void this._theme();
      });
    }
  }

  toggle(): void {
    // no-op: light only
  }

  setTheme(_theme: Theme): void {
    this._theme.set('light');
  }
}
