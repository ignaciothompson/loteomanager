import {
  Component, Input, OnDestroy, AfterViewInit,
  ElementRef, ViewChild, inject, effect, PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { Map as LeafletMap, TileLayer } from 'leaflet';
import { ThemeService } from '../../services/theme.service';

export interface MapaMarcador {
  lat: number;
  lng: number;
  titulo: string;
}

const CARTO_LIGHT = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const CARTO_DARK  = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const CARTO_ATTR  = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

@Component({
  selector: 'landing-mapa',
  standalone: true,
  template: `<div #mapContainer class="w-full h-full"></div>`,
  styles: [`:host { display: block; width: 100%; height: 100%; }`],
})
export class LandingMapaComponent implements AfterViewInit, OnDestroy {
  @Input() lat?: number | null;
  @Input() lng?: number | null;
  @Input() titulo?: string | null;
  @Input() marcadores?: MapaMarcador[] | null;
  @Input() focusLat?: number | null;
  @Input() focusLng?: number | null;
  @Input() focusZoom = 14;

  @ViewChild('mapContainer') mapContainer!: ElementRef<HTMLElement>;

  private platformId = inject(PLATFORM_ID);
  private themeService = inject(ThemeService);

  private map: LeafletMap | null = null;
  private tileLayer: TileLayer | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private L: typeof import('leaflet') | null = null;
  private destroyed = false;
  private invalidateTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const theme = this.themeService.currentTheme();
      if (this.L && this.map && this.tileLayer) {
        this.updateTileLayer(theme);
      }
    });
  }

  async ngAfterViewInit() {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.mapContainer?.nativeElement) return;

    this.L = await import('leaflet');
    if (this.destroyed) return;
    const L = this.L;

    // Fix default marker icons broken by bundlers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    const map = L.map(this.mapContainer.nativeElement, {
      scrollWheelZoom: false,
      zoomControl: true,
    });
    this.map = map;

    const tileUrl = this.themeService.currentTheme() === 'dark' ? CARTO_DARK : CARTO_LIGHT;
    this.tileLayer = L.tileLayer(tileUrl, { attribution: CARTO_ATTR, maxZoom: 19 }).addTo(map);

    map.invalidateSize();
    this.invalidateTimer = setTimeout(() => {
      this.invalidateTimer = null;
      if (!this.map) return;
      this.map.invalidateSize();
      this.applyViewAndMarkers(L, this.map);
    }, 0);

    this.resizeObserver = new ResizeObserver(() => {
      this.map?.invalidateSize();
    });
    this.resizeObserver.observe(this.mapContainer.nativeElement);
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

  private applyViewAndMarkers(L: typeof import('leaflet'), map: LeafletMap): void {
    if (this.marcadores?.length) {
      const bounds = L.latLngBounds([]);
      for (const m of this.marcadores) {
        L.marker([m.lat, m.lng]).addTo(map).bindPopup(m.titulo);
        bounds.extend([m.lat, m.lng]);
      }
      map.fitBounds(bounds, { padding: [40, 40] });
    } else if (this.lat != null && this.lng != null) {
      map.setView([this.lat, this.lng], 15);
      L.marker([this.lat, this.lng]).addTo(map).bindPopup(this.titulo ?? '');
    }

    if (this.focusLat != null && this.focusLng != null) {
      map.setView([this.focusLat, this.focusLng], this.focusZoom);
    }
  }

  private updateTileLayer(theme: 'light' | 'dark') {
    if (!this.L || !this.map) return;
    const L = this.L;
    const map = this.map;
    if (this.tileLayer) {
      this.tileLayer.remove();
    }
    const tileUrl = theme === 'dark' ? CARTO_DARK : CARTO_LIGHT;
    this.tileLayer = L.tileLayer(tileUrl, { attribution: CARTO_ATTR, maxZoom: 19 }).addTo(map);
    map.invalidateSize();
  }
}
