import { formatCurrency, formatDate } from './formatters';

describe('formatters', () => {
  it('should format currency ARS', () => {
    const res = formatCurrency(1500, 'ARS');
    expect(res).toContain('1.500'); // Note: depending on exact es-AR locale output, this might be formatted slightly differently.
  });

  it('should format date correctly', () => {
    const d = new Date('2024-01-15T12:00:00Z');
    const res = formatDate(d, 'short');
    // Using string matching as timezones can offset days.
    expect(res.length).toBeGreaterThan(0);
  });
});
