import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { isInUruguay } from '@loteomanager/shared-utils';

export type GeocodeHit = {
  label: string;
  lat: number;
  lng: number;
};

type NominatimResult = {
  display_name?: string;
  lat?: string;
  lon?: string;
};

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const UA = 'LoteoManagerAdmin/1.0 (barrio-geo; contact=dev@loteomanager.local)';

@Injectable({ providedIn: 'root' })
export class GeocodeService {
  private http = inject(HttpClient);

  async search(query: string): Promise<GeocodeHit[]> {
    const q = query.trim();
    if (q.length < 3) return [];

    const params = new HttpParams()
      .set('format', 'json')
      .set('limit', '5')
      .set('countrycodes', 'uy')
      .set('addressdetails', '0')
      .set('q', q);

    const rows = await firstValueFrom(
      this.http.get<NominatimResult[]>(`${NOMINATIM_BASE}/search`, {
        params,
        headers: this.headers(),
      }),
    );

    return (rows ?? [])
      .map((r) => this.toHit(r))
      .filter((h): h is GeocodeHit => h != null && isInUruguay(h.lat, h.lng));
  }

  async reverse(lat: number, lng: number): Promise<string | null> {
    if (!isInUruguay(lat, lng)) return null;

    const params = new HttpParams()
      .set('format', 'json')
      .set('lat', String(lat))
      .set('lon', String(lng))
      .set('zoom', '16')
      .set('addressdetails', '0');

    try {
      const row = await firstValueFrom(
        this.http.get<NominatimResult>(`${NOMINATIM_BASE}/reverse`, {
          params,
          headers: this.headers(),
        }),
      );
      const label = row?.display_name?.trim();
      return label || null;
    } catch {
      return null;
    }
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({
      Accept: 'application/json',
      'Accept-Language': 'es',
      // Browsers may strip User-Agent; Nominatim still accepts this for identification.
      'User-Agent': UA,
    });
  }

  private toHit(r: NominatimResult): GeocodeHit | null {
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    const label = r.display_name?.trim();
    if (!label || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { label, lat, lng };
  }
}
