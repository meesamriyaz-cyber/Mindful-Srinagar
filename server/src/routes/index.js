import express from "express";
import { getDashboard } from "../controllers/dashboardController.js";
import { makeCrudController } from "../controllers/crudController.js";
import { createEnquiry } from "../controllers/enquiryController.js";
import { protect } from "../middleware/auth.js";
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

const router = express.Router();

router.get("/health", (_req, res) => res.json({ status: "ok", service: "mindful-api" }));
router.use("/auth", authRoutes);
router.post("/enquiries", createEnquiry);

router.use(protect);
router.get("/dashboard", getDashboard);
router.use("/patients", crudRoutes(makeCrudController(Patient, ["referral"])));
router.use("/doctors", crudRoutes(makeCrudController(Doctor)));
router.use("/referrals", crudRoutes(makeCrudController(Referral, ["assignedTo"])));
router.use("/appointments", crudRoutes(makeCrudController(Appointment, ["patient", "practitioner"])));
router.use("/invoices", crudRoutes(makeCrudController(Invoice, ["patient"])));
router.use("/inventory", crudRoutes(makeCrudController(InventoryItem)));
router.use("/tasks", crudRoutes(makeCrudController(Task, ["assignedTo"])));
router.use("/assessments", assessmentRoutes);
router.use("/treatment-plans", treatmentPlanRoutes);
router.use("/progress-notes", progressNoteRoutes);
router.use("/prescriptions", prescriptionRoutes);

export default router;
