import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="empty-state text-center p-8 flex flex-col items-center justify-center">
      <i [class]="icon()" class="text-4xl text-gray-400 mb-4"></i>
      <h3 class="text-xl font-semibold mb-2">{{ title() }}</h3>
      <p class="text-gray-500">{{ message() }}</p>
    </div>
  `,
  styles: [`
    .empty-state {
      min-height: 200px;
    }
  `]
})
export class EmptyStateComponent {
  icon = input<string>('pi pi-inbox');
  title = input<string>('No hay datos');
  message = input<string>('No se encontraron registros para mostrar.');
}
