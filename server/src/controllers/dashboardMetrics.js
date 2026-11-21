export function sumPaymentAggregation(rows = []) {
  const total = rows.reduce((sum, row) => sum + Number(row?.total || 0), 0);
  return Math.round(total * 100) / 100;
}

export function filterDocumentationPendingAppointments(appointments = [], documentedAppointmentIds = []) {
  const documented = new Set(documentedAppointmentIds.map(String));
  return appointments.filter((appointment) => appointment.status === "checked-in" && !documented.has(String(appointment._id)));
}

export function filterBillingPendingAppointments(appointments = [], billedAppointmentIds = []) {
  const billed = new Set(billedAppointmentIds.map(String));
  return appointments.filter((appointment) => appointment.status === "completed" && !billed.has(String(appointment._id)));
}

export function countDocumentationPendingAppointments(appointmentIds = [], documentedAppointmentIds = []) {
  const documented = new Set(documentedAppointmentIds.map(String));
  return appointmentIds.filter((id) => !documented.has(String(id))).length;
}

export function countBillingPendingAppointments(appointmentIds = [], billedAppointmentIds = []) {
  const billed = new Set(billedAppointmentIds.map(String));
  return appointmentIds.filter((id) => !billed.has(String(id))).length;
}

export function countRemainingAppointments(totalAppointments = 0, statusCounts = {}) {
  const total = Math.max(Number(totalAppointments) || 0, 0);
  const terminal = ["completed", "cancelled", "no-show"].reduce((sum, status) => sum + (Number(statusCounts[status]) || 0), 0);
  return Math.max(total - terminal, 0);
}

export function getTaskDeadlineRanges(todayStart, tomorrow) {
  const indiaOffsetMs = 330 * 60 * 1000;
  // Task due dates are date-only values stored at UTC midnight, so use
  // UTC-midnight calendar boundaries rather than centre-day UTC instants.
  const dueTodayStart = new Date(todayStart.getTime() + indiaOffsetMs);
  const dueTodayEnd = new Date(tomorrow.getTime() + indiaOffsetMs);
  const upcomingEnd = new Date(dueTodayEnd);
  upcomingEnd.setUTCDate(upcomingEnd.getUTCDate() + 7);
  return {
    overdueBefore: dueTodayStart,
    dueTodayStart,
    dueTodayEnd,
    upcomingStart: dueTodayEnd,
    upcomingEnd
  };
}
