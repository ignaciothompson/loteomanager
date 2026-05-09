export function isValidEmail(email: string): boolean {
  if (!email) return false;
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(email);
}

export function isValidPhoneAR(phone: string): boolean {
  if (!phone) return false;
  // Basic validation for Argentine mobile numbers (with or without +54 9)
  const re = /^(\+?54\s?9\s?)?[1-3][0-9]{2,3}[-\s]?[0-9]{6}$/;
  return re.test(phone.replace(/\s+/g, ''));
}
