import express from "express";
import { getPublicGallery, listPublicGalleries } from "../controllers/galleryController.js";

const router = express.Router();
router.get("/", listPublicGalleries);
router.get("/:slug", getPublicGallery);
export default router;
