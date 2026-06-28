import { Component, inject, input, model, OnDestroy, output, signal } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { FileUploadModule } from 'primeng/fileupload';
import { POCKETBASE } from '@loteomanager/shared-pb-client';

export type IngresoImagenesDraft = {
  planoFile: File | null;
  imagenFile: File | null;
  planoNombre?: string;
  imagenNombre?: string;
};

@Component({
  selector: 'app-ingreso-imagenes-dialog',
  standalone: true,
  imports: [DialogModule, ButtonModule, FileUploadModule],
  templateUrl: './ingreso-imagenes-dialog.component.html',
  styleUrl: './ingreso-imagenes-dialog.component.css'
})
export class IngresoImagenesDialogComponent implements OnDestroy {
  visible = model(false);
  barrio = input<{ id: string; collectionId?: string; collectionName?: string } | null>(null);
  draft = input<IngresoImagenesDraft>({ planoFile: null, imagenFile: null });

  confirm = output<IngresoImagenesDraft>();

  private pb = inject(POCKETBASE);
  private blobUrls: string[] = [];

  local: IngresoImagenesDraft = { planoFile: null, imagenFile: null };
  planoPreviewSrc: string | null = null;
  imagenPreviewSrc: string | null = null;

  readonly zoomVisible = model(false);
  readonly zoomSrc = signal<string | null>(null);
  readonly zoomTitle = signal('');

  ngOnDestroy(): void {
    this.releaseBlobUrls();
  }

  onShow(): void {
    this.closeZoom();
    this.releaseBlobUrls();
    this.local = { ...this.draft() };
    this.refreshPreviews();
  }

  onHide(): void {
    this.closeZoom();
  }

  onPlanoSelect(event: { files: File[] }): void {
    const file = event.files?.[0];
    if (file) this.local = { ...this.local, planoFile: file, planoNombre: file.name };
    this.refreshPreviews();
  }

  onImagenSelect(event: { files: File[] }): void {
    const file = event.files?.[0];
    if (file) this.local = { ...this.local, imagenFile: file, imagenNombre: file.name };
    this.refreshPreviews();
  }

  openZoom(src: string, title: string): void {
    this.zoomSrc.set(src);
    this.zoomTitle.set(title);
    this.zoomVisible.set(true);
  }

  closeZoom(): void {
    this.zoomVisible.set(false);
    this.zoomSrc.set(null);
    this.zoomTitle.set('');
  }

  planoIsImage(): boolean {
    const name = this.local.planoFile?.name ?? this.local.planoNombre;
    return !!name && this.isImageFile(name);
  }

  imagenIsImage(): boolean {
    const name = this.local.imagenFile?.name ?? this.local.imagenNombre;
    return !!name && this.isImageFile(name);
  }

  aceptar(): void {
    this.confirm.emit(this.local);
    this.visible.set(false);
  }

  private refreshPreviews(): void {
    this.releaseBlobUrls();
    this.planoPreviewSrc = this.resolvePreview('plano');
    this.imagenPreviewSrc = this.resolvePreview('imagen');
  }

  private resolvePreview(kind: 'plano' | 'imagen'): string | null {
    const file = kind === 'plano' ? this.local.planoFile : this.local.imagenFile;
    const name = kind === 'plano' ? this.local.planoNombre : this.local.imagenNombre;
    if (file) {
      const url = URL.createObjectURL(file);
      this.blobUrls.push(url);
      return url;
    }
    const record = this.barrio();
    if (!record || !name) return null;
    return this.pb.files.getURL(record as Parameters<typeof this.pb.files.getURL>[0], name);
  }

  private isImageFile(name: string): boolean {
    return /\.(jpe?g|png|webp|svg|gif)$/i.test(name);
  }

  private releaseBlobUrls(): void {
    for (const url of this.blobUrls) URL.revokeObjectURL(url);
    this.blobUrls = [];
  }
}
