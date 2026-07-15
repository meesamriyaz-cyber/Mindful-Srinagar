import express from "express";
import { getDashboard } from "../controllers/dashboardController.js";
import { makeCrudController } from "../controllers/crudController.js";
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

const router = express.Router();

router.get("/health", (_req, res) => res.json({ status: "ok", service: "mindful-api" }));
router.use("/auth", authRoutes);
router.post("/enquiries", async (req, res, next) => {
  try {
    const { name, phone, source, concern } = req.body;

    if (!name || !phone || !source || !concern) {
      res.status(400);
      throw new Error("Name, phone, referral source and concern are required");
    }

    const referral = await Referral.create({
      sourceType: source,
      sourceName: source === "walk-in" ? "Walk-in enquiry" : `${source} enquiry`,
      phone,
      patientName: name,
      concern,
      status: "new"
    });

    res.status(201).json({ id: referral._id, message: "Enquiry received" });
  } catch (error) {
    next(error);
  }
});

router.use(protect);
router.get("/dashboard", getDashboard);
router.use("/patients", crudRoutes(makeCrudController(Patient, ["referral"])));
router.use("/doctors", crudRoutes(makeCrudController(Doctor)));
router.use("/referrals", crudRoutes(makeCrudController(Referral, ["assignedTo"])));
router.use("/appointments", crudRoutes(makeCrudController(Appointment, ["patient", "practitioner"])));
router.use("/invoices", crudRoutes(makeCrudController(Invoice, ["patient"])));
router.use("/inventory", crudRoutes(makeCrudController(InventoryItem)));
router.use("/tasks", crudRoutes(makeCrudController(Task, ["assignedTo"])));

export default router;
