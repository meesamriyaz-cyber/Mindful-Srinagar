import mongoose from "mongoose";
import { loadEnv } from "../config/env.js";
import { connectDb } from "../config/db.js";
import { Appointment } from "../models/Appointment.js";
import { Assessment } from "../models/Assessment.js";
import { Doctor } from "../models/Doctor.js";
import { InventoryItem } from "../models/InventoryItem.js";
import { Patient } from "../models/Patient.js";
import { Prescription } from "../models/Prescription.js";
import { ProgressNote } from "../models/ProgressNote.js";
import { Referral } from "../models/Referral.js";
import { Task } from "../models/Task.js";
import { TreatmentPlan } from "../models/TreatmentPlan.js";
import { User } from "../models/User.js";

loadEnv();

async function seed() {
  await connectDb(process.env.MONGO_URI);
  await Promise.all([
    User.deleteMany(),
    Patient.deleteMany(),
    Doctor.deleteMany(),
    Referral.deleteMany(),
    Appointment.deleteMany(),
    InventoryItem.deleteMany(),
    Task.deleteMany(),
    Assessment.deleteMany(),
    TreatmentPlan.deleteMany(),
    ProgressNote.deleteMany(),
    Prescription.deleteMany()
  ]);

  const admin = await User.create({
    name: "Centre Administrator",
    email: "admin@mindful.local",
    passwordHash: await User.hashPassword("ChangeMe123!"),
    role: "director"
  });

  const doctors = await Doctor.insertMany([
    { name: "Dr. Zaffar Iqbal", discipline: "Rehabilitation Medicine", status: "active" },
    { name: "Speech Therapy Lead", discipline: "Speech-Language Pathology", status: "active" },
    { name: "Occupational Therapy Lead", discipline: "Occupational Therapy", status: "active" }
  ]);

  const referral = await Referral.create({
    sourceType: "hospital",
    sourceName: "Bemina Referral Desk",
    contactPerson: "Outreach Coordinator",
    patientName: "Sample Patient",
    concern: "Developmental and communicative challenges",
    assignedTo: admin._id,
    status: "scheduled"
  });

  const patient = await Patient.create({
    mrn: "MRN-2026-001",
    fullName: "Sample Patient",
    guardianName: "Sample Guardian",
    age: 8,
    gender: "prefer-not-to-say",
    phone: "9906897822",
    address: "Srinagar",
    primaryConcern: "Speech delay and learning support",
    services: ["Speech-Language Pathology", "Special Education"],
    status: "active",
    referral: referral._id
  });

  const startsAt = new Date();
  startsAt.setHours(10, 30, 0, 0);
  const appointment = await Appointment.create({
    patient: patient._id,
    practitioner: doctors[1]._id,
    service: "Speech-Language Pathology",
    startsAt,
    room: "Therapy Room 1"
  });

  await Assessment.create({
    patient: patient._id,
    assessedBy: admin._id,
    assessedAt: new Date(),
    domains: ["Speech", "Language", "Social Communication"],
    findings: "Moderate expressive language delay with age-appropriate receptive skills.",
    recommendations: "Weekly speech therapy, home practice, parental guidance sessions.",
    status: "completed"
  });

  await TreatmentPlan.create({
    patient: patient._id,
    createdBy: admin._id,
    startDate: new Date(),
    endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    goals: "Improve expressive vocabulary and sentence formation.",
    interventions: ["Articulation drills", "Picture exchange communication", "Parent-mediated intervention"],
    frequency: "Weekly",
    duration: "45 minutes",
    status: "active"
  });

  await ProgressNote.create({
    patient: patient._id,
    appointment: appointment._id,
    author: doctors[1]._id,
    notedAt: new Date(),
    noteType: "session",
    subjective: "Guardian reports improved eye contact at home.",
    objective: "Patient used 4-word sentences during structured play. Articulation improved for /k/ and /g/.",
    assessment: "Progressing well toward initial treatment goals.",
    plan: "Continue current program. Introduce rhyming activities next session."
  });

  await Prescription.create({
    patient: patient._id,
    prescribedBy: admin._id,
    prescribedAt: new Date(),
    medications: [
      {
        name: "Multivitamin Syrup",
        dosage: "5ml",
        frequency: "Once daily",
        duration: "30 days",
        instructions: "Take after breakfast"
      }
    ],
    notes: "Supportive therapy alongside clinical sessions.",
    status: "active"
  });

  await InventoryItem.insertMany([
    { name: "Assessment Forms", category: "Clinical stationery", quantity: 3, reorderLevel: 10, unit: "pads" },
    { name: "Therapy Putty", category: "Occupational therapy", quantity: 4, reorderLevel: 5, unit: "sets" }
  ]);

  await Task.insertMany([
    { title: "Call hospital referral desk for weekly follow-up", department: "outreach", assignedTo: admin._id, priority: "high" },
    { title: "Prepare parent progress summary", department: "clinical", priority: "medium" }
  ]);

  console.log("Seed complete. Login: admin@mindful.local / ChangeMe123!");
  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
