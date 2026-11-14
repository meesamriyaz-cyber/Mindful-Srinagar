import mongoose from "mongoose";
import { MediaAsset } from "../models/MediaAsset.js";
import { Publication } from "../models/Publication.js";
import { canExposePublication } from "../security/mediaRules.js";

export async function transitionPublication(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "A valid publication ID is required" });
    const { status } = req.body || {};
    if (!["published", "draft", "archived"].includes(status)) return res.status(400).json({ message: "Choose published, draft or archived status" });
    const publication = await Publication.findById(req.params.id);
    if (!publication) return res.status(404).json({ message: "Publication not found" });
    if (status === "published") {
      if (publication.identifiablePeople && (publication.consentStatus !== "verified" || !["website", "website-and-social", "all-public"].includes(publication.consentScope))) {
        return res.status(409).json({ message: "Publication consent must be verified for website use before publishing" });
      }
      if (publication.consentStatus === "withdrawn") return res.status(409).json({ message: "A publication with withdrawn consent cannot be published" });
      const ids = [...new Set([publication.coverMedia, ...publication.mediaItems].filter(Boolean).map(String))];
      if (ids.length) {
        const assets = await MediaAsset.find({ _id: { $in: ids }, status: "ready" }).select("_id identifiablePeople consentStatus consentScope").lean();
        if (assets.length !== ids.length) return res.status(409).json({ message: "Remove unavailable or archived media before publishing" });
        if (assets.some((asset) => asset.consentStatus === "withdrawn" || (asset.identifiablePeople && (asset.consentStatus !== "verified" || !["website", "website-and-social", "all-public"].includes(asset.consentScope))))) {
          return res.status(409).json({ message: "Every identifiable person in publication media must have verified website consent" });
        }
      }
      if (!canExposePublication({ ...publication.toObject(), status: "published" })) return res.status(409).json({ message: "Publication is not eligible for public display" });
    }
    publication.status = status;
    publication.updatedBy = req.user._id;
    if (status === "published") { publication.publishedAt = new Date(); publication.publishedBy = req.user._id; }
    else { publication.publishedAt = null; publication.publishedBy = null; }
    await publication.save();
    return res.json(publication);
  } catch (error) { return next(error); }
}
