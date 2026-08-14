import { Assessment } from "../models/Assessment.js";
import { Patient } from "../models/Patient.js";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 50;
  return Math.min(Math.max(parsed, 1), 100);
}

export async function listAssessments(req, res, next) {
  try {
    const { patientId, status, q, limit = 50 } = req.query;
    const filter = {};
    if (patientId) filter.patient = patientId;
    if (status) filter.status = status;

    let query = Assessment.find(filter)
      .populate("patient", "fullName mrn")
      .populate("assessedBy", "name email");

    if (q) {
      const safeQuery = escapeRegex(String(q).trim().slice(0, 80));
      const expression = new RegExp(safeQuery, "i");
      query = Assessment.find({
        ...filter,
        $or: [
          { findings: expression },
          { recommendations: expression },
          { "patient.fullName": expression },
          { "patient.mrn": expression }
        ]
      })
        .populate("patient", "fullName mrn")
        .populate("assessedBy", "name email");
    }

    const docs = await query.sort({ assessedAt: -1 }).limit(parseLimit(limit));
    res.json(docs);
  } catch (error) {
    next(error);
  }
}

export async function createAssessment(req, res, next) {
  try {
    const patient = await Patient.findById(req.body.patient);
    if (!patient) {
      res.status(404);
      throw new Error("Patient not found");
    }
    const doc = await Assessment.create({
      ...req.body,
      assessedBy: req.user._id
    });
    const populated = await Assessment.findById(doc._id)
      .populate("patient", "fullName mrn")
      .populate("assessedBy", "name email");
    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
}

export async function getAssessment(req, res, next) {
  try {
    const doc = await Assessment.findById(req.params.id)
      .populate("patient", "fullName mrn guardianName phone")
      .populate("assessedBy", "name email");
    if (!doc) {
      res.status(404);
      throw new Error("Assessment not found");
    }
    res.json(doc);
  } catch (error) {
    next(error);
  }
}

export async function updateAssessment(req, res, next) {
  try {
    const doc = await Assessment.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true, context: "query" }
    )
      .populate("patient", "fullName mrn")
      .populate("assessedBy", "name email");
    if (!doc) {
      res.status(404);
      throw new Error("Assessment not found");
    }
    res.json(doc);
  } catch (error) {
    next(error);
  }
}
