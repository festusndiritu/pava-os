/** Digits WhatsApp wants for a Kenyan number written locally (0712…) or with a country code. */
export function waDigits(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('0') ? `254${digits.slice(1)}` : digits;
}

/** wa.me link for a Kenyan number written locally (0712…) or with a country code. */
export function waHref(phone: string) {
  return `https://wa.me/${waDigits(phone)}`;
}
