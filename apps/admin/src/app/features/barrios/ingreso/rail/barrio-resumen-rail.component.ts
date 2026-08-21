import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import type { Map as LeafletMap, Marker } from 'leaflet';
import type { TipoUnidadIngreso } from '@loteomanager/shared-types';
import { TIPO_UNIDAD_LABELS } from '@loteomanager/shared-utils';

const CARTO_DARK =
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const CARTO_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

@Component({
  selector: 'app-barrio-resumen-rail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ButtonModule, ToggleSwitchModule],
  templateUrl: './barrio-resumen-rail.component.html',
  styleUrl: './barrio-resumen-rail.component.css',
})
export class BarrioResumenRailComponent implements AfterViewInit, OnDestroy {
  @ViewChild('miniMap') private miniMapEl?: ElementRef<HTMLDivElement>;

  private readonly platformId = inject(PLATFORM_ID);

  nombre = input('');
  slug = input('');
  zonaLabel = input('');
  deptoLabel = input('');
  tipos = input<TipoUnidadIngreso[]>([]);
  unidadesCount = input(0);
  imagenesLabel = input('Sin imágenes');
  lat = input<number | null>(null);
  lng = input<number | null>(null);
  publicado = input(false);
  puedePublicar = input(false);

  edit = output<void>();
  publicadoChange = output<boolean>();

  private map: LeafletMap | null = null;
  private marker: Marker | null = null;
  private L: typeof import('leaflet') | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private invalidateTimer: ReturnType<typeof setTimeout> | null = null;
  private viewReady = false;

  readonly tiposLabel = computed(() => {
    const tipos = this.tipos();
    if (!tipos.length) return 'Sin tipos';
    return tipos.map((t) => TIPO_UNIDAD_LABELS[t] ?? t).join(' · ');
  });

  readonly lugarLabel = computed(() => {
    const depto = this.deptoLabel();
    const zona = this.zonaLabel();
    if (depto && zona) return `${zona} / ${depto}`;
    return zona || depto || '—';
  });

  readonly hasCoords = computed(() => {
    const lat = this.lat();
    const lng = this.lng();
    return lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);
  });

  constructor() {
    effect(() => {
      const lat = this.lat();
      const lng = this.lng();
      const ready = this.viewReady;
      if (!ready || !isPlatformBrowser(this.platformId)) return;
      void this.syncMap(lat, lng);
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    if (!isPlatformBrowser(this.platformId)) return;
    void this.syncMap(this.lat(), this.lng());
  }

  ngOnDestroy(): void {
    this.teardownMap();
  }

  private async syncMap(lat: number | null, lng: number | null): Promise<void> {
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      this.teardownMap();
      return;
    }

    // Wait for @if (hasCoords) to mount #miniMap
    await Promise.resolve();
    let el = this.miniMapEl?.nativeElement;
    if (!el) {
      await new Promise<void>((r) => setTimeout(r, 0));
      el = this.miniMapEl?.nativeElement;
    }
    if (!el) return;

    if (!this.L) {
      this.L = await import('leaflet');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (this.L.Icon.Default.prototype as any)._getIconUrl;
      this.L.Icon.Default.mergeOptions({
        iconRetinaUrl: '/leaflet/marker-icon-2x.png',
        iconUrl: '/leaflet/marker-icon.png',
        shadowUrl: '/leaflet/marker-shadow.png',
      });
    }
    const L = this.L;

    if (!this.map) {
      const map = L.map(el, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        touchZoom: false,
      }).setView([lat, lng], 14);

      L.tileLayer(CARTO_DARK, { attribution: CARTO_ATTR, maxZoom: 19 }).addTo(map);
      this.marker = L.marker([lat, lng], { interactive: false }).addTo(map);
      this.map = map;

      this.resizeObserver = new ResizeObserver(() => this.scheduleInvalidate());
      this.resizeObserver.observe(el);
      this.scheduleInvalidate();
      return;
    }

    this.map.setView([lat, lng], 14);
    this.marker?.setLatLng([lat, lng]);
    this.scheduleInvalidate();
  }

  private scheduleInvalidate(): void {
    if (this.invalidateTimer) clearTimeout(this.invalidateTimer);
    this.map?.invalidateSize();
    this.invalidateTimer = setTimeout(() => {
      this.invalidateTimer = null;
      this.map?.invalidateSize();
    }, 50);
  }

  private teardownMap(): void {
    if (this.invalidateTimer) {
      clearTimeout(this.invalidateTimer);
      this.invalidateTimer = null;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.map?.remove();
    this.map = null;
    this.marker = null;
  }
}
