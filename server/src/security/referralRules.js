const INDIA_TIME_ZONE = "Asia/Kolkata";

export function getNextWorkingDayDeadline(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: INDIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const localDate = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));

  do {
    localDate.setUTCDate(localDate.getUTCDate() + 1);
  } while ([0, 6].includes(localDate.getUTCDay()));

  return new Date(Date.UTC(
    localDate.getUTCFullYear(),
    localDate.getUTCMonth(),
    localDate.getUTCDate(),
    11,
    30
  ));
}

export function isReferralFollowUpOverdue(referral, now = new Date()) {
  return Boolean(
    referral &&
    ["new", "contacted", "scheduled"].includes(referral.status) &&
    referral.followUpDate &&
    new Date(referral.followUpDate).getTime() < now.getTime()
  );
}

export function validateReferralFollowUp(payload = {}) {
  const methods = ["phone", "whatsapp", "email", "in-person", "other"];
  const outcomes = ["reached", "no-answer", "left-message", "callback-requested", "appointment-booked", "not-interested", "other"];
  if (!methods.includes(payload.contactMethod)) return "Select a valid contact method";
  if (!outcomes.includes(payload.outcome)) return "Select a valid follow-up outcome";
  if (typeof payload.note !== "string" || payload.note.trim().length < 3 || payload.note.trim().length > 1000) {
    return "Add a follow-up note between 3 and 1000 characters";
  }
  if (payload.nextFollowUpAt && !Number.isFinite(new Date(payload.nextFollowUpAt).getTime())) {
    return "Enter a valid next follow-up date";
  }
  return null;
}
