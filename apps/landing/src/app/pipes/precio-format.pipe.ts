import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'precioFormat', standalone: true, pure: true })
export class PrecioFormatPipe implements PipeTransform {
  transform(value: number, moneda: string = 'USD'): string {
    if (value == null) return '—';
    const num = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(value);
    return `${moneda} ${num}`;
  }
}
