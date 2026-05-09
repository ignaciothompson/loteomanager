import { slugify } from './slugify';

describe('slugify', () => {
  it('should convert strings to slugs', () => {
    expect(slugify('Hola Mundo')).toBe('hola-mundo');
    expect(slugify('¿Qué tal?')).toBe('que-tal');
    expect(slugify('  español  ')).toBe('espanol');
  });
});
