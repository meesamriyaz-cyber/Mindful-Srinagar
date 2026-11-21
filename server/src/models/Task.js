import mongoose from "mongoose";

const taskActivitySchema = new mongoose.Schema({
  type: { type: String, enum: ["completed"], required: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  occurredAt: { type: Date, required: true, default: Date.now },
  note: { type: String, trim: true, maxlength: 1000, default: "" }
}, { _id: true });

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 180 },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient" },
  department: { type: String, enum: ["front-desk", "clinical", "accounts", "outreach", "operations"], default: "operations" },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  dueDate: Date,
  priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
  status: { type: String, enum: ["todo", "in-progress", "done"], default: "todo" },
  completedAt: Date,
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  completionNote: { type: String, trim: true, maxlength: 1000, default: "" },
  activity: { type: [taskActivitySchema], default: [] }
}, { timestamps: true });

taskSchema.index({ status: 1, dueDate: 1 });
taskSchema.index({ patient: 1, status: 1 });
taskSchema.index({ department: 1, priority: 1 });
taskSchema.index({ assignedTo: 1, status: 1, dueDate: 1 });
export const Task = mongoose.model("Task", taskSchema);
