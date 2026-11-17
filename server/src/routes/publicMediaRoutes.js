import express from "express";
import { getPublicPublication, listPublicCareServices, listPublicMedia } from "../controllers/publicationController.js";

const router = express.Router();

router.get("/", listPublicMedia);
router.get("/care-services", listPublicCareServices);
router.get("/:slug", getPublicPublication);

export default router;
