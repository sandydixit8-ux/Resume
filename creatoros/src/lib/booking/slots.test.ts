import { describe, it, expect } from "vitest";
import { computeSlots, nextDays, validateAvailability } from "./slots";

const MON = "2026-09-28"; // a Monday
const TUE = "2026-09-29"; // a Tuesday

describe("computeSlots", () => {
  it("returns no slots when there are no matching windows", () => {
    const slots = computeSlots({
      windows: [{ dayOfWeek: 1, startMin: 540, endMin: 600 }], // only Monday
      existing: [],
      serviceDurationMin: 30,
      dateStr: TUE, // Tuesday
      ownerTz: "UTC",
      requestorTz: "UTC",
    });
    expect(slots).toHaveLength(0);
  });

  it("generates 30-min slots within a window", () => {
    const slots = computeSlots({
      windows: [{ dayOfWeek: 1, startMin: 540, endMin: 600 }], // 09:00-10:00
      existing: [],
      serviceDurationMin: 30,
      dateStr: MON,
      ownerTz: "UTC",
      requestorTz: "UTC",
    });
    expect(slots.map((s) => s.label.slice(-8).trim())).toEqual(["9:00 AM", "9:30 AM"]);
    expect(slots[0].start).toBe("2026-09-28T09:00:00.000Z");
    expect(slots[0].end).toBe("2026-09-28T09:30:00.000Z");
  });

  it("respects service duration", () => {
    const slots = computeSlots({
      windows: [{ dayOfWeek: 1, startMin: 540, endMin: 600 }],
      existing: [],
      serviceDurationMin: 45,
      dateStr: MON,
      ownerTz: "UTC",
      requestorTz: "UTC",
    });
    expect(slots).toHaveLength(1);
    expect(slots[0].end).toBe("2026-09-28T09:45:00.000Z");
  });

  it("excludes slots overlapping existing bookings", () => {
    const slots = computeSlots({
      windows: [{ dayOfWeek: 1, startMin: 540, endMin: 660 }], // 09:00-11:00
      existing: [{ starts_at: "2026-09-28T09:30:00.000Z", ends_at: "2026-09-28T10:00:00.000Z", status: "confirmed" }],
      serviceDurationMin: 30,
      dateStr: MON,
      ownerTz: "UTC",
      requestorTz: "UTC",
    });
    const times = slots.map((s) => s.label.slice(-8).trim());
    expect(times).toContain("9:00 AM");
    expect(times).not.toContain("9:30 AM"); // blocked
    expect(times).toContain("10:00 AM");
  });

  it("ignores cancelled bookings", () => {
    const slots = computeSlots({
      windows: [{ dayOfWeek: 1, startMin: 540, endMin: 600 }],
      existing: [{ starts_at: "2026-09-28T09:00:00.000Z", ends_at: "2026-09-28T09:30:00.000Z", status: "cancelled" }],
      serviceDurationMin: 30,
      dateStr: MON,
      ownerTz: "UTC",
      requestorTz: "UTC",
    });
    expect(slots).toHaveLength(2);
  });

  it("converts owner-local window to requestor timezone labels", () => {
    const slots = computeSlots({
      windows: [{ dayOfWeek: 1, startMin: 540, endMin: 600 }], // 09:00-10:00 America/New_York
      existing: [],
      serviceDurationMin: 30,
      dateStr: MON,
      ownerTz: "America/New_York",
      requestorTz: "Asia/Kolkata", // UTC+5:30
    });
    // 09:00 ET -> 18:30 IST
    expect(slots[0].label).toContain("6:30 PM");
  });
});

describe("nextDays", () => {
  it("returns n consecutive dates", () => {
    const days = nextDays(3, "UTC");
    expect(days).toHaveLength(3);
    const [a, b] = days;
    const da = new Date(a + "T00:00:00Z");
    const db = new Date(b + "T00:00:00Z");
    expect((db.getTime() - da.getTime()) / 86400000).toBe(1);
  });
});

describe("validateAvailability", () => {
  it("rejects invalid windows", () => {
    expect(validateAvailability([{ dayOfWeek: 7, startMin: 0, endMin: 60 }])).toBe("Invalid day of week");
    expect(validateAvailability([{ dayOfWeek: 1, startMin: 600, endMin: 540 }])).toBe("Invalid time window");
  });

  it("accepts valid windows", () => {
    expect(validateAvailability([{ dayOfWeek: 1, startMin: 540, endMin: 600 }])).toBeNull();
  });
});