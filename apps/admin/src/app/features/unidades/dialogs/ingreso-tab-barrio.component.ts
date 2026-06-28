import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TextareaModule } from 'primeng/textarea';
import { FileUploadModule } from 'primeng/fileupload';
import type { BarriosResponse } from '@loteomanager/shared-types';
import type { IngresoPaso2BarrioDraft } from './ingreso-unidades.types';

@Component({
  selector: 'app-ingreso-tab-barrio',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TextareaModule, FileUploadModule],
  templateUrl: './ingreso-tab-barrio.component.html'
})
export class IngresoTabBarrioComponent {
  barrio = input.required<BarriosResponse>();
  departamentoNombre = input('');
  zonaNombre = input('');
  draft = model.required<IngresoPaso2BarrioDraft>();

  onPlanoSelect(event: { files: File[] }): void {
    const file = event.files?.[0];
    if (file) this.draft.update((d) => ({ ...d, planoFile: file }));
  }

  onImagenSelect(event: { files: File[] }): void {
    const file = event.files?.[0];
    if (file) this.draft.update((d) => ({ ...d, imagenFile: file }));
  }
}
