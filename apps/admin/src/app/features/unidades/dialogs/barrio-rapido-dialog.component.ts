import { Component, input, model, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { RippleModule } from 'primeng/ripple';

@Component({
  selector: 'app-barrio-rapido-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, ButtonModule, InputTextModule, RippleModule],
  templateUrl: './barrio-rapido-dialog.component.html'
})
export class BarrioRapidoDialogComponent {
  visible = input(false);
  visibleChange = output<boolean>();
  nombre = model('');

  save = output<void>();
  cancel = output<void>();

  onCancel(): void {
    this.cancel.emit();
    this.visibleChange.emit(false);
  }
}
