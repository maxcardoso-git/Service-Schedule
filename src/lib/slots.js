import { addMinutes } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

/**
 * Generates available time slots within a working hours window.
 *
 * Pure function — no database calls, no side effects.
 *
 * @param {Date} workStart - UTC Date representing the start of working hours for the day.
 * @param {Date} workEnd - UTC Date representing the end of working hours for the day.
 * @param {number} durationMin - Service duration in minutes (integer).
 * @param {Array<{startTime: Date, endTime: Date}>} activeBookings - Already TTL-filtered
 *   bookings that occupy time within this window. Each entry has UTC Date objects.
 * @returns {Date[]} Array of UTC Date objects, one per available slot start time.
 */
export function generateAvailableSlots(workStart, workEnd, durationMin, activeBookings) {
  const slots = [];
  let cursor = new Date(workStart);

  while (true) {
    const slotEnd = addMinutes(cursor, durationMin);

    // Last-slot overrun guard: slot must finish within working hours
    if (slotEnd > workEnd) {
      break;
    }

    // Overlap check: is this slot occupied by any active booking?
    const occupied = activeBookings.some(
      (b) => b.startTime < slotEnd && b.endTime > cursor
    );

    if (!occupied) {
      slots.push(new Date(cursor));
    }

    cursor = addMinutes(cursor, durationMin);
  }

  return slots;
}

/**
 * Converts a local "HH:MM" time string + "YYYY-MM-DD" date string to a UTC Date.
 *
 * Uses `fromZonedTime` from date-fns-tz, which treats the input as local time
 * in the given timezone and converts it TO UTC.
 *
 * @param {string} timeStr - Local time in "HH:MM" format (e.g. "09:00").
 * @param {string} dateStr - Date in "YYYY-MM-DD" format (e.g. "2026-03-13").
 * @param {string} timezone - IANA timezone identifier (e.g. "America/Sao_Paulo").
 * @returns {Date} UTC Date equivalent of the given local time.
 */
export function localTimeToUTC(timeStr, dateStr, timezone) {
  // Build a naive local Date from the date + time strings.
  // The resulting Date is ambiguous (no timezone info), treated as local by fromZonedTime.
  const localDate = new Date(`${dateStr}T${timeStr}:00`);

  // fromZonedTime: interprets localDate as clock time in `timezone`, returns UTC Date.
  return fromZonedTime(localDate, timezone);
}
