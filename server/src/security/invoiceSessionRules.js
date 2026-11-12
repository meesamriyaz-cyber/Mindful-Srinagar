import mongoose from "mongoose";

export function validateInvoiceAppointmentItems(items) {
  if (!Array.isArray(items)) return "Invoice items must be a list";
  for (const item of items) {
    if (item?.appointment && !mongoose.isValidObjectId(item.appointment)) {
      return "Each linked session must reference a valid appointment";
    }
  }
  return null;
}

export function getInvoiceAppointmentIds(items = []) {
  return [...new Set(items.map((item) => item?.appointment ? String(item.appointment) : null).filter(Boolean))];
}
