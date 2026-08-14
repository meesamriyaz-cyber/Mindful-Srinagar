import express from "express";
import { listAssessments, createAssessment, getAssessment, updateAssessment } from "../controllers/assessmentController.js";

const router = express.Router();

router.get("/", listAssessments);
router.post("/", createAssessment);
router.get("/:id", getAssessment);
router.put("/:id", updateAssessment);

export default router;
