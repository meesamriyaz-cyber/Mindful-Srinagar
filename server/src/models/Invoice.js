import mongoose from "mongoose";
const invoiceItemSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true, maxlength: 200 },
  quantity: { type: Number, required: true, default: 1, min: 0.01, max: 100000 },
  rate: { type: Number, required: true, min: 0, max: 100000000 }
});
const paymentSchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 0.01 },
  method: { type: String, enum: ["cash", "upi", "card", "bank"], required: true },
  reference: { type: String, trim: true, maxlength: 120 },
  notes: { type: String, trim: true, maxlength: 500 },
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receivedAt: { type: Date, required: true, default: Date.now }
}, { _id: true });

const invoiceSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  invoiceNo: { type: String, required: true, unique: true, trim: true },
  items: { type: [invoiceItemSchema], validate: {
    validator: (items) => items.length > 0 && items.length <= 50,
    message: "An invoice must contain between 1 and 50 items"
  }},
  discount: { type: Number, default: 0, min: 0 },
  paidAmount: { type: Number, default: 0, min: 0 },\n  payments: { type: [paymentSchema], default: [] },
  paymentMode: { type: String, enum: ["cash","upi","card","bank","mixed"], default: "cash" },
  status: { type: String, enum: ["draft","paid","partial","void"], default: "draft" }
}, { timestamps: true });
invoiceSchema.virtual("total").get(function getTotal() {
  return this.items.reduce((sum, item) => sum + item.quantity * item.rate, 0) - this.discount;
});
invoiceSchema.pre("validate", function validateInvoice(next) {
  const paymentTotal = (this.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);\n  if (Math.abs(paymentTotal - this.paidAmount) > 0.009) this.invalidate("paidAmount", "Paid amount must match the recorded payment history");\n  const gross = this.items.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const total = gross - this.discount;
  if (this.discount > gross) this.invalidate("discount", "Discount cannot exceed the invoice subtotal");
  if (this.paidAmount > total) this.invalidate("paidAmount", "Payment cannot exceed the invoice total");
  if (this.status === "paid" && this.paidAmount !== total) this.invalidate("status", "A paid invoice must be fully paid");
  if (this.status === "partial" && !(this.paidAmount > 0 && this.paidAmount < total)) {
    this.invalidate("status", "A partial invoice must have a payment between zero and the total");
  }
  next();
});
invoiceSchema.pre("findOneAndUpdate", async function validateInvoiceUpdate() {
  const current = await this.model.findOne(this.getQuery()).lean();
  if (!current) return;
  const update = this.getUpdate() || {};
  const patch = update.$set || update;
  const items = patch.items ?? current.items ?? [];
  const discount = Number(patch.discount ?? current.discount ?? 0);
  const paidAmount = Number(patch.paidAmount ?? current.paidAmount ?? 0);\n  if (patch.paidAmount !== undefined && Number(patch.paidAmount) !== Number(current.paidAmount || 0)) fail("Payments must be recorded through the payment endpoint");
  const status = patch.status ?? current.status;
  const subtotal = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.rate), 0);
  const total = subtotal - discount;
  const fail = (message) => { const error = new Error(message); error.statusCode = 400; throw error; };
  if (!Number.isFinite(subtotal) || discount < 0 || discount > subtotal) fail("Discount must be non-negative and cannot exceed the invoice subtotal");
  if (!Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > total) fail("Payment must be between zero and the invoice total");
  if (status === "paid" && paidAmount !== total) fail("A paid invoice must be fully paid");
  if (status === "partial" && !(paidAmount > 0 && paidAmount < total)) fail("A partial invoice must have a payment between zero and the total");
});
invoiceSchema.index({ status: 1, createdAt: -1 });
invoiceSchema.index({ patient: 1, createdAt: -1 });
export const Invoice = mongoose.model("Invoice", invoiceSchema);
