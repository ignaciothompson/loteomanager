import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DecimalPipe, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AutoCompleteCompleteEvent, AutoCompleteModule, AutoCompleteSelectEvent } from 'primeng/autocomplete';
import type { Map as LeafletMap, Marker } from 'leaflet';
import {
  isInUruguay,
  leafletUruguayMaxBounds,
  URUGUAY_CENTER,
  URUGUAY_DEFAULT_ZOOM,
} from '@loteomanager/shared-utils';
import { GeocodeService, type GeocodeHit } from '../../services/geocode.service';

const CARTO_LIGHT =
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const CARTO_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const MARKER_ICON_RETINA = '/leaflet/marker-icon-2x.png';
const MARKER_ICON = '/leaflet/marker-icon.png';
const MARKER_SHADOW = '/leaflet/marker-shadow.png';

const MONTEVIDEO: readonly [number, number] = [-34.9011, -56.1645];

export type IngresoGeoLocation = {
  lat: number;
  lng: number;
  label?: string;
};

@Component({
  selector: 'app-ingreso-geo-picker',
  standalone: true,
  imports: [FormsModule, AutoCompleteModule, DecimalPipe],
  templateUrl: './ingreso-geo-picker.component.html',
  styleUrl: './ingreso-geo-picker.component.css',
})
export class IngresoGeoPickerComponent implements AfterViewInit, OnDestroy {
  lat = input<number | null>(null);
  lng = input<number | null>(null);
  /** Current address text; used to decide whether reverse-geocode fills label. */
  ubicacionTexto = input<string>('');

  locationChange = output<IngresoGeoLocation>();

  @ViewChild('mapEl') mapEl?: ElementRef<HTMLElement>;

  private platformId = inject(PLATFORM_ID);
  private geocode = inject(GeocodeService);

  private map: LeafletMap | null = null;
  private marker: Marker | null = null;
  private L: typeof import('leaflet') | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private invalidateTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private mapReady = false;
  private syncingFromInputs = false;

  readonly query = signal('');
  readonly suggestions = signal<GeocodeHit[]>([]);
  readonly searching = signal(false);
  readonly pickedLat = signal<number | null>(null);
  readonly pickedLng = signal<number | null>(null);

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const lat = this.lat();
      const lng = this.lng();
      if (!this.mapReady || !this.map || !this.marker || !this.L) return;
      if (lat == null || lng == null || !isInUruguay(lat, lng)) return;
      const curLat = this.pickedLat();
      const curLng = this.pickedLng();
      if (curLat === lat && curLng === lng) return;
      this.syncingFromInputs = true;
      this.pickedLat.set(lat);
      this.pickedLng.set(lng);
      this.marker.setLatLng([lat, lng]);
      this.map.setView([lat, lng], Math.max(this.map.getZoom(), 13));
      this.syncingFromInputs = false;
    });
  }

  async ngAfterViewInit(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    await this.initMap();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.debounceTimer != null) clearTimeout(this.debounceTimer);
    if (this.invalidateTimer != null) clearTimeout(this.invalidateTimer);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.destroyMap();
  }

  onSearch(event: AutoCompleteCompleteEvent): void {
    const q = event.query?.trim() ?? '';
    this.query.set(q);
    if (this.debounceTimer != null) clearTimeout(this.debounceTimer);
    if (q.length < 3) {
      this.suggestions.set([]);
      return;
    }
    this.debounceTimer = setTimeout(() => void this.runSearch(q), 350);
  }

  onSelect(event: AutoCompleteSelectEvent): void {
    const hit = event.value as GeocodeHit;
    if (!hit || !isInUruguay(hit.lat, hit.lng)) return;
    this.applyLocation(hit.lat, hit.lng, hit.label, true);
    this.query.set(hit.label);
  }

  onQueryChange(value: string | GeocodeHit): void {
    if (typeof value === 'string') {
      this.query.set(value);
      return;
    }
    if (value && typeof value === 'object' && 'label' in value) {
      this.query.set(value.label);
    }
  }

  private async runSearch(q: string): Promise<void> {
    this.searching.set(true);
    try {
      const hits = await this.geocode.search(q);
      if (!this.destroyed) this.suggestions.set(hits);
    } catch {
      if (!this.destroyed) this.suggestions.set([]);
    } finally {
      if (!this.destroyed) this.searching.set(false);
    }
  }

  private async initMap(): Promise<void> {
    if (!this.mapEl?.nativeElement) return;

    this.L = await import('leaflet').then((m) => {
      const mod = m as { default?: typeof import('leaflet') } & typeof import('leaflet');
      return (mod.default ?? mod) as typeof import('leaflet');
    });
    if (this.destroyed) return;
    const L = this.L;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: MARKER_ICON_RETINA,
      iconUrl: MARKER_ICON,
      shadowUrl: MARKER_SHADOW,
    });

    const initLat = this.lat();
    const initLng = this.lng();
    let startLat = MONTEVIDEO[0];
    let startLng = MONTEVIDEO[1];
    let zoom = 13;
    if (initLat != null && initLng != null && isInUruguay(initLat, initLng)) {
      startLat = initLat;
      startLng = initLng;
      this.pickedLat.set(initLat);
      this.pickedLng.set(initLng);
    } else {
      startLat = URUGUAY_CENTER[0];
      startLng = URUGUAY_CENTER[1];
      zoom = URUGUAY_DEFAULT_ZOOM;
    }

    const map = L.map(this.mapEl.nativeElement, {
      maxBounds: L.latLngBounds(leafletUruguayMaxBounds()),
      maxBoundsViscosity: 1.0,
      minZoom: 6,
      scrollWheelZoom: true,
    }).setView([startLat, startLng], zoom);

    L.tileLayer(CARTO_LIGHT, { attribution: CARTO_ATTR, maxZoom: 19 }).addTo(map);

    const marker = L.marker([startLat, startLng], { draggable: true }).addTo(map);
    marker.on('dragend', () => {
      if (this.syncingFromInputs) return;
      const pos = marker.getLatLng();
      if (!isInUruguay(pos.lat, pos.lng)) {
        const lat = this.pickedLat();
        const lng = this.pickedLng();
        if (lat != null && lng != null) marker.setLatLng([lat, lng]);
        else marker.setLatLng([MONTEVIDEO[0], MONTEVIDEO[1]]);
        return;
      }
      void this.applyLocation(pos.lat, pos.lng, undefined, false);
    });

    map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
      if (this.syncingFromInputs) return;
      if (!isInUruguay(e.latlng.lat, e.latlng.lng)) return;
      void this.applyLocation(e.latlng.lat, e.latlng.lng, undefined, false);
    });

    this.map = map;
    this.marker = marker;
    this.mapReady = true;

    map.invalidateSize();
    this.invalidateTimer = setTimeout(() => {
      this.invalidateTimer = null;
      this.map?.invalidateSize();
    }, 0);

    this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
    this.resizeObserver.observe(this.mapEl.nativeElement);
  }

  private async applyLocation(
    lat: number,
    lng: number,
    label: string | undefined,
    fromSearch: boolean,
  ): Promise<void> {
    this.pickedLat.set(lat);
    this.pickedLng.set(lng);
    if (this.marker) this.marker.setLatLng([lat, lng]);
    if (this.map && fromSearch) this.map.setView([lat, lng], 15);

    let outLabel = label;
    const existing = this.ubicacionTexto().trim();
    if (!outLabel && !existing) {
      outLabel = (await this.geocode.reverse(lat, lng)) ?? undefined;
      if (outLabel) this.query.set(outLabel);
    } else if (fromSearch && label) {
      this.query.set(label);
    }

    this.locationChange.emit({
      lat,
      lng,
      label: outLabel,
    });
  }

  private destroyMap(): void {
    this.mapReady = false;
    if (this.map) {
      this.map.remove();
      this.map = null;
      this.marker = null;
    }
  }
}
