import express from "express";
import { listTreatmentPlans, createTreatmentPlan, getTreatmentPlan, updateTreatmentPlan } from "../controllers/treatmentPlanController.js";

const router = express.Router();

router.get("/", listTreatmentPlans);
router.post("/", createTreatmentPlan);
router.get("/:id", getTreatmentPlan);
router.put("/:id", updateTreatmentPlan);

export default router;
