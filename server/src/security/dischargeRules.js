export function validateDischargeApprovalPayload(payload = {}) {
  const fields = [
    ["summary", 20, 5000, "A discharge summary of at least 20 characters is required"],
    ["reason", 3, 500, "A discharge reason is required"],
    ["outcome", 20, 2000, "A meaningful clinical outcome summary is required"],
    ["recommendations", 10, 3000, "Post-discharge recommendations are required"]
  ];
  for (const [field, min, max, message] of fields) {
    if (typeof payload[field] !== "string" || payload[field].trim().length < min || payload[field].trim().length > max) return message;
  }
  return null;
}

export function validateDischargeReadiness({
  hasCompletedDischargeAssessment,
  openAppointments = 0,
  openTreatmentPlans = 0,
  openTasks = 0,
  outstandingBalance = 0
}) {
  if (!hasCompletedDischargeAssessment) return "Complete and sign off a discharge assessment before requesting discharge approval";
  if (openAppointments > 0) return "Resolve or cancel all scheduled and checked-in appointments before discharge";
  if (openTreatmentPlans > 0) return "Complete or cancel all planned, active or on-hold treatment plans before discharge";
  if (openTasks > 0) return "Complete all patient-linked operational and clinical tasks before discharge";
  if (outstandingBalance > 0.009) return "Settle all outstanding invoices before discharge";
  return null;
}

export function canCloseDischarge({ approvedAt, isAlreadyDischarged }) {
  return Boolean(approvedAt && !isAlreadyDischarged);
}
