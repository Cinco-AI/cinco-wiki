import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

/** Date relative FR : « il y a 2 heures », « il y a 3 jours » (§4.2). */
export function relativeDate(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: fr });
}

export function fullName(u: { firstName: string; lastName: string }): string {
  return `${u.firstName} ${u.lastName}`.trim();
}

export function initials(u: { firstName: string; lastName: string }): string {
  return `${u.firstName[0] ?? ""}${u.lastName[0] ?? ""}`.toUpperCase();
}

/** Note moyenne arrondie au 0.5 (§8.3). */
export function roundHalf(n: number): number {
  return Math.round(n * 2) / 2;
}
