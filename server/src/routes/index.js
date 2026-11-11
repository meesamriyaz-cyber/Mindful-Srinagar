import express from "express";
import { getDashboard } from "../controllers/dashboardController.js";
import { makeCrudController } from "../controllers/crudController.js";
import { createEnquiry } from "../controllers/enquiryController.js";
import { permit, protect } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimiter.js";
import { Appointment } from "../models/Appointment.js";
import { Doctor } from "../models/Doctor.js";
import { InventoryItem } from "../models/InventoryItem.js";
import { Invoice } from "../models/Invoice.js";
import { Patient } from "../models/Patient.js";
import { Referral } from "../models/Referral.js";
import { Task } from "../models/Task.js";
import authRoutes from "./authRoutes.js";
import { crudRoutes } from "./crudRoutes.js";
import assessmentRoutes from "./assessmentRoutes.js";
import treatmentPlanRoutes from "./treatmentPlanRoutes.js";
import progressNoteRoutes from "./progressNoteRoutes.js";
import prescriptionRoutes from "./prescriptionRoutes.js";
import { createInvoice, generateInvoiceFromAppointment } from "../controllers/invoiceController.js";
import { taskManagers, taskScope } from "../security/taskAccess.js";
const router = express.Router();
const management = ["director", "admin"];
const reception = ["director", "admin", "reception", "coordinator"];
const clinical = ["director", "admin", "doctor", "therapist"];
const patientReaders = ["director", "admin", "reception", "coordinator", "doctor", "therapist"];
const appointmentStaff = ["director", "admin", "reception", "coordinator", "doctor", "therapist"];
const billing = ["director", "admin", "accounts"];
const invoiceReaders = [...billing, "reception"];
const invoiceCreators = [...billing, "reception"];

router.get("/health", (_req, res) => res.json({ status: "ok", service: "mindful-api" }));
router.use("/auth", authRoutes);
router.post("/enquiries", createRateLimiter({ windowMs: 900000, max: 8, message: "Too many enquiries from this connection. Please try again later." }), createEnquiry);
router.use(protect);
router.get("/dashboard", permit("director", "admin", "coordinator", "reception"), getDashboard);
router.use("/patients", crudRoutes(makeCrudController(Patient, ["referral"], {
  createFields: ["fullName","guardianName","age","gender","phone","address","primaryConcern","services","status","referral","notes"],
  updateFields: ["fullName","guardianName","age","gender","phone","address","primaryConcern","services","status","referral","notes","dischargeDate","dischargeSummary","dischargeReason"],
  filterFields: ["status","referral"], searchableFields: ["fullName","mrn","phone","guardianName","primaryConcern"]
}), { read: patientReaders, write: reception, remove: management }));
router.use("/doctors", crudRoutes(makeCrudController(Doctor, [], {
  createFields: ["name","discipline","registrationNo","phone","email","availability","status"],
  updateFields: ["name","discipline","registrationNo","phone","email","availability","status"],
  filterFields: ["status","discipline"], searchableFields: ["name","discipline","phone","email"]
}), { read: patientReaders, write: management, remove: management }));
router.use("/referrals", crudRoutes(makeCrudController(Referral, ["assignedTo"], {
  createFields: ["sourceType","sourceName","contactPerson","phone","email","patientName","concern","preferredContact","urgency","status","assignedTo","followUpDate","notes"],
  updateFields: ["sourceType","sourceName","contactPerson","phone","email","patientName","concern","preferredContact","urgency","status","assignedTo","followUpDate","notes"],
  filterFields: ["status","sourceType","urgency","assignedTo"], searchableFields: ["patientName","sourceName","phone","concern"]
}), { read: reception, write: reception, remove: management }));
router.use("/appointments", crudRoutes(makeCrudController(Appointment, ["patient","practitioner"], {
  createFields: ["patient","practitioner","service","startsAt","durationMinutes","room","status","clinicalNotes"],
  updateFields: ["patient","practitioner","service","startsAt","durationMinutes","room","status","clinicalNotes"],
  filterFields: ["status","patient","practitioner"], filterAliases: { patientId: "patient" },
  updateFieldsByRole: { doctor: ["status","clinicalNotes"], therapist: ["status","clinicalNotes"] },
  searchableFields: ["service","room"]
}), { read: appointmentStaff, create: reception, update: appointmentStaff, remove: management }));
router.post("/invoices", permit(...invoiceCreators), createInvoice);
router.use("/invoices", crudRoutes(makeCrudController(Invoice, ["patient"], {
  createFields: ["patient","invoiceNo","items","discount","paidAmount","paymentMode","status"],
  updateFields: ["items","discount","paidAmount","paymentMode","status"],
  filterFields: ["status","patient"], filterAliases: { patientId: "patient" }, searchableFields: ["invoiceNo"]
}), { read: invoiceReaders, write: billing, create: [], remove: management }));
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
