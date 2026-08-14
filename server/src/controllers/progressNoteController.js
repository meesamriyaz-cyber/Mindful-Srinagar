import { ProgressNote } from "../models/ProgressNote.js";
import { Patient } from "../models/Patient.js";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 50;
  return Math.min(Math.max(parsed, 1), 100);
}

export async function listProgressNotes(req, res, next) {
  try {
    const { patientId, appointmentId, q, limit = 50 } = req.query;
    const filter = {};
    if (patientId) filter.patient = patientId;
    if (appointmentId) filter.appointment = appointmentId;

    let query = ProgressNote.find(filter)
      .populate("patient", "fullName mrn")
      .populate("appointment", "startsAt service status")
      .populate("author", "name email");

    if (q) {
      const safeQuery = escapeRegex(String(q).trim().slice(0, 80));
      const expression = new RegExp(safeQuery, "i");
      query = ProgressNote.find({
        ...filter,
        $or: [
          { subjective: expression },
          { objective: expression },
          { assessment: expression },
          { plan: expression },
          { "patient.fullName": expression },
          { "patient.mrn": expression }
        ]
      })
        .populate("patient", "fullName mrn")
        .populate("appointment", "startsAt service status")
        .populate("author", "name email");
    }

    const docs = await query.sort({ notedAt: -1 }).limit(parseLimit(limit));
    res.json(docs);
  } catch (error) {
    next(error);
  }
}

export async function createProgressNote(req, res, next) {
  try {
    const patient = await Patient.findById(req.body.patient);
    if (!patient) {
      res.status(404);
      throw new Error("Patient not found");
    }
    const doc = await ProgressNote.create({
      ...req.body,
      author: req.user._id
    });
    const populated = await ProgressNote.findById(doc._id)
      .populate("patient", "fullName mrn")
      .populate("appointment", "startsAt service status")
      .populate("author", "name email");
    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
}

export async function getProgressNote(req, res, next) {
  try {
    const doc = await ProgressNote.findById(req.params.id)
      .populate("patient", "fullName mrn")
      .populate("appointment", "startsAt service status room")
      .populate("author", "name email");
    if (!doc) {
      res.status(404);
      throw new Error("Progress note not found");
    }
    res.json(doc);
  } catch (error) {
    next(error);
  }
}

export async function updateProgressNote(req, res, next) {
  try {
    const doc = await ProgressNote.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true, context: "query" }
    )
      .populate("patient", "fullName mrn")
      .populate("appointment", "startsAt service status")
      .populate("author", "name email");
    if (!doc) {
      res.status(404);
      throw new Error("Progress note not found");
    }
    res.json(doc);
  } catch (error) {
    next(error);
  }
}
