import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'dato-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dato-card">
      <i [class]="'pi ' + icon + ' text-2xl text-primary mb-2'"></i>
      <div class="text-sm text-surface-500">{{ label }}</div>
      <div class="text-lg font-medium">{{ value ?? '—' }}</div>
    </div>
  `,
})
export class DatoCardComponent {
  @Input({ required: true }) icon!: string;
  @Input({ required: true }) label!: string;
  @Input() value: string | number | null | undefined;
}
