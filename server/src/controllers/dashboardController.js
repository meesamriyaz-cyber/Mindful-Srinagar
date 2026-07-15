import { Appointment } from "../models/Appointment.js";
import { Invoice } from "../models/Invoice.js";
import { InventoryItem } from "../models/InventoryItem.js";
import { Patient } from "../models/Patient.js";
import { Referral } from "../models/Referral.js";
import { Task } from "../models/Task.js";

function sumInvoiceTotal(invoices) {
  return invoices.reduce((sum, invoice) => {
    const gross = invoice.items.reduce((itemSum, item) => itemSum + item.quantity * item.rate, 0);
    return sum + Math.max(gross - invoice.discount, 0);
  }, 0);
}

function groupCount(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] || "unspecified";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

export async function getDashboard(req, res, next) {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

    const [
      patients,
      activePatients,
      newPatientsThisMonth,
      referrals,
      convertedReferrals,
      referralRecords,
      todaysAppointments,
      completedAppointmentsThisMonth,
      lowStock,
      openTasks,
      invoicesThisMonth,
      unpaidInvoices,
      patientStatusMix,
      serviceDemand
    ] = await Promise.all([
      Patient.countDocuments(),
      Patient.countDocuments({ status: "active" }),
      Patient.countDocuments({ createdAt: { $gte: monthStart } }),
      Referral.countDocuments({ status: { $in: ["new", "contacted", "scheduled"] } }),
      Referral.countDocuments({ status: "converted" }),
      Referral.find({ createdAt: { $gte: monthStart } }).select("sourceType status"),
      Appointment.find({ startsAt: { $gte: todayStart, $lt: todayEnd } })
        .populate("patient", "fullName mrn")
        .populate("practitioner", "name discipline")
        .sort({ startsAt: 1 })
        .limit(12),
      Appointment.countDocuments({ status: "completed", startsAt: { $gte: monthStart } }),
      InventoryItem.find({ $expr: { $lte: ["$quantity", "$reorderLevel"] } }).limit(10),
      Task.find({ status: { $ne: "done" } }).sort({ dueDate: 1 }).limit(10),
      Invoice.find({ createdAt: { $gte: monthStart }, status: { $ne: "void" } }).select("items discount paidAmount status"),
      Invoice.find({ status: { $in: ["draft", "partial"] } }).populate("patient", "fullName mrn").limit(10),
      Patient.find().select("status services"),
      Appointment.aggregate([
        { $match: { startsAt: { $gte: monthStart } } },
        { $group: { _id: "$service", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 6 }
      ])
    ]);

    const revenueThisMonth = invoicesThisMonth.reduce((sum, invoice) => sum + invoice.paidAmount, 0);
    const billedThisMonth = sumInvoiceTotal(invoicesThisMonth);
    const outstanding = unpaidInvoices.reduce((sum, invoice) => {
      const total = sumInvoiceTotal([invoice]);
      return sum + Math.max(total - invoice.paidAmount, 0);
    }, 0);
    const totalReferrals = referrals + convertedReferrals;
    const conversionRate = totalReferrals ? Math.round((convertedReferrals / totalReferrals) * 100) : 0;
    const statusMix = groupCount(patientStatusMix, "status");
    const services = patientStatusMix.flatMap((patient) => patient.services || []);
    const serviceMix = services.reduce((acc, service) => {
      acc[service] = (acc[service] || 0) + 1;
      return acc;
    }, {});
    const referralMix = groupCount(referralRecords, "sourceType");

    res.json({
      metrics: {
        patients,
        activePatients,
        newPatientsThisMonth,
        referrals,
        appointmentsToday: todaysAppointments.length,
        revenueThisMonth,
        billedThisMonth,
        outstanding,
        conversionRate,
        completedAppointmentsThisMonth
      },
      todaysAppointments,
      lowStock,
      openTasks,
      unpaidInvoices,
      analytics: {
        patientStatus: statusMix,
        serviceMix,
        referralMix,
        serviceDemand: serviceDemand.map((item) => ({ service: item._id, count: item.count }))
      }
    });
  } catch (error) {
    next(error);
  }
}
