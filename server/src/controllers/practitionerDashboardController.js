import { Appointment } from "../models/Appointment.js";
import { Assessment } from "../models/Assessment.js";
import { Doctor } from "../models/Doctor.js";
import { Patient } from "../models/Patient.js";
import { ProgressNote } from "../models/ProgressNote.js";
import { Prescription } from "../models/Prescription.js";
import { Task } from "../models/Task.js";
import { TreatmentPlan } from "../models/TreatmentPlan.js";

export async function getPractitionerDashboard(req, res, next) {
  try {
    const practitioner = await Doctor.findOne({ user: req.user._id, status: { $ne: "inactive" } })
      .select("_id name discipline status")
      .lean();

    if (!practitioner) {
      return res.status(409).json({
        code: "PRACTITIONER_PROFILE_REQUIRED",
        message: "Your staff account is not linked to an active practitioner profile. Please contact an administrator."
      });
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const tomorrow = new Date(todayStart);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

    const appointmentScope = { practitioner: practitioner._id };
    const [
      todaysAppointments,
      upcomingAppointments,
      assignedPatientIds,
      completedSessionsThisMonth,
      pendingAssessments,
      activeTreatmentPlans,
      recentNotes,
      activePrescriptions,
      assignedTasks
    ] = await Promise.all([
      Appointment.find({ ...appointmentScope, startsAt: { $gte: todayStart, $lt: tomorrow }, status: { $nin: ["cancelled"] } })
        .populate("patient", "fullName mrn status")
        .sort({ startsAt: 1 })
        .limit(30)
        .lean(),
      Appointment.find({ ...appointmentScope, startsAt: { $gte: tomorrow }, status: "scheduled" })
        .populate("patient", "fullName mrn status")
        .sort({ startsAt: 1 })
        .limit(8)
        .lean(),
      Appointment.distinct("patient", appointmentScope),
      Appointment.countDocuments({ ...appointmentScope, status: "completed", startsAt: { $gte: monthStart } }),
      Assessment.countDocuments({ assessedBy: req.user._id, status: "draft" }),
      TreatmentPlan.countDocuments({ createdBy: req.user._id, status: { $in: ["planned", "active"] } }),
      ProgressNote.find({ author: req.user._id })
        .populate("patient", "fullName mrn")
        .sort({ notedAt: -1 })
        .limit(5)
        .lean(),
      req.user.role === "doctor"
        ? Prescription.countDocuments({ prescribedBy: req.user._id, status: "active" })
        : Promise.resolve(0),
      Task.find({ assignedTo: req.user._id, status: { $ne: "done" } })
        .sort({ dueDate: 1 })
        .limit(8)
        .lean()
    ]);

    const patientCount = await Patient.countDocuments({ _id: { $in: assignedPatientIds } });

    return res.json({
      practitioner,
      role: req.user.role,
      metrics: {
        patientsUnderCare: patientCount,
        appointmentsToday: todaysAppointments.length,
        upcomingAppointments: upcomingAppointments.length,
        completedSessionsThisMonth,
        pendingAssessments,
        activeTreatmentPlans,
        activePrescriptions,
        openTasks: assignedTasks.length
      },
      todaysAppointments,
      upcomingAppointments,
      recentNotes,
      assignedTasks
    });
  } catch (error) {
    return next(error);
  }
}
