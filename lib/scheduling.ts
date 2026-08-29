import { prisma } from "@/lib/prisma";
import type { LawyerProfile } from "@prisma/client";

export const SLOT_DURATION_MINUTES = 60;

/**
 * Expand a lawyer's weekly availability into concrete bookable
 * start times for a given date, excluding already-booked slots.
 */
export async function getSlotsForDate(
  lawyerProfile: LawyerProfile & { availability: { dayOfWeek: number; startMinute: number; endMinute: number }[] },
  date: Date
): Promise<Date[]> {
  const dayOfWeek = date.getUTCDay();
  const windows = lawyerProfile.availability.filter((a) => a.dayOfWeek === dayOfWeek);

  // date is provided as YYYY-MM-DD (local). Build local boundaries.
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const dayStart = new Date(year, month, day, 0, 0, 0, 0);
  const dayEnd = new Date(year, month, day + 1, 0, 0, 0, 0);

  const slots: Date[] = [];
  for (const w of windows) {
    for (let m = w.startMinute; m + SLOT_DURATION_MINUTES <= w.endMinute; m += SLOT_DURATION_MINUTES) {
      const start = new Date(dayStart.getTime() + m * 60000);
      if (start < new Date()) continue; // skip past slots
      slots.push(start);
    }
  }

  if (slots.length === 0) return [];

  // Remove slots that already have a confirmed/pending booking
  const existing = await prisma.booking.findMany({
    where: {
      lawyerProfileId: lawyerProfile.id,
      status: { in: ["PENDING", "CONFIRMED"] },
      startTime: { gte: dayStart, lt: dayEnd },
    },
    select: { startTime: true, endTime: true },
  });

  const isTaken = (start: Date) =>
    existing.some(
      (b) =>
        (start >= b.startTime && start < b.endTime) ||
        (b.startTime >= start && b.startTime < new Date(start.getTime() + SLOT_DURATION_MINUTES * 60000))
    );

  return slots.filter((s) => !isTaken(s));
}

export function buildDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * DatePicker helper: build the next N days (including today).
 */
export function nextDays(count: number, start = new Date()): { key: string; label: string; weekday: string; date: Date }[] {
  const out: { key: string; label: string; weekday: string; date: Date }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    out.push({
      key: buildDateKey(d),
      label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      weekday: d.toLocaleDateString("en-IN", { weekday: "short" }),
      date: d,
    });
  }
  return out;
}
