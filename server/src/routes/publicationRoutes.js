import express from "express";
import { createPublication, getPublication, listPublications, updatePublication } from "../controllers/publicationController.js";
import { transitionPublication } from "../controllers/publicationWorkflowController.js";

const router = express.Router();

router.post("/", createPublication);
router.get("/", listPublications);
router.get("/:id", getPublication);
router.patch("/:id/status", transitionPublication);
router.patch("/:id", updatePublication);

export default router;
