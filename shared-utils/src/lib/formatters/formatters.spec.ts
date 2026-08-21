import { formatCurrency, formatDate, formatPrecio } from './formatters';

describe('formatters', () => {
  it('should format currency ARS as $U without cents for integers', () => {
    expect(formatCurrency(1500, 'ARS')).toBe('$U 1.500');
  });

  it('formatPrecio USD integer', () => {
    expect(formatPrecio(52000, 'USD')).toBe('US$ 52.000');
  });

  it('formatPrecio ARS integer', () => {
    expect(formatPrecio(1850000, 'ARS')).toBe('$U 1.850.000');
  });

  it('formatPrecio keeps decimals when present', () => {
    expect(formatPrecio(52000.5, 'USD')).toBe('US$ 52.000,5');
  });

  it('should format date correctly', () => {
    const d = new Date('2024-01-15T12:00:00Z');
    const res = formatDate(d, 'short');
    expect(res.length).toBeGreaterThan(0);
  });
});
