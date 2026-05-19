import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface ConfigPublica {
  nombreInmobiliaria: string;
  logoUrl: string | null;
  mensajeBienvenida: string | null;
}

const CONFIG_FALLBACK: ConfigPublica = {
  nombreInmobiliaria: 'LoteoManager',
  logoUrl: null,
  mensajeBienvenida: null,
};

@Injectable({ providedIn: 'root' })
export class ConfigPublicaService {
  private http = inject(HttpClient);

  readonly config = signal<ConfigPublica>(CONFIG_FALLBACK);

  async load(): Promise<void> {
    try {
      const data = await firstValueFrom(
        this.http.get<ConfigPublica>('/api/config-publica')
      );
      this.config.set(data ?? CONFIG_FALLBACK);
    } catch {
      this.config.set(CONFIG_FALLBACK);
    }
  }
}
