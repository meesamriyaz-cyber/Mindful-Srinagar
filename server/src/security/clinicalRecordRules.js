const transitions = {
  assessment: { draft: ["completed"], completed: [] },
  "treatment-plan": { planned: ["active","on-hold","completed"], active: ["on-hold","completed"], "on-hold": ["active","completed"], completed: [] },
  prescription: { active: ["completed","cancelled"], completed: [], cancelled: [] }
};
export function canTransitionClinicalStatus(recordType, current, next) {
  if (!next || next === current) return true;
  return Boolean(transitions[recordType]?.[current]?.includes(next));
}
export function validateAmendmentInput({ reason, changes, allowedFields }) {
  if (typeof reason !== "string" || reason.trim().length < 10 || reason.trim().length > 1000) return "An amendment reason of 10 to 1000 characters is required";
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) return "Amendment changes must be a JSON object";
  const fields = Object.keys(changes);
  if (!fields.length) return "At least one amendable clinical field must be supplied";
  const unsupported = fields.filter((field) => !allowedFields.includes(field));
  if (unsupported.length) return "Unsupported amendment field: " + unsupported.join(", ");
  return null;
}
