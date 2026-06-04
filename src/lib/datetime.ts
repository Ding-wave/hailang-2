const TZ = "Asia/Shanghai";
const OFFSET = "+08:00";

/** ISO 8601 with +08:00 for Supabase timestamptz writes */
export function chinaIso(date: Date = new Date()): string {
  const local = date.toLocaleString("sv-SE", { timeZone: TZ });
  return `${local.replace(" ", "T")}${OFFSET}`;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function formatChinaDateTime(dateStr?: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("zh-CN", { timeZone: TZ });
}
