/** wa.me link for a Kenyan number written locally (0712…) or with a country code. */
export function waHref(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits.startsWith('0') ? `254${digits.slice(1)}` : digits}`;
}
