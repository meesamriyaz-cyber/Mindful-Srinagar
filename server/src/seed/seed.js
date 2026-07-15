import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDb } from "../config/db.js";
import { Appointment } from "../models/Appointment.js";
import { Doctor } from "../models/Doctor.js";
import { InventoryItem } from "../models/InventoryItem.js";
import { Patient } from "../models/Patient.js";
import { Referral } from "../models/Referral.js";
import { Task } from "../models/Task.js";
import { User } from "../models/User.js";

dotenv.config();

async function seed() {
  await connectDb(process.env.MONGO_URI);
  await Promise.all([
    User.deleteMany(),
    Patient.deleteMany(),
    Doctor.deleteMany(),
    Referral.deleteMany(),
    Appointment.deleteMany(),
    InventoryItem.deleteMany(),
    Task.deleteMany()
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
  await Appointment.create({
    patient: patient._id,
    practitioner: doctors[1]._id,
    service: "Speech-Language Pathology",
    startsAt,
    room: "Therapy Room 1"
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
