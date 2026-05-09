import { isValidEmail, isValidPhoneAR } from './validators';

describe('validators', () => {
  it('should validate emails correctly', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('invalid-email')).toBe(false);
  });

  it('should validate AR phones correctly', () => {
    expect(isValidPhoneAR('+5491123456789')).toBe(true);
    expect(isValidPhoneAR('1123456789')).toBe(true); // Without country code
    expect(isValidPhoneAR('invalid')).toBe(false);
  });
});
