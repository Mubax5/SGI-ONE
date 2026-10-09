export const REPORT_TIME_ZONE = "Asia/Jakarta";
export function reportDay(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function parseReportDay(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00+07:00`);
  return Number.isFinite(date.getTime()) && reportDay(date) === value
    ? date
    : undefined;
}
export function defaultReportPeriod(now = new Date()) {
  const to = reportDay(now);
  return { from: `${to.slice(0, 7)}-01`, to };
}
export function recentReportPeriod(days: number, now = new Date()) {
  const to = reportDay(now);
  const start = parseReportDay(to)!;
  start.setUTCDate(start.getUTCDate() - days + 1);
  return { from: reportDay(start), to };
}
