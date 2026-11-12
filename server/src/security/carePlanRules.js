export function validateAssessmentCompletion(payload = {}) {
  if (payload.status !== "completed") return null;
  if (!Array.isArray(payload.domains) || payload.domains.length === 0) return "Select at least one assessment domain before completing the assessment";
  if (typeof payload.findings !== "string" || payload.findings.trim().length < 10) return "Record meaningful assessment findings before completing the assessment";
  if (typeof payload.recommendations !== "string" || payload.recommendations.trim().length < 10) return "Record clinical recommendations before completing the assessment";
  return null;
}

export function validateTreatmentPlanAssessment({ assessment, patient, assessmentStatus, status, approvedBy, approvedAt }) {
  if (!assessment) return "Select a completed assessment for this treatment plan";
  if (String(assessment.patient || assessment.patientId || "") !== String(patient || "")) {
    return "The selected assessment belongs to a different patient";
  }
  if (assessmentStatus !== "completed") return "A treatment plan can only be linked to a completed assessment";
  if (status === "active" && (!approvedBy || !approvedAt)) {
    return "Treatment plans must be approved through the clinical approval action before activation";
  }
  return null;
}

export function canActivatePatient({ hasCompletedAssessment, hasApprovedActivePlan }) {
  return Boolean(hasCompletedAssessment && hasApprovedActivePlan);
}
