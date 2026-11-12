import mongoose from "mongoose";
import { Referral } from "../models/Referral.js";
import { validateReferralFollowUp } from "../security/referralRules.js";

export async function logReferralFollowUp(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "A valid referral ID is required" });
    }
    const payload = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
    const allowed = ["contactMethod", "outcome", "note", "nextFollowUpAt"];
    const unexpected = Object.keys(payload).find((key) => !allowed.includes(key));
    if (unexpected) return res.status(400).json({ message: "Unsupported field: " + unexpected });

    const validationError = validateReferralFollowUp(payload);
    if (validationError) return res.status(400).json({ message: validationError });

    const referral = await Referral.findById(req.params.id);
    if (!referral) return res.status(404).json({ message: "Referral not found" });
    if (["converted", "lost"].includes(referral.status)) {
      return res.status(409).json({ message: "Follow-up cannot be logged for a closed referral" });
    }

    const nextFollowUpAt = payload.nextFollowUpAt ? new Date(payload.nextFollowUpAt) : undefined;
    referral.followUpHistory.push({
      contactMethod: payload.contactMethod,
      outcome: payload.outcome,
      note: payload.note.trim(),
      nextFollowUpAt,
      loggedBy: req.user._id,
      createdAt: new Date()
    });
    if (payload.outcome === "appointment-booked") {
      referral.status = "scheduled";
      referral.followUpDate = undefined;
    } else {
      if (referral.status === "new") referral.status = "contacted";
      referral.followUpDate = nextFollowUpAt;
    }
    await referral.save();
    await referral.populate("assignedTo", "name role");
    await referral.populate("followUpHistory.loggedBy", "name role");
    return res.status(201).json(referral);
  } catch (error) {
    return next(error);
  }
}
