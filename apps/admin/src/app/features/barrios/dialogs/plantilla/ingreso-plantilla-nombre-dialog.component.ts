import { ChangeDetectionStrategy, Component, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'app-ingreso-plantilla-nombre-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DialogModule, ButtonModule, InputTextModule],
  templateUrl: './ingreso-plantilla-nombre-dialog.component.html'
})
export class IngresoPlantillaNombreDialogComponent {
  visible = model(false);
  nombre = model('');
  saving = model(false);

  confirm = output<string>();

  aceptar(): void {
    const value = this.nombre().trim();
    if (!value) return;
    this.confirm.emit(value);
  }

  onHide(): void {
    if (!this.saving()) {
      this.nombre.set('');
    }
  }
}
