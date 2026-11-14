import express from "express";
import { createPublication, getPublication, listPublications, updatePublication } from "../controllers/publicationController.js";

const router = express.Router();

router.post("/", createPublication);
router.get("/", listPublications);
router.get("/:id", getPublication);
router.patch("/:id", updatePublication);

export default router;
