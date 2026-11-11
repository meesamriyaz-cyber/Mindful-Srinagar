export function createPractitionerPatientScope({ Doctor, Appointment }) {
  return async function practitionerPatientScope(req) {
    if (!["doctor", "therapist"].includes(req.user.role)) return {};
    const practitioner = await Doctor.findOne({ user: req.user._id, status: { $ne: "inactive" } }).select("_id").lean();
    if (!practitioner) return { _id: { $in: [] } };
    const patientIds = await Appointment.distinct("patient", {
      practitioner: practitioner._id,
      status: { $nin: ["cancelled", "no-show"] }
    });
    return { _id: { $in: patientIds } };
  };
}
