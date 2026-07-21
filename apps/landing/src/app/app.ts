import { Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { DemoPaletaSwitcherComponent } from './components/demo-paleta-switcher/demo-paleta-switcher.component';

@Component({
  imports: [RouterModule, DemoPaletaSwitcherComponent],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private title = inject(Title);
  private meta = inject(Meta);
  private platformId = inject(PLATFORM_ID);

  readonly showDemoSwitcher = signal(false);

  ngOnInit() {
    this.title.setTitle('LoteoManager');
    this.meta.addTags([
      { name: 'description', content: 'LoteoManager - Plataforma de gestión y ventas de lotes' },
      { property: 'og:title', content: 'LoteoManager' },
      { property: 'og:description', content: 'LoteoManager - Plataforma de gestión y ventas de lotes' },
      { property: 'og:type', content: 'website' },
    ]);

    if (isPlatformBrowser(this.platformId)) {
      const demoTema = new URLSearchParams(window.location.search).get('demo-tema');
      this.showDemoSwitcher.set(demoTema !== null && demoTema !== 'false');
    }
  }
}
