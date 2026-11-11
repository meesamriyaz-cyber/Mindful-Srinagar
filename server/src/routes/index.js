import express from "express";
import mongoose from "mongoose";
import { getDashboard } from "../controllers/dashboardController.js";
import { getPractitionerDashboard } from "../controllers/practitionerDashboardController.js";
import { makeCrudController } from "../controllers/crudController.js";
import { createEnquiry, convertReferralToPatient } from "../controllers/enquiryController.js";
import { permit, protect } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimiter.js";
import { Appointment } from "../models/Appointment.js";
import { Doctor } from "../models/Doctor.js";
import { InventoryItem } from "../models/InventoryItem.js";
import { Invoice } from "../models/Invoice.js";
import { Patient } from "../models/Patient.js";
import { Referral } from "../models/Referral.js";
import { Task } from "../models/Task.js";
import { User } from "../models/User.js";
import authRoutes from "./authRoutes.js";
import { crudRoutes } from "./crudRoutes.js";
import assessmentRoutes from "./assessmentRoutes.js";
import treatmentPlanRoutes from "./treatmentPlanRoutes.js";
import progressNoteRoutes from "./progressNoteRoutes.js";
import prescriptionRoutes from "./prescriptionRoutes.js";
import { createInvoice, generateInvoiceFromAppointment } from "../controllers/invoiceController.js";
import { taskManagers, taskScope } from "../security/taskAccess.js";
import { calculateOutstandingBalance } from "../utils/invoiceBalance.js";
import { escapeRegex } from "../utils/query.js";
import { canTransitionPatientStatus, validateDischargeDetails } from "../security/patientLifecycle.js";
import { validateAppointmentShape, canTransitionAppointment, findAppointmentConflict, isWithinPractitionerAvailability } from "../security/appointmentRules.js";
const router = express.Router();
const management = ["director", "admin"];
const reception = ["director", "admin", "reception", "coordinator"];
const clinical = ["director", "admin", "doctor", "therapist"];
const patientReaders = ["director", "admin", "reception", "coordinator", "doctor", "therapist"];
const appointmentStaff = ["director", "admin", "reception", "coordinator", "doctor", "therapist"];
const billing = ["director", "admin", "accounts"];
const invoiceReaders = [...billing, "reception"];
const invoiceCreators = [...billing, "reception"];

async function practitionerPatientScope(req) {
  if (!["doctor", "therapist"].includes(req.user.role)) return {};
  const practitioner = await Doctor.findOne({ user: req.user._id, status: { $ne: "inactive" } }).select("_id").lean();
  if (!practitioner) return { _id: { $in: [] } };
  const patientIds = await Appointment.distinct("patient", {
    practitioner: practitioner._id,
    status: { $nin: ["cancelled", "no-show"] }
  });
  return { _id: { $in: patientIds } };
}

router.get("/health", (_req, res) => res.json({ status: "ok", service: "mindful-api" }));
router.use("/auth", authRoutes);
router.post("/enquiries", createRateLimiter({ windowMs: 900000, max: 8, message: "Too many enquiries from this connection. Please try again later." }), createEnquiry);
router.use(protect);
router.get("/dashboard", permit("director", "admin", "reception"), getDashboard);
router.get("/dashboard/practitioner", permit("doctor", "therapist"), getPractitionerDashboard);
router.get("/staff", permit(...management), async (_req, res, next) => {
  try {
    const staff = await User.find().select("_id name email role isActive createdAt").sort({ name: 1 }).lean();
    return res.json(staff);
  } catch (error) { return next(error); }
});
router.get("/staff-accounts", permit(...management), async (_req, res, next) => {
  try {
    const staff = await User.find({ isActive: true, role: { $in: ["doctor", "therapist"] } })
      .select("_id name email role")
      .sort({ name: 1 })
      .lean();
    return res.json(staff);
  } catch (error) { return next(error); }
});
router.use("/patients", crudRoutes(makeCrudController(Patient, ["referral"], {
  createFields: ["fullName","guardianName","age","gender","phone","address","primaryConcern","services","status","referral","notes"],
  updateFields: ["fullName","guardianName","age","gender","phone","address","primaryConcern","services","status","referral","notes","dischargeDate","dischargeSummary","dischargeReason"],
  validateCreate: async ({ payload }) => {
    if (payload.status && !["new","assessment"].includes(payload.status)) return { statusCode: 400, message: "New patients must begin in new or assessment status" };
    if (payload.referral) {
      if (!mongoose.isValidObjectId(payload.referral)) return { statusCode: 400, message: "A valid referral is required" };
      const linkedReferral = await Referral.findById(payload.referral).select("status");
      if (!linkedReferral) return { statusCode: 404, message: "Referral not found" };
      if (linkedReferral.status === "converted") return { statusCode: 409, message: "This referral has already been converted" };
      if (await Patient.exists({ referral: payload.referral })) return { statusCode: 409, message: "This referral is already linked to a patient" };
    }
    const duplicate = await Patient.findOne({
      fullName: new RegExp("^" + escapeRegex(String(payload.fullName || "").trim()) + "$", "i"),
      phone: String(payload.phone || "").trim()
    }).select("_id").lean();
    if (duplicate) return { statusCode: 409, message: "A patient with this name and phone number already exists" };
    return null;
  },
  updateFieldsByRole: {
    reception: ["fullName","guardianName","age","gender","phone","address","primaryConcern","services","status","referral","dischargeDate","dischargeReason"],
    coordinator: ["fullName","guardianName","age","gender","phone","address","primaryConcern","services","status","referral","dischargeDate","dischargeReason"]
  },
  redactFieldsByRole: { reception: ["notes","dischargeSummary"], coordinator: ["notes","dischargeSummary"] },
  validateUpdate: async ({ req, payload }) => {
    const current = await Patient.findById(req.params.id).select("status referral");
    if (!current) return { statusCode: 404, message: "Patient not found" };
    if (payload.status && !canTransitionPatientStatus(current.status, payload.status)) return { statusCode: 409, message: `Patient status cannot move from ${current.status} to ${payload.status}` };
    const dischargeError = validateDischargeDetails(payload);
    if (dischargeError) return { statusCode: 400, message: dischargeError };
    if (payload.referral && String(payload.referral) !== String(current.referral || "")) return { statusCode: 400, message: "A patient's referral linkage cannot be changed after registration" };
    if (payload.status !== "discharged") return null;
    const invoices = await Invoice.find({ patient: req.params.id, status: { $ne: "void" } })
      .select("items discount paidAmount")
      .lean();
    const outstanding = calculateOutstandingBalance(invoices);
    if (outstanding > 0.009) {
      return {
        statusCode: 409,
        message: `Patient cannot be discharged while invoices have an outstanding balance of ₹${outstanding.toLocaleString("en-IN", { maximumFractionDigits: 2 })}. Settle all bills first.`
      };
    }
    return null;
  },
  listScope: practitionerPatientScope,
  recordScope: practitionerPatientScope,
  filterFields: ["status","referral"], searchableFields: ["fullName","mrn","phone","guardianName","primaryConcern"]
}), { read: patientReaders, write: reception, remove: [] }));
router.use("/doctors", crudRoutes(makeCrudController(Doctor, [], {
  createFields: ["name","user","discipline","registrationNo","phone","email","availability","status"],
  updateFields: ["name","user","discipline","registrationNo","phone","email","availability","status"],
  validateCreate: async ({ payload }) => {
    if (!payload.user) return null;
    const user = await User.findById(payload.user).select("role isActive");
    if (!user || !user.isActive || !["doctor","therapist"].includes(user.role)) return { statusCode: 400, message: "Link an active doctor or therapist staff account" };
    if (await Doctor.exists({ user: payload.user })) return { statusCode: 409, message: "This staff account is already linked to a practitioner" };
    return null;
  },
  validateUpdate: async ({ req, payload }) => {
    if (!payload.user) return null;
    const user = await User.findById(payload.user).select("role isActive");
    if (!user || !user.isActive || !["doctor","therapist"].includes(user.role)) return { statusCode: 400, message: "Link an active doctor or therapist staff account" };
    if (await Doctor.exists({ user: payload.user, _id: { $ne: req.params.id } })) return { statusCode: 409, message: "This staff account is already linked to a practitioner" };
    return null;
  },
  filterFields: ["status","discipline"], searchableFields: ["name","discipline","phone","email"]
}), { read: patientReaders, write: management, remove: management }));
router.use("/referrals", crudRoutes(makeCrudController(Referral, ["assignedTo"], {
  createFields: ["sourceType","sourceName","contactPerson","phone","email","patientName","concern","preferredContact","urgency","status","assignedTo","followUpDate","notes"],
  updateFields: ["sourceType","sourceName","contactPerson","phone","email","patientName","concern","preferredContact","urgency","status","assignedTo","followUpDate","notes"],
  validateUpdate: async ({ req, payload }) => {
    if (payload.status === "converted") return { statusCode: 409, message: "Use the Convert to Patient action to preserve referral and patient linkage" };
    const current = await Referral.findById(req.params.id).select("status");
    if (!current) return { statusCode: 404, message: "Referral not found" };
    const allowed = {
      new: ["contacted", "scheduled", "lost"],
      contacted: ["scheduled", "lost"],
      scheduled: ["contacted", "lost"],
      converted: [],
      lost: ["contacted"]
    };
    if (payload.status && payload.status !== current.status && !allowed[current.status]?.includes(payload.status)) {
      return { statusCode: 409, message: `Referral status cannot move from ${current.status} to ${payload.status}` };
    }
    return null;
  },
  filterFields: ["status","sourceType","urgency","assignedTo"], searchableFields: ["patientName","sourceName","phone","concern"]
}), { read: reception, write: reception, remove: management }));
router.post("/referrals/:id/convert", permit(...reception), convertReferralToPatient);
router.use("/appointments", crudRoutes(makeCrudController(Appointment, ["patient","practitioner"], {
  createFields: ["patient","practitioner","service","startsAt","durationMinutes","room","status"],
  updateFields: ["patient","practitioner","service","startsAt","durationMinutes","room","status","clinicalNotes"],
  updateFieldsByRole: {
    reception: ["patient","practitioner","service","startsAt","durationMinutes","room","status"],
    coordinator: ["patient","practitioner","service","startsAt","durationMinutes","room","status"],
    doctor: ["status","clinicalNotes"], therapist: ["status","clinicalNotes"]
  },
  redactFieldsByRole: { reception: ["clinicalNotes"], coordinator: ["clinicalNotes"] },
  filterFields: ["status","patient","practitioner"], filterAliases: { patientId: "patient" },
  listScope: async (req) => {
    if (!["doctor","therapist"].includes(req.user.role)) return {};
    const practitioner = await Doctor.findOne({ user: req.user._id }).select("_id").lean();
    return practitioner ? { practitioner: practitioner._id } : { _id: { $exists: false } };
  },
  recordScope: async (req) => {
    if (!["doctor","therapist"].includes(req.user.role)) return {};
    const practitioner = await Doctor.findOne({ user: req.user._id }).select("_id").lean();
    return practitioner ? { practitioner: practitioner._id } : { _id: { $exists: false } };
  },
  searchableFields: ["service","room"],
  validateCreate: async ({ payload }) => {
    const shapeError = validateAppointmentShape(payload);
    if (shapeError) return { statusCode: 400, message: shapeError };
    const [patient, practitioner] = await Promise.all([
      Patient.findById(payload.patient).select("status"),
      Doctor.findById(payload.practitioner).select("status availability")
    ]);
    if (!patient) return { statusCode: 404, message: "Patient not found" };
    if (["on-hold", "discharged"].includes(patient.status)) return { statusCode: 409, message: "Appointments cannot be booked for patients on hold or discharged" };
    if (!practitioner || practitioner.status === "inactive") return { statusCode: 409, message: "Select an active practitioner" };
    if (!isWithinPractitionerAvailability(payload.startsAt, payload.durationMinutes, practitioner.availability)) return { statusCode: 409, message: "The appointment falls outside this practitioner’s recorded availability" };
    const conflict = await findAppointmentConflict(payload);
    if (conflict) return { statusCode: 409, message: "The practitioner or room already has an overlapping appointment" };
    return null;
  },
  validateUpdate: async ({ req, payload }) => {
    const existing = await Appointment.findById(req.params.id);
    if (!existing) return { statusCode: 404, message: "Appointment not found" };
    const next = { ...existing.toObject(), ...payload };
    const shapeError = validateAppointmentShape(next, { allowPast: true });
    if (shapeError) return { statusCode: 400, message: shapeError };
    if (payload.status && !canTransitionAppointment(existing.status, payload.status)) {
      return { statusCode: 409, message: `Appointment cannot move from ${existing.status} to ${payload.status}` };
    }
    if (payload.patient || payload.practitioner || payload.startsAt || payload.durationMinutes || payload.room) {
      const [patient, practitioner] = await Promise.all([
        Patient.findById(next.patient).select("status"),
        Doctor.findById(next.practitioner).select("status availability")
      ]);
      if (!patient) return { statusCode: 404, message: "Patient not found" };
      if (["on-hold", "discharged"].includes(patient.status)) return { statusCode: 409, message: "Appointments cannot be scheduled for patients on hold or discharged" };
      if (!practitioner || practitioner.status === "inactive") return { statusCode: 409, message: "Select an active practitioner" };
      if (!isWithinPractitionerAvailability(next.startsAt, next.durationMinutes, practitioner.availability)) return { statusCode: 409, message: "The appointment falls outside this practitioner’s recorded availability" };
      const conflict = await findAppointmentConflict(next, existing._id);
      if (conflict) return { statusCode: 409, message: "The practitioner or room already has an overlapping appointment" };
    }
    return null;
  }
}), { read: appointmentStaff, create: reception, update: appointmentStaff, remove: [] }));
router.post("/invoices", permit(...invoiceCreators), createInvoice);
router.use("/invoices", crudRoutes(makeCrudController(Invoice, ["patient"], {
  createFields: ["patient","invoiceNo","items","discount","paidAmount","paymentMode","status"],
  updateFields: ["items","discount","paidAmount","paymentMode","status"],
  filterFields: ["status","patient"], filterAliases: { patientId: "patient" }, searchableFields: ["invoiceNo"],
  updateScope: (req) => ["director","admin"].includes(req.user.role) ? {} : { status: { $nin: ["paid","void"] } }
}), { read: invoiceReaders, write: billing, create: [], remove: [] }));
router.post("/invoices/generate-from-appointment/:appointmentId", permit(...invoiceCreators), generateInvoiceFromAppointment);
router.use("/inventory", crudRoutes(makeCrudController(InventoryItem, [], {
  createFields: ["name","category","quantity","reorderLevel","unit","vendor","notes"],
  updateFields: ["name","category","quantity","reorderLevel","unit","vendor","notes"],
  filterFields: ["category"], searchableFields: ["name","category","vendor"]
}), { read: ["director","admin","coordinator"], write: ["director","admin","coordinator"], remove: management }));
router.use("/tasks", crudRoutes(makeCrudController(Task, ["assignedTo"], {
  createFields: ["title","department","assignedTo","dueDate","priority","status"],
  updateFields: ["title","department","assignedTo","dueDate","priority","status"],
  updateFieldsByRole: { doctor: ["status"], therapist: ["status"], accounts: ["status"] },
  filterFields: ["status","department"], searchableFields: ["title","department"],
  listScope: taskScope, recordScope: taskScope
}), {
  read: ["director","admin","reception","doctor","therapist","accounts","coordinator"],
  create: taskManagers, update: [...taskManagers,"doctor","therapist","accounts"], remove: management
}));
router.use("/assessments", permit(...clinical), assessmentRoutes);
router.use("/treatment-plans", permit(...clinical), treatmentPlanRoutes);
router.use("/progress-notes", permit(...clinical), progressNoteRoutes);
router.use("/prescriptions", permit("director","admin","doctor"), prescriptionRoutes);
export default router;
