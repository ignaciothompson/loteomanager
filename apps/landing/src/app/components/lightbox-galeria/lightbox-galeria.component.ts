import { Component, Input, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lightbox-galeria',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (activeImage()) {
      <div class="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
           (click)="cerrar()">
        <button class="absolute top-4 right-4 text-white/80 hover:text-white transition"
                (click)="cerrar()" aria-label="Cerrar galería">
          <i class="pi pi-times text-2xl"></i>
        </button>

        @if (hasPrev()) {
          <button class="absolute left-4 top-1/2 -translate-y-1/2
                         text-white/80 hover:text-white transition"
                  (click)="prev($event)" aria-label="Anterior">
            <i class="pi pi-chevron-left text-3xl"></i>
          </button>
        }

        <img [src]="activeImage()"
             class="max-w-full max-h-[90vh] object-contain rounded-lg"
             (click)="$event.stopPropagation()"
             alt="Imagen ampliada" />

        @if (hasNext()) {
          <button class="absolute right-4 top-1/2 -translate-y-1/2
                         text-white/80 hover:text-white transition"
                  (click)="next($event)" aria-label="Siguiente">
            <i class="pi pi-chevron-right text-3xl"></i>
          </button>
        }

        <div class="absolute bottom-4 text-white/60 text-sm">
          {{ activeIndex() + 1 }} / {{ images.length }}
        </div>
      </div>
    }
  `,
})
export class LightboxGaleriaComponent {
  @Input() images: string[] = [];

  readonly activeIndex = signal(-1);
  readonly activeImage = signal<string | null>(null);

  readonly hasPrev = () => this.activeIndex() > 0;
  readonly hasNext = () => this.activeIndex() < this.images.length - 1;

  open(index: number) {
    this.activeIndex.set(index);
    this.activeImage.set(this.images[index] ?? null);
  }

  cerrar() {
    this.activeIndex.set(-1);
    this.activeImage.set(null);
  }

  prev(e: Event) {
    e.stopPropagation();
    const i = this.activeIndex() - 1;
    if (i >= 0) this.open(i);
  }

  next(e: Event) {
    e.stopPropagation();
    const i = this.activeIndex() + 1;
    if (i < this.images.length) this.open(i);
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (!this.activeImage()) return;
    if (e.key === 'Escape') this.cerrar();
    if (e.key === 'ArrowLeft') this.prev(e);
    if (e.key === 'ArrowRight') this.next(e);
  }
}
