import mongoose from "mongoose";

const inventoryMovementSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryItem", required: true, index: true },
  type: { type: String, enum: ["receipt", "issue", "adjustment"], required: true },
  quantity: { type: Number, required: true, min: 0.01 },
  previousQuantity: { type: Number, required: true, min: 0 },
  newQuantity: { type: Number, required: true, min: 0 },
  reason: { type: String, required: true, trim: true, maxlength: 300 },
  reference: { type: String, trim: true, maxlength: 120 },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

inventoryMovementSchema.index({ item: 1, createdAt: -1 });
export const InventoryMovement = mongoose.model("InventoryMovement", inventoryMovementSchema);
