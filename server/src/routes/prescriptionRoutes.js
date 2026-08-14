import express from "express";
import { listPrescriptions, createPrescription, getPrescription, updatePrescription } from "../controllers/prescriptionController.js";

const router = express.Router();

router.get("/", listPrescriptions);
router.post("/", createPrescription);
router.get("/:id", getPrescription);
router.put("/:id", updatePrescription);

export default router;
