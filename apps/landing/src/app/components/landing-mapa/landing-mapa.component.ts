import {
  Component, Input, OnDestroy, AfterViewInit, OnChanges, SimpleChanges,
  ElementRef, ViewChild, inject, PLATFORM_ID, signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { Map as LeafletMap, Marker, TileLayer } from 'leaflet';
import {
  isInUruguay,
  URUGUAY_CENTER,
  URUGUAY_DEFAULT_ZOOM,
  leafletUruguayMaxBounds,
} from '@loteomanager/shared-utils';

export interface MapaMarcador {
  lat: number;
  lng: number;
  titulo: string;
}

const CARTO_LIGHT = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const CARTO_ATTR  = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const MARKER_ICON_RETINA = '/leaflet/marker-icon-2x.png';
const MARKER_ICON = '/leaflet/marker-icon.png';
const MARKER_SHADOW = '/leaflet/marker-shadow.png';

@Component({
  selector: 'landing-mapa',
  standalone: true,
  template: `
    <div #mapContainer class="w-full h-full"></div>
    @if (initError()) {
      <div class="absolute inset-0 flex items-center justify-center p-6 bg-surface-100/90">
        <p class="text-sm text-surface-600 text-center m-0">{{ initError() }}</p>
      </div>
    }
  `,
  styles: [`:host { display: block; position: relative; width: 100%; height: 100%; }`],
})
export class LandingMapaComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() lat?: number | null;
  @Input() lng?: number | null;
  @Input() titulo?: string | null;
  @Input() marcadores?: MapaMarcador[] | null;
  @Input() focusLat?: number | null;
  @Input() focusLng?: number | null;
  @Input() focusZoom = 14;

  @ViewChild('mapContainer') mapContainer!: ElementRef<HTMLElement>;

  private platformId = inject(PLATFORM_ID);

  private map: LeafletMap | null = null;
  private tileLayer: TileLayer | null = null;
  private markers: Marker[] = [];
  private resizeObserver: ResizeObserver | null = null;
  private L: typeof import('leaflet') | null = null;
  private destroyed = false;
  private invalidateTimer: ReturnType<typeof setTimeout> | null = null;
  private initStarted = false;

  readonly initError = signal<string | null>(null);

  async ngAfterViewInit() {
    await this.ensureMap();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!this.map || !this.L) return;
    if (
      changes['marcadores'] ||
      changes['lat'] ||
      changes['lng'] ||
      changes['titulo'] ||
      changes['focusLat'] ||
      changes['focusLng'] ||
      changes['focusZoom']
    ) {
      this.applyViewAndMarkers(this.L, this.map);
      this.map.invalidateSize();
    }
  }

  ngOnDestroy() {
    this.destroyed = true;
    if (this.invalidateTimer != null) {
      clearTimeout(this.invalidateTimer);
      this.invalidateTimer = null;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  private async ensureMap(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.initStarted || this.map) return;
    if (!this.mapContainer?.nativeElement) return;
    this.initStarted = true;

    try {
      const L = await import('leaflet');
      if (this.destroyed) return;
      this.L = L;

      // Fix default marker icons broken by bundlers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: MARKER_ICON_RETINA,
        iconUrl: MARKER_ICON,
        shadowUrl: MARKER_SHADOW,
      });

      const map = L.map(this.mapContainer.nativeElement, {
        scrollWheelZoom: false,
        zoomControl: true,
        maxBounds: L.latLngBounds(leafletUruguayMaxBounds()),
        maxBoundsViscosity: 1.0,
        minZoom: 6,
      });
      this.map = map;

      this.tileLayer = L.tileLayer(CARTO_LIGHT, { attribution: CARTO_ATTR, maxZoom: 19 }).addTo(map);

      this.applyViewAndMarkers(L, map);
      map.invalidateSize();
      this.invalidateTimer = setTimeout(() => {
        this.invalidateTimer = null;
        if (!this.map) return;
        this.map.invalidateSize();
        if (
          this.focusLat != null &&
          this.focusLng != null &&
          isInUruguay(this.focusLat, this.focusLng)
        ) {
          this.map.setView([this.focusLat, this.focusLng], this.focusZoom);
        }
      }, 0);

      this.resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry || entry.contentRect.width <= 0 || entry.contentRect.height <= 0) return;
        this.map?.invalidateSize();
      });
      this.resizeObserver.observe(this.mapContainer.nativeElement);
      this.initError.set(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo cargar el mapa';
      this.initError.set(msg);
      console.error('[landing-mapa] init failed', err);
    }
  }

  private clearMarkers(): void {
    for (const m of this.markers) {
      m.remove();
    }
    this.markers = [];
  }

  private applyViewAndMarkers(L: typeof import('leaflet'), map: LeafletMap): void {
    this.clearMarkers();

    if (this.marcadores?.length) {
      const valid = this.marcadores.filter((m) => isInUruguay(m.lat, m.lng));
      if (!valid.length) {
        map.setView([URUGUAY_CENTER[0], URUGUAY_CENTER[1]], URUGUAY_DEFAULT_ZOOM);
      } else {
        const bounds = L.latLngBounds([]);
        for (const m of valid) {
          const marker = L.marker([m.lat, m.lng]).addTo(map).bindPopup(m.titulo);
          this.markers.push(marker);
          bounds.extend([m.lat, m.lng]);
        }
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
    } else if (this.lat != null && this.lng != null && isInUruguay(this.lat, this.lng)) {
      map.setView([this.lat, this.lng], 15);
      const marker = L.marker([this.lat, this.lng]).addTo(map).bindPopup(this.titulo ?? '');
      this.markers.push(marker);
    } else {
      map.setView([URUGUAY_CENTER[0], URUGUAY_CENTER[1]], URUGUAY_DEFAULT_ZOOM);
    }

    if (
      this.focusLat != null &&
      this.focusLng != null &&
      isInUruguay(this.focusLat, this.focusLng)
    ) {
      map.setView([this.focusLat, this.focusLng], this.focusZoom);
    }
  }
}
