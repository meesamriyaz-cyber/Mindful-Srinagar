const transitions = {
  new: ["assessment", "active", "on-hold", "discharged"],
  assessment: ["active", "on-hold", "discharged"],
  active: ["on-hold", "discharged"],
  "on-hold": ["active", "assessment", "discharged"],
  discharged: []
};

export function canTransitionPatientStatus(from, to) {
  return from === to || Boolean(transitions[from]?.includes(to));
}

export function validateDischargeDetails(payload) {
  if (payload.status !== "discharged") return null;
  if (!String(payload.dischargeSummary || "").trim()) return "A discharge summary is required";
  if (!String(payload.dischargeReason || "").trim()) return "A discharge reason is required";
  return null;
}
