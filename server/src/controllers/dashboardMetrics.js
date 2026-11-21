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
