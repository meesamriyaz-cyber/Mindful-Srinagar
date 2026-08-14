import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    department: {
      type: String,
      enum: ["front-desk", "clinical", "accounts", "outreach", "operations"],
      default: "operations"
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    dueDate: Date,
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    status: { type: String, enum: ["todo", "in-progress", "done"], default: "todo" }
  },
  { timestamps: true }
);

taskSchema.index({ status: 1, dueDate: 1 });
taskSchema.index({ department: 1, priority: 1 });

export const Task = mongoose.model("Task", taskSchema);
