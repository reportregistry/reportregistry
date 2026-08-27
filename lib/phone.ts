// Normalizes phone numbers to a consistent, digit-only key so
// "(555) 123-4567", "555-123-4567", and "+1 5551234567" all match the same
// stored report. Strips a US/Canada country code prefix (leading "1" on an
// 11-digit number) but otherwise keeps digits as-is, so international
// numbers still work as long as they're entered consistently.
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }
  return digits || null;
}
