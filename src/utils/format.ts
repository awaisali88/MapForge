import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(duration);
dayjs.extend(relativeTime);

export { dayjs };

/** Format an epoch timestamp as a human-readable string (UTC). */
export function formatTimestamp(epochMs: number): string {
  return dayjs(epochMs).utc().format("YYYY-MM-DD HH:mm:ss") + " UTC";
}

/** Format a duration in milliseconds as a compact `1h 23m 45s` string. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const d = dayjs.duration(ms);
  const parts: string[] = [];
  if (d.hours() > 0) parts.push(`${d.hours()}h`);
  if (d.minutes() > 0) parts.push(`${d.minutes()}m`);
  parts.push(`${d.seconds()}s`);
  return parts.join(" ");
}

/** Format a coordinate as decimal degrees with N/S/E/W suffix. */
export function formatLatLon(lat: number, lon: number, fractionDigits = 4): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(fractionDigits)}°${ns} ${Math.abs(lon).toFixed(fractionDigits)}°${ew}`;
}

/** Compact byte formatter: 1 234 567 → "1.2 MB". */
export function formatBytes(bytes: number, fractionDigits = 1): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(fractionDigits)} ${units[unit]}`;
}
