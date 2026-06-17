import {
  AfterViewInit,
  Component,
  inject,
  input,
  model,
  OnDestroy,
  output,
  PLATFORM_ID,
  ViewChild,
  ElementRef
} from '@angular/core';
import { DecimalPipe, isPlatformBrowser } from '@angular/common';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-ingreso-geo-dialog',
  standalone: true,
  imports: [DecimalPipe, DialogModule, ButtonModule],
  templateUrl: './ingreso-geo-dialog.component.html',
  styleUrl: './ingreso-geo-dialog.component.css'
})
export class IngresoGeoDialogComponent implements AfterViewInit, OnDestroy {
  visible = model(false);
  lat = input<number | null>(null);
  lng = input<number | null>(null);

  confirm = output<{ lat: number; lng: number }>();

  @ViewChild('mapEl') mapEl?: ElementRef<HTMLElement>;

  private platformId = inject(PLATFORM_ID);
  private map: { remove(): void; setView(latlng: [number, number], zoom: number): void } | null = null;
  private marker: { setLatLng(latlng: [number, number]): void } | null = null;
  private L: typeof import('leaflet') | null = null;

  pickedLat: number | null = null;
  pickedLng: number | null = null;

  async ngAfterViewInit(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
  }

  ngOnDestroy(): void {
    this.destroyMap();
  }

  async onShow(): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || !this.mapEl?.nativeElement) return;

    this.pickedLat = this.lat() ?? -34.9011;
    this.pickedLng = this.lng() ?? -56.1645;

    this.destroyMap();
    this.L = await import('leaflet');
    const L = this.L;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
    });

    const map = L.map(this.mapEl.nativeElement).setView([this.pickedLat, this.pickedLng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    const marker = L.marker([this.pickedLat, this.pickedLng], { draggable: true }).addTo(map);
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      this.pickedLat = pos.lat;
      this.pickedLng = pos.lng;
    });
    map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
      this.pickedLat = e.latlng.lat;
      this.pickedLng = e.latlng.lng;
      marker.setLatLng([this.pickedLat, this.pickedLng]);
    });

    this.map = map;
    this.marker = marker;
  }

  onHide(): void {
    this.destroyMap();
  }

  aceptar(): void {
    if (this.pickedLat == null || this.pickedLng == null) return;
    this.confirm.emit({ lat: this.pickedLat, lng: this.pickedLng });
    this.visible.set(false);
  }

  private destroyMap(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
      this.marker = null;
    }
  }
}
