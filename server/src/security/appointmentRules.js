import { Appointment } from "../models/Appointment.js";

const BUSY_STATUSES = ["scheduled", "checked-in"];

export function validateAppointmentShape(value, { allowPast = false } = {}) {
  if (!value || !value.patient || !value.practitioner) return "A patient and practitioner are required";
  if (typeof value.service !== "string" || !value.service.trim() || value.service.trim().length > 120) return "Service must be between 1 and 120 characters";
  const start = new Date(value.startsAt);
  if (!Number.isFinite(start.getTime())) return "A valid appointment date and time is required";
  if (!allowPast && start.getTime() < Date.now() - 5 * 60 * 1000) return "Appointments cannot be scheduled in the past";
  const duration = Number(value.durationMinutes ?? 45);
  if (!Number.isInteger(duration) || duration < 15 || duration > 240 || duration % 15 !== 0) return "Appointment duration must be 15–240 minutes in 15-minute increments";
  if (value.room != null && (typeof value.room !== "string" || value.room.trim().length > 80)) return "Room must be 80 characters or fewer";
  return null;
}

export function canTransitionAppointment(from, to) {
  if (from === to) return true;
  const transitions = {
    scheduled: ["checked-in", "cancelled", "no-show"],
    "checked-in": ["completed", "cancelled"],
    completed: [],
    cancelled: [],
    "no-show": []
  };
  return Boolean(transitions[from]?.includes(to));
}

export async function findAppointmentConflict(value, excludeId = null) {
  const start = new Date(value.startsAt);
  const end = new Date(start.getTime() + Number(value.durationMinutes ?? 45) * 60000);
  const query = {
    status: { $in: BUSY_STATUSES },
    startsAt: { $lt: end },
    $expr: {
      $gt: [
        { $add: ["$startsAt", { $multiply: [{ $ifNull: ["$durationMinutes", 45] }, 60000] }] },
        start
      ]
    },
    $or: [{ practitioner: value.practitioner }, ...(value.room?.trim() ? [{ room: value.room.trim() }] : [])]
  };
  if (excludeId) query._id = { $ne: excludeId };
  return Appointment.findOne(query).select("_id").lean();
}

export function isWithinPractitionerAvailability(startsAt, durationMinutes, availability = []) {
  if (!Array.isArray(availability) || availability.length === 0) return true;
  const start = new Date(startsAt);
  if (!Number.isFinite(start.getTime())) return false;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata", weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(start);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const day = values.weekday.toLowerCase();
  const startMinute = Number(values.hour) * 60 + Number(values.minute);
  const endMinute = startMinute + Number(durationMinutes ?? 45);
  return availability.some((slot) => {
    const slotDay = String(slot.day || "").toLowerCase();
    const dayMatches = slotDay === day || slotDay === day.slice(0, 3);
    const parse = (value) => {
      const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || ""));
      return match ? Number(match[1]) * 60 + Number(match[2]) : NaN;
    };
    const from = parse(slot.from), to = parse(slot.to);
    return dayMatches && Number.isFinite(from) && Number.isFinite(to) && from <= startMinute && endMinute <= to;
  });
}
