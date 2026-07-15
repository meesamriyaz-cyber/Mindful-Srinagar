import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    invoiceNo: { type: String, required: true, unique: true, trim: true },
    items: [
      {
        description: { type: String, required: true },
        quantity: { type: Number, default: 1 },
        rate: { type: Number, required: true }
      }
    ],
    discount: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    paymentMode: { type: String, enum: ["cash", "upi", "card", "bank", "mixed"], default: "cash" },
    status: { type: String, enum: ["draft", "paid", "partial", "void"], default: "draft" }
  },
  { timestamps: true }
);

invoiceSchema.virtual("total").get(function getTotal() {
  return this.items.reduce((sum, item) => sum + item.quantity * item.rate, 0) - this.discount;
});

export const Invoice = mongoose.model("Invoice", invoiceSchema);
