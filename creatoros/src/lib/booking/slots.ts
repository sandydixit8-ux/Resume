export interface AvailabilityWindow {
  dayOfWeek: number; // 0=Sun .. 6=Sat
  startMin: number;  // minutes from local midnight
  endMin: number;
}

export interface BookingRow {
  starts_at: string;
  ends_at: string;
  status: string;
}

export interface OpenSlot {
  start: string; // ISO UTC
  end: string;   // ISO UTC
  label: string; // human time in requestor's timezone
}

/**
 * Compute open booking slots for a service on a given local date.
 * Availability windows are defined in the owner's timezone. Slots are
 * converted to UTC for storage, and labels emitted in the requestor's timezone.
 */
export function computeSlots(opts: {
  windows: AvailabilityWindow[];
  existing: BookingRow[];
  serviceDurationMin: number;
  bufferMin?: number;
  dateStr: string;       // YYYY-MM-DD in owner timezone
  ownerTz: string;       // e.g. America/New_York
  requestorTz: string;   // e.g. Asia/Kolkata (used for labels)
  slotStepMin?: number;
  startHour?: number;    // local hour to start generating (default 8)
  endHour?: number;      // local hour to stop (default 20)
}): OpenSlot[] {
  const {
    windows,
    existing,
    serviceDurationMin,
    bufferMin = 0,
    dateStr,
    ownerTz,
    requestorTz,
    slotStepMin = 30,
    startHour = 0,
    endHour = 24,
  } = opts;

  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay();

  const dayWindows = windows.filter((w) => w.dayOfWeek === dow);
  if (dayWindows.length === 0) return [];

  // blocked intervals in UTC minutes for this owner-local day
  const blocked: Array<[number, number]> = existing
    .filter((b) => b.status === "confirmed" || b.status === "rescheduled")
    .map((b) => {
      const startMs = Date.parse(b.starts_at);
      const endMs = Date.parse(b.ends_at);
      const startLocal = toTimeZoneMs(startMs, ownerTz);
      const endLocal = toTimeZoneMs(endMs, ownerTz);
      // only consider bookings that fall within this owner-local day
      const dS = new Date(startLocal);
      if (isSameUtcDate(dS, date)) {
        return [(startLocal - dayStartMs(date)) / 60000, (endLocal - dayStartMs(date)) / 60000] as [number, number];
      }
      // booking spanning midnight from previous evening
      const endD = new Date(endLocal);
      if (isSameUtcDate(endD, date)) {
        return [0, (endLocal - dayStartMs(date)) / 60000] as [number, number];
      }
      return null;
    })
    .filter((x): x is [number, number] => x !== null);

  const occupied = isBlockedAt.bind(null, blocked);

  const slots: OpenSlot[] = [];
  for (const w of dayWindows) {
    const dayStart = dayStartMs(date);
    for (let t = Math.max(w.startMin, startHour * 60); t + serviceDurationMin <= Math.min(w.endMin, endHour * 60); t += slotStepMin) {
      const end = t + serviceDurationMin;
      if (occupied(t, end)) continue;
      // Wall-clock (owner-local) reading of the slot, encoded as a fake UTC ms.
      const wallStartMs = dayStart + t * 60000;
      const wallEndMs = dayStart + end * 60000;
      // Convert to the true UTC instant: instant = wall - tzOffset(owner).
      const startMs = wallToInstant(wallStartMs, ownerTz);
      const endMs = wallToInstant(wallEndMs, ownerTz);
      slots.push({
        start: new Date(startMs).toISOString(),
        end: new Date(endMs).toISOString(),
        label: formatSlot(startMs, requestorTz),
      });
    }
  }
  return slots;
}

/** Convert an owner-local wall-clock reading (stored as fake UTC ms) to the true UTC instant. */
function wallToInstant(wallMs: number, tz: string): number {
  const offset = toTimeZoneMs(wallMs, tz) - wallMs;
  return wallMs - offset;
}

function isBlockedAt(blocked: Array<[number, number]>, start: number, end: number): boolean {
  for (const [bs, be] of blocked) {
    if (start < be && end > bs) return true;
  }
  return false;
}

function dayStartMs(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function toTimeZoneMs(ms: number, tz: string): number {
  // Render the instant in the target timezone, then convert back to a fake UTC ms
  // representing the local wall-clock reading — used purely for day-window math.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(ms);
  const obj: Record<string, string> = {};
  for (const p of parts) obj[p.type] = p.value;
  return Date.UTC(
    Number(obj.year),
    Number(obj.month) - 1,
    Number(obj.day),
    Number(obj.hour),
    Number(obj.minute),
    Number(obj.second)
  );
}

function isSameUtcDate(d1: Date, d2: Date): boolean {
  return (
    d1.getUTCFullYear() === d2.getUTCFullYear() &&
    d1.getUTCMonth() === d2.getUTCMonth() &&
    d1.getUTCDate() === d2.getUTCDate()
  );
}

function formatSlot(ms: number, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(ms);
}

export function nextDays(n = 14, ownerTz = "UTC"): string[] {
  const out: string[] = [];
  const now = toTimeZoneMs(Date.now(), ownerTz);
  const base = new Date(now);
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + i));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`);
  }
  return out;
}

export function validateAvailability(windows: AvailabilityWindow[]): string | null {
  for (const w of windows) {
    if (w.dayOfWeek < 0 || w.dayOfWeek > 6) return "Invalid day of week";
    if (w.startMin < 0 || w.endMin > 1440 || w.startMin >= w.endMin) return "Invalid time window";
  }
  return null;
}