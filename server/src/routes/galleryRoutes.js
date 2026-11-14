import express from "express";
import { createGallery, getGallery, listGalleries, transitionGallery, updateGallery } from "../controllers/galleryController.js";

const router = express.Router();
router.post("/", createGallery);
router.get("/", listGalleries);
router.get("/:id", getGallery);
router.patch("/:id", updateGallery);
router.patch("/:id/status", transitionGallery);
export default router;
