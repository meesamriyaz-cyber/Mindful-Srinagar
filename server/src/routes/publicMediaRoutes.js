import express from "express";
import { getPublicPublication, listPublicMedia } from "../controllers/publicationController.js";

const router = express.Router();

router.get("/", listPublicMedia);
router.get("/:slug", getPublicPublication);

export default router;
