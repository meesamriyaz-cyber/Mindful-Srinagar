import mongoose from "mongoose";

const inventoryItemSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  category: { type: String, required: true, trim: true, maxlength: 80 },
  quantity: { type: Number, default: 0, min: 0, max: 1000000 },
  reorderLevel: { type: Number, default: 5, min: 0, max: 1000000 },
  unit: { type: String, default: "pcs", trim: true, maxlength: 30 },
  vendor: { type: String, trim: true, maxlength: 160 },
  notes: { type: String, trim: true, maxlength: 1000 }
}, { timestamps: true });

inventoryItemSchema.index({ category: 1, name: 1 });
inventoryItemSchema.index({ quantity: 1, reorderLevel: 1 });
export const InventoryItem = mongoose.model("InventoryItem", inventoryItemSchema);
