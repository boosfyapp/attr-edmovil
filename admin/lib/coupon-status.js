/* Estado de vigencia de un cupón (fechas AAAA-MM-DD, hora de Ciudad de México). */
export const todayMx = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());

/** @returns {{key:"live"|"scheduled"|"expired"|"off", label:string}} */
export function couponStatus(c, today = todayMx()) {
  if (!c.active) return { key: "off", label: "Inactivo" };
  if (c.from && c.from > today) return { key: "scheduled", label: `Programado desde ${c.from}` };
  if (c.to && c.to < today) return { key: "expired", label: `Vencido el ${c.to}` };
  return { key: "live", label: c.to ? `Vigente hasta ${c.to}` : "Vigente" };
}
