import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';

@Component({
  imports: [RouterModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private title = inject(Title);
  private meta = inject(Meta);

  ngOnInit() {
    this.title.setTitle('LoteoManager');
    this.meta.addTags([
      { name: 'description', content: 'LoteoManager - Plataforma de gestión y ventas de lotes' },
      { property: 'og:title', content: 'LoteoManager' },
      { property: 'og:description', content: 'LoteoManager - Plataforma de gestión y ventas de lotes' },
      { property: 'og:type', content: 'website' }
    ]);
  }
}

