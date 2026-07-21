import {
  Component, Input, OnDestroy, AfterViewInit,
  ElementRef, ViewChild, inject, effect, PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { Map as LeafletMap, TileLayer } from 'leaflet';
import {
  isInUruguay,
  URUGUAY_CENTER,
  URUGUAY_DEFAULT_ZOOM,
  leafletUruguayMaxBounds,
} from '@loteomanager/shared-utils';
import { ThemeService } from '../../services/theme.service';

export interface MapaMarcador {
  lat: number;
  lng: number;
  titulo: string;
}

const CARTO_LIGHT = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const CARTO_DARK  = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const CARTO_ATTR  = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const MARKER_ICON_RETINA = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
const MARKER_ICON = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const MARKER_SHADOW = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

const leafletImport: Promise<typeof import('leaflet')> | null =
  typeof window !== 'undefined' ? import('leaflet') : null;

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

    this.L = await (leafletImport ?? import('leaflet'));
    if (this.destroyed) return;
    const L = this.L;

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

    const tileUrl = this.themeService.currentTheme() === 'dark' ? CARTO_DARK : CARTO_LIGHT;
    this.tileLayer = L.tileLayer(tileUrl, { attribution: CARTO_ATTR, maxZoom: 19 }).addTo(map);

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
      const valid = this.marcadores.filter((m) => isInUruguay(m.lat, m.lng));
      if (!valid.length) {
        map.setView([URUGUAY_CENTER[0], URUGUAY_CENTER[1]], URUGUAY_DEFAULT_ZOOM);
      } else {
        const bounds = L.latLngBounds([]);
        for (const m of valid) {
          L.marker([m.lat, m.lng]).addTo(map).bindPopup(m.titulo);
          bounds.extend([m.lat, m.lng]);
        }
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
    } else if (this.lat != null && this.lng != null && isInUruguay(this.lat, this.lng)) {
      map.setView([this.lat, this.lng], 15);
      L.marker([this.lat, this.lng]).addTo(map).bindPopup(this.titulo ?? '');
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
