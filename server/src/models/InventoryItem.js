import mongoose from "mongoose";

const inventoryItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    quantity: { type: Number, default: 0 },
    reorderLevel: { type: Number, default: 5 },
    unit: { type: String, default: "pcs" },
    vendor: { type: String, trim: true },
    notes: { type: String, trim: true }
  },
  { timestamps: true }
);

inventoryItemSchema.index({ category: 1, name: 1 });
inventoryItemSchema.index({ quantity: 1, reorderLevel: 1 });

export const InventoryItem = mongoose.model("InventoryItem", inventoryItemSchema);
