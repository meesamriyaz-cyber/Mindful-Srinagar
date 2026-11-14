import express from "express";
import { createRateLimiter } from "../middleware/rateLimiter.js";
import { createUploadSignature, deleteMediaAsset, listMediaAssets, registerMediaAsset, updateMediaAsset } from "../controllers/mediaController.js";

const router = express.Router();
const uploadSignatureLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: "Too many media upload requests. Please wait before trying again."
});

router.post("/upload-signature", uploadSignatureLimiter, createUploadSignature);
router.post("/", registerMediaAsset);
router.get("/", listMediaAssets);
router.patch("/:id", updateMediaAsset);
router.delete("/:id", deleteMediaAsset);

export default router;
