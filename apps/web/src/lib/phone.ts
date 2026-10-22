export function waDigits(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('0') ? `254${digits.slice(1)}` : digits;
}

export function waHref(phone: string) {
  return `https://wa.me/${waDigits(phone)}`;
}
