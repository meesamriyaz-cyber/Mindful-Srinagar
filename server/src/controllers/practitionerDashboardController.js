import { Appointment } from "../models/Appointment.js";
import { Assessment } from "../models/Assessment.js";
import { Doctor } from "../models/Doctor.js";
import { Patient } from "../models/Patient.js";
import { ProgressNote } from "../models/ProgressNote.js";
import { Prescription } from "../models/Prescription.js";
import { Task } from "../models/Task.js";
import { TreatmentPlan } from "../models/TreatmentPlan.js";
import { getCentreDayBounds } from "../security/centreTime.js";
import { countDocumentationPendingAppointments } from "./dashboardMetrics.js";

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
    const { start: todayStart, end: tomorrow, monthStart } = getCentreDayBounds(now);
    const tasksDueSoonStart = new Date(tomorrow);
    const tasksDueSoonEnd = new Date(tomorrow);
    tasksDueSoonEnd.setDate(tasksDueSoonEnd.getDate() + 7);

    const appointmentScope = { practitioner: practitioner._id };
    const patientAssignmentScope = { ...appointmentScope, status: { $nin: ["cancelled", "no-show"] } };
    const [
      appointmentsTodayCount,
      upcomingAppointmentsCount,
      openTasksCount,
      overdueTasksCount,
      tasksDueSoonCount,
      todaysAppointments,
      upcomingAppointments,
      assignedPatientIds,
      completedSessionsThisMonth,
      pendingAssessments,
      activeTreatmentPlans,
      recentNotes,
      activePrescriptions,
      assignedTasks,
      allCheckedInAppointmentIds
    ] = await Promise.all([
      Appointment.countDocuments({ ...appointmentScope, startsAt: { $gte: todayStart, $lt: tomorrow }, status: { $nin: ["cancelled"] } }),
      Appointment.countDocuments({ ...appointmentScope, startsAt: { $gte: tomorrow }, status: "scheduled" }),
      Task.countDocuments({ assignedTo: req.user._id, status: { $ne: "done" } }),
      Task.countDocuments({ assignedTo: req.user._id, status: { $ne: "done" }, dueDate: { $lt: todayStart } }),
      Task.countDocuments({ assignedTo: req.user._id, status: { $ne: "done" }, dueDate: { $gte: now, $lte: tasksDueSoonEnd } }),
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
      Appointment.distinct("patient", patientAssignmentScope),
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
        .lean(),
      Appointment.find({ ...appointmentScope, startsAt: { $gte: todayStart, $lt: tomorrow }, status: "checked-in" }).select("_id").lean()
    ]);

    const checkedInIds = allCheckedInAppointmentIds.map((appointment) => appointment._id);
    const documentedAppointmentIds = await ProgressNote.distinct("appointment", { appointment: { $in: checkedInIds }, noteType: "session" });
    const documentedSet = new Set(documentedAppointmentIds.map(String));
    const documentationPending = todaysAppointments.filter((appointment) => appointment.status === "checked-in" && !documentedSet.has(String(appointment._id)));
    const documentationPendingCount = countDocumentationPendingAppointments(checkedInIds, documentedAppointmentIds);
    const patientCount = await Patient.countDocuments({ _id: { $in: assignedPatientIds } });

    return res.json({
      practitioner,
      role: req.user.role,
      metrics: {
        patientsUnderCare: patientCount,
        appointmentsToday: appointmentsTodayCount,
        upcomingAppointments: upcomingAppointmentsCount,
        completedSessionsThisMonth,
        pendingAssessments,
        activeTreatmentPlans,
        activePrescriptions,
        openTasks: openTasksCount,
        overdueTasks: overdueTasksCount,
        tasksDueSoon: tasksDueSoonCount,
        documentationPending: documentationPendingCount
      },
      todaysAppointments,
      documentationPending,
      upcomingAppointments,
      recentNotes,
      assignedTasks
    });
  } catch (error) {
    return next(error);
  }
}
