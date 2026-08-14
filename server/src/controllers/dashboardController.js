import { Appointment } from "../models/Appointment.js";
import { Invoice } from "../models/Invoice.js";
import { InventoryItem } from "../models/InventoryItem.js";
import { Patient } from "../models/Patient.js";
import { Referral } from "../models/Referral.js";
import { Task } from "../models/Task.js";

const openReferralStatuses = ["new", "contacted", "scheduled"];

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

function groupAggregation(items) {
  return items.reduce((acc, item) => {
    acc[item._id || "unspecified"] = item.count;
    return acc;
  }, {});
}

function buildBusinessInsights({ outstanding, lowStockCount, overdueTasksCount, urgentReferralsCount, serviceDemand }) {
  const topService = serviceDemand[0]?._id;
  return [
    outstanding > 0
      ? "Focus collections on draft and partial invoices before month close."
      : "Collections are clean for now; keep invoice posting current.",
    lowStockCount > 0
      ? `${lowStockCount} inventory item(s) are at or below reorder level.`
      : "No low-stock alerts are currently blocking therapy sessions.",
    overdueTasksCount > 0
      ? `${overdueTasksCount} overdue task(s) need ownership today.`
      : "No overdue internal tasks are visible.",
    urgentReferralsCount > 0
      ? `${urgentReferralsCount} urgent referral(s) should be contacted first.`
      : "Urgent referral queue is clear.",
    topService
      ? `${topService} is the highest-demand service this month; protect staffing and room availability.`
      : "Service demand will appear after monthly appointments are scheduled."
  ];
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
      serviceDemand,
      monthlyReferralStatus,
      todaysAppointmentStatus,
      overdueTasks,
      urgentReferrals,
      lowStockCount
    ] = await Promise.all([
      Patient.countDocuments(),
      Patient.countDocuments({ status: "active" }),
      Patient.countDocuments({ createdAt: { $gte: monthStart } }),
      Referral.countDocuments({ status: { $in: openReferralStatuses } }),
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
      Invoice.find({ status: { $in: ["draft", "partial"] } })
        .populate("patient", "fullName mrn")
        .sort({ createdAt: -1 })
        .limit(10),
      Patient.find().select("status services"),
      Appointment.aggregate([
        { $match: { startsAt: { $gte: monthStart } } },
        { $group: { _id: "$service", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 6 }
      ]),
      Referral.aggregate([
        { $match: { createdAt: { $gte: monthStart } } },
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]),
      Appointment.aggregate([
        { $match: { startsAt: { $gte: todayStart, $lt: todayEnd } } },
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]),
      Task.find({ status: { $ne: "done" }, dueDate: { $lt: todayStart } }).sort({ dueDate: 1 }).limit(8),
      Referral.find({ status: { $in: ["new", "contacted"] }, urgency: "urgent" })
        .sort({ createdAt: 1 })
        .limit(8),
      InventoryItem.countDocuments({ $expr: { $lte: ["$quantity", "$reorderLevel"] } })
    ]);

    const revenueThisMonth = invoicesThisMonth.reduce((sum, invoice) => sum + invoice.paidAmount, 0);
    const billedThisMonth = sumInvoiceTotal(invoicesThisMonth);
    const outstanding = unpaidInvoices.reduce((sum, invoice) => {
      const total = sumInvoiceTotal([invoice]);
      return sum + Math.max(total - invoice.paidAmount, 0);
    }, 0);
    const referralStatus = groupAggregation(monthlyReferralStatus);
    const appointmentStatusToday = groupAggregation(todaysAppointmentStatus);
    const monthlyReferrals = Object.values(referralStatus).reduce((sum, count) => sum + count, 0);
    const monthlyConvertedReferrals = referralStatus.converted || 0;
    const conversionRate = monthlyReferrals ? Math.round((monthlyConvertedReferrals / monthlyReferrals) * 100) : 0;
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
        convertedReferrals,
        monthlyReferrals,
        appointmentsToday: todaysAppointments.length,
        checkedInToday: appointmentStatusToday["checked-in"] || 0,
        completedAppointmentsToday: appointmentStatusToday.completed || 0,
        noShowsToday: appointmentStatusToday["no-show"] || 0,
        revenueThisMonth,
        billedThisMonth,
        outstanding,
        unpaidInvoiceCount: unpaidInvoices.length,
        lowStockCount,
        overdueTasks: overdueTasks.length,
        urgentReferrals: urgentReferrals.length,
        conversionRate,
        completedAppointmentsThisMonth
      },
      todaysAppointments,
      lowStock,
      openTasks,
      overdueTasks,
      urgentReferrals,
      unpaidInvoices,
      businessInsights: buildBusinessInsights({
        outstanding,
        lowStockCount,
        overdueTasksCount: overdueTasks.length,
        urgentReferralsCount: urgentReferrals.length,
        serviceDemand
      }),
      analytics: {
        patientStatus: statusMix,
        serviceMix,
        referralMix,
        referralStatus,
        appointmentStatusToday,
        serviceDemand: serviceDemand.map((item) => ({ service: item._id, count: item.count }))
      }
    });
  } catch (error) {
    next(error);
  }
}
