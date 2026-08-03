/**
 * Deep links para os apps do celular. O Campo mostra; o aparelho liga e navega.
 * Telefones do seed vêm sem máscara (só dígitos, com DDD).
 */

const soDigitos = (t: string) => t.replace(/\D/g, "");

export function linkLigar(telefone: string): string {
  return `tel:+55${soDigitos(telefone)}`;
}

export function linkWhatsApp(telefone: string): string {
  return `https://wa.me/55${soDigitos(telefone)}`;
}

export function linkGoogleMaps(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function linkWaze(lat: number, lng: number): string {
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
}
