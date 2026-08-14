import express from "express";
import { listProgressNotes, createProgressNote, getProgressNote, updateProgressNote } from "../controllers/progressNoteController.js";

const router = express.Router();

router.get("/", listProgressNotes);
router.post("/", createProgressNote);
router.get("/:id", getProgressNote);
router.put("/:id", updateProgressNote);

export default router;
