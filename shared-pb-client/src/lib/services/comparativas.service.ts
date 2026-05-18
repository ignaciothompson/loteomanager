import { Injectable, inject } from '@angular/core';
import { BaseCollectionService } from '../base-collection.service';
import { ComparativasResponse, ComparativasRecord } from '@loteomanager/shared-types';
import { ConfigService } from './config.service';

/** Landing base URL for dev — override in production via config or env */
const DEV_LANDING_URL = 'http://localhost:4201';

@Injectable({
  providedIn: 'root'
})
export class ComparativasService extends BaseCollectionService<ComparativasResponse> {
  protected override collectionName = 'comparativas';
  private configService = inject(ConfigService);

  getLandingBaseUrl(): string {
    // In production this will come from a config field (e.g. config.landing_base_url).
    // For now: use window.location replacing admin port heuristic, or env-based.
    if (typeof window === 'undefined') return DEV_LANDING_URL;

    const origin = window.location.origin;
    // If running on standard ports (4200 admin), redirect to 4201 (landing dev)
    if (origin.includes('localhost:4200')) return 'http://localhost:4201';
    if (origin.includes('localhost:4300')) return 'http://localhost:4201';

    // Production: assume landing and admin share same domain root
    // (e.g. admin on admin.example.com, landing on example.com)
    return origin;
  }

  async crear(payload: Partial<ComparativasRecord>): Promise<{ record: ComparativasResponse; url: string }> {
    const record = await this.create(payload);
    const publicUrl = `${this.getLandingBaseUrl()}/c/${record.token_publico}`;
    return { record, url: publicUrl };
  }

  async generarPdf(comparativaId: string): Promise<string> {
    // TODO: call /api/comparativas/:token/pdf endpoint
    console.log(`[ComparativasService] generarPdf para ${comparativaId}`);
    return Promise.resolve('');
  }
}
