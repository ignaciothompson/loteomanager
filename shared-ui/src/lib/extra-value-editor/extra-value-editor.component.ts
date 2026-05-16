import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { DatePickerModule } from 'primeng/datepicker';
import type { ExtraValor, ExtrasDefinicion } from '@loteomanager/shared-types';

@Component({
  selector: 'lib-extra-value-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    ToggleSwitchModule,
    DatePickerModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (definicion(); as def) {
      @switch (def.tipo) {
        @case ('texto') {
          <input
            pInputText
            class="w-full"
            [ngModel]="asString(valor())"
            (ngModelChange)="valorChange.emit($event)"
          />
        }
        @case ('numero') {
          <p-inputNumber
            class="w-full"
            [ngModel]="asNumber(valor())"
            (ngModelChange)="valorChange.emit($event)"
            [useGrouping]="false"
            [style]="{ width: '100%' }"
          />
        }
        @case ('booleano') {
          <p-toggleSwitch [ngModel]="asBool(valor())" (ngModelChange)="valorChange.emit($event)" />
        }
        @case ('fecha') {
          <p-datepicker
            [ngModel]="asDate(valor())"
            (ngModelChange)="onDate($event)"
            dateFormat="yy-mm-dd"
            [showIcon]="true"
            appendTo="body"
            styleClass="w-full"
          />
        }
        @case ('opciones') {
          <p-select
            [options]="opcionesSelect()"
            optionLabel="label"
            optionValue="value"
            [ngModel]="valor()"
            (ngModelChange)="valorChange.emit($event)"
            [placeholder]="'Elegí una opción'"
            styleClass="w-full"
            appendTo="body"
          />
        }
      }
    }
  `
})
export class ExtraValueEditorComponent {
  definicion = input.required<ExtrasDefinicion>();
  valor = input<ExtraValor>(null);
  valorChange = output<ExtraValor>();

  opcionesSelect() {
    const raw = this.definicion().opciones;
    const list = Array.isArray(raw) ? (raw as string[]) : [];
    return list.map((v) => ({ label: v, value: v }));
  }

  asString(v: ExtraValor): string {
    return v == null ? '' : String(v);
  }

  asNumber(v: ExtraValor): number | null {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return v;
    const n = Number(v);
    return Number.isNaN(n) ? null : n;
  }

  asBool(v: ExtraValor): boolean {
    return v === true;
  }

  asDate(v: ExtraValor): Date | null {
    if (v == null || v === '') return null;
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  onDate(d: Date | null) {
    if (!d) {
      this.valorChange.emit(null);
      return;
    }
    this.valorChange.emit(d.toISOString());
  }
}
