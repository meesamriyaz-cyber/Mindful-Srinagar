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
});
const invoiceSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  invoiceNo: { type: String, required: true, unique: true, trim: true },
  items: { type: [invoiceItemSchema], validate: {
    validator: (items) => items.length > 0 && items.length <= 50,
    message: "An invoice must contain between 1 and 50 items"
  }},
  discount: { type: Number, default: 0, min: 0 },
  paidAmount: { type: Number, default: 0, min: 0 },
  openingPaidAmount: { type: Number, default: 0, min: 0 },
  payments: { type: [paymentSchema], default: [] },
  paymentMode: { type: String, enum: ["cash","upi","card","bank","mixed"], default: "cash" },
  status: { type: String, enum: ["draft","paid","partial","void"], default: "draft" }
}, { timestamps: true });
invoiceSchema.virtual("total").get(function getTotal() {
  return this.items.reduce((sum, item) => sum + item.quantity * item.rate, 0) - this.discount;
});
invoiceSchema.pre("validate", function validateInvoice(next) {
  const gross = this.items.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const total = Math.round((gross - this.discount) * 100) / 100;
  const paid = Math.round(Number(this.paidAmount || 0) * 100) / 100;
  if (this.discount > gross) this.invalidate("discount", "Discount cannot exceed the invoice subtotal");
  if (paid > total) this.invalidate("paidAmount", "Payment cannot exceed the invoice total");
  const openingPaid = Math.round(Number(this.openingPaidAmount || 0) * 100) / 100;
  const ledgerTotal = Math.round((this.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0) * 100) / 100;
  if (openingPaid > paid || Math.abs(openingPaid + ledgerTotal - paid) > 0.009) {
    this.invalidate("payments", "Opening paid amount plus payment ledger must match the paid amount");
  }
  if (this.status === "paid" && paid !== total) this.invalidate("status", "A paid invoice must be fully paid");
  if (this.status === "partial" && !(paid > 0 && paid < total)) {
    this.invalidate("status", "A partial invoice must have a payment between zero and the total");
  }
  next();
});
invoiceSchema.pre("findOneAndUpdate", async function validateInvoiceUpdate() {
  const current = await this.model.findOne(this.getQuery()).lean();
  if (!current) return;
  const update = this.getUpdate() || {};
  const patch = update.$set || update;
  const fail = (message) => { const error = new Error(message); error.statusCode = 400; throw error; };
  const addingPayment = Boolean(update.$push?.payments);
  const protectedFields = ["paidAmount", "openingPaidAmount", "payments"];
  for (const operator of ["$set", "$unset", "$inc", "$mul", "$min", "$max", "$rename", "$setOnInsert"]) {
    const values = update[operator] || {};
    for (const field of protectedFields) {
      if (values[field] !== undefined && !(addingPayment && operator === "$set" && field === "paidAmount")) {
        if (field !== "paidAmount" || !addingPayment) fail("Payment history can only be changed through the payment endpoint");
        if ((field === "openingPaidAmount" && !(addingPayment && operator === "$set")) || field === "payments") fail("Payment history can only be changed through the payment endpoint");
      }
    }
  }
  if (patch.paidAmount !== undefined && Number(patch.paidAmount) !== Number(current.paidAmount || 0) && !addingPayment) {
    fail("Payments must be recorded through the payment endpoint");
  }
  if ((patch.items !== undefined || patch.discount !== undefined) && (current.payments || []).length > 0) {
    fail("Invoice items and discounts cannot be changed after a payment has been recorded");
  }
  const items = patch.items ?? current.items ?? [];
  const discount = Number(patch.discount ?? current.discount ?? 0);
  const paidAmount = Number(patch.paidAmount ?? current.paidAmount ?? 0);
  const status = patch.status ?? current.status;
  const subtotal = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.rate), 0);
  const total = Math.round((subtotal - discount) * 100) / 100;
  const paid = Math.round(paidAmount * 100) / 100;
  if (!Number.isFinite(subtotal) || !Number.isFinite(discount) || discount < 0 || discount > subtotal) fail("Discount must be non-negative and cannot exceed the invoice subtotal");
  if (!Number.isFinite(paid) || paid < 0 || paid > total) fail("Payment must be between zero and the invoice total");
  if (addingPayment) {
    const newAmount = Number(update.$push.payments.amount);
    if (!Number.isFinite(newAmount) || newAmount <= 0 || Math.round(newAmount * 100) !== newAmount * 100) fail("Payment must be a positive amount with at most two decimal places");
    const priorLedger = (current.payments || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const openingPaid = Number(current.openingPaidAmount ?? ((current.payments || []).length ? 0 : current.paidAmount || 0));
    if (Math.abs(Math.round((openingPaid + priorLedger) * 100) / 100 - Math.round(Number(current.paidAmount || 0) * 100) / 100) > 0.009) fail("Existing payment history does not reconcile with the paid amount");
    if (Math.abs(Math.round((openingPaid + priorLedger + newAmount) * 100) / 100 - paid) > 0.009) fail("New payment does not reconcile with the updated paid amount");
    if (Number(update.$set?.openingPaidAmount ?? openingPaid) !== openingPaid) fail("Opening paid amount cannot be changed");
  }
  if (status === "paid" && paid !== total) fail("A paid invoice must be fully paid");
  if (status === "partial" && !(paid > 0 && paid < total)) fail("A partial invoice must have a payment between zero and the total");
});
invoiceSchema.index({ status: 1, createdAt: -1 });
invoiceSchema.index({ patient: 1, createdAt: -1 });
export const Invoice = mongoose.model("Invoice", invoiceSchema);
