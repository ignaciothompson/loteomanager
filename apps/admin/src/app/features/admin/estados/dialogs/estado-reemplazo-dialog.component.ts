import { Component, input, model, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { RippleModule } from 'primeng/ripple';

@Component({
  selector: 'app-estado-reemplazo-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, ButtonModule, SelectModule, RippleModule],
  templateUrl: './estado-reemplazo-dialog.component.html'
})
export class EstadoReemplazoDialogComponent {
  visible = input(false);
  visibleChange = output<boolean>();
  options = input<{ label: string; value: string }[]>([]);
  reemplazoId = model<string | null>(null);

  confirm = output<void>();

  onCancel(): void {
    this.visibleChange.emit(false);
  }

  onConfirm(): void {
    this.confirm.emit();
  }
}
