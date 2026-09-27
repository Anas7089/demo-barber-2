import ExcelJS from "@ayocore/exceljs";
import { NextRequest } from "next/server";
import { business } from "@/config/business";
import { getAdminAnalytics } from "@/lib/admin/analytics";
import { getAdminSession } from "@/lib/admin/auth";
import { formatLocalDateTime } from "@/lib/admin/date-range";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const moneyFormat = '#,##0.00';

function safeText(value: string | null | undefined) {
  const text = value ?? "";
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function styleSheet(sheet: ExcelJS.Worksheet) {
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF171717" } };
  header.alignment = { vertical: "middle" };
  header.height = 22;
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: Math.max(1, sheet.columnCount) } };
  sheet.columns.forEach((column) => {
    let max = 12;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const len = String(cell.value ?? "").length;
      max = Math.min(42, Math.max(max, len + 2));
    });
    column.width = max;
  });
}

export async function GET(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const data = await getAdminAnalytics(url.searchParams.get("from") ?? undefined, url.searchParams.get("to") ?? undefined);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = business.name;
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.properties.date1904 = false;

  const summary = workbook.addWorksheet("Summary");
  summary.addRow(["Metric", "Value"]);
  const summaryRows: Array<[string, string | number, "money" | "percent" | undefined]> = [
    ["Business", safeText(business.name), undefined],
    ["Period from", data.range.from, undefined],
    ["Period to", data.range.to, undefined],
    ["Timezone", business.timezone, undefined],
    ["Currency", business.currency, undefined],
    ["Revenue", data.metrics.revenueCents / 100, "money"],
    ["Completed-appointment revenue", data.metrics.completedRevenueCents / 100, "money"],
    ["Walk-in/manual-sale revenue", data.metrics.manualRevenueCents / 100, "money"],
    ["Forfeited-deposit revenue", data.metrics.forfeitedDepositRevenueCents / 100, "money"],
    ["Direct service costs", data.metrics.directCostCents / 100, "money"],
    ["Barber commissions", data.metrics.commissionCents / 100, "money"],
    ["Operating expenses", data.metrics.operatingExpenseCents / 100, "money"],
    ["Gross profit", data.metrics.grossProfitCents / 100, "money"],
    ["Estimated net profit", data.metrics.netProfitCents / 100, "money"],
    ["Total bookings", data.metrics.totalBookings, undefined],
    ["Completed appointments", data.metrics.completedBookings, undefined],
    ["Walk-in/manual sales", data.metrics.manualSalesCount, undefined],
    ["Cancelled bookings", data.metrics.cancelledBookings, undefined],
    ["No-shows", data.metrics.noShows, undefined],
    ["No-show rate", data.metrics.noShowRate, "percent"],
    ["Average ticket", data.metrics.averageTicketCents / 100, "money"],
    ["Identifiable customers", data.metrics.uniqueCustomers, undefined],
    ["New registered customers", data.metrics.newCustomers, undefined],
  ];
  summaryRows.forEach(([label, value, format]) => {
    const row = summary.addRow([label, value]);
    if (format === "money") row.getCell(2).numFmt = moneyFormat;
    if (format === "percent") row.getCell(2).numFmt = "0.0%";
  });
  styleSheet(summary);

  const bookings = workbook.addWorksheet("Bookings");
  bookings.addRow(["Booking ID", "Date/time", "Customer", "Email", "Phone", "Barber", "Services", "Status", "Payment status", "Duration (min)", `Total (${business.currency})`, `Direct cost (${business.currency})`, `Commission (${business.currency})`, `Contribution (${business.currency})`]);
  for (const booking of data.bookings) {
    const directCost = booking.items.reduce((sum, item) => sum + item.costCents, 0);
    const commission = booking.status === "COMPLETED" ? Math.round((booking.totalPriceCents * booking.barberCommissionBps) / 10_000) : 0;
    const revenue = booking.status === "COMPLETED" ? booking.totalPriceCents : booking.paymentStatus === "FORFEITED" ? booking.depositAmountCents ?? 0 : 0;
    bookings.addRow([
      booking.publicId, formatLocalDateTime(booking.startAt), safeText(booking.customer.name), safeText(booking.customer.email), safeText(booking.customer.phoneE164), safeText(booking.barber.displayName),
      safeText(booking.items.map((item) => item.serviceNameSnapshot).join(", ")), booking.status, booking.paymentStatus, booking.totalDurationMinutes,
      booking.totalPriceCents / 100, directCost / 100, commission / 100, (revenue - directCost - commission) / 100,
    ]);
  }
  styleSheet(bookings);
  [11, 12, 13, 14].forEach((column) => { bookings.getColumn(column).numFmt = moneyFormat; });

  const walkIns = workbook.addWorksheet("Walk-in Sales");
  walkIns.addRow(["Sale ID", "Date/time", "Customer", "Email", "Phone", "Barber", "Services / work", "Payment method", `Revenue (${business.currency})`, `Direct cost (${business.currency})`, `Commission (${business.currency})`, `Contribution (${business.currency})`, "Entered by", "Entered by role", "Note"]);
  for (const sale of data.manualSales) {
    const commission = Math.round((sale.totalRevenueCents * sale.barberCommissionBps) / 10_000);
    walkIns.addRow([
      sale.id, formatLocalDateTime(sale.occurredAt), safeText(sale.customerName || "Walk-in"), safeText(sale.customerEmail), safeText(sale.customerPhone), safeText(sale.barber.displayName),
      safeText(sale.items.map((item) => item.serviceNameSnapshot).join(", ")), sale.paymentMethod, sale.totalRevenueCents / 100, sale.directCostCents / 100, commission / 100,
      (sale.totalRevenueCents - sale.directCostCents - commission) / 100, safeText(sale.createdBy.email), sale.createdBy.role, safeText(sale.note),
    ]);
  }
  styleSheet(walkIns);
  [9, 10, 11, 12].forEach((column) => { walkIns.getColumn(column).numFmt = moneyFormat; });

  const services = workbook.addWorksheet("Services");
  services.addRow(["Service", "Times sold", `Revenue (${business.currency})`, `Direct cost (${business.currency})`, `Gross profit (${business.currency})`, "Gross margin"]);
  data.services.forEach((service) => services.addRow([safeText(service.name), service.bookings, service.revenueCents / 100, service.costCents / 100, service.grossProfitCents / 100, service.margin]));
  styleSheet(services);
  [3, 4, 5].forEach((column) => { services.getColumn(column).numFmt = moneyFormat; });
  services.getColumn(6).numFmt = "0.0%";

  const barbers = workbook.addWorksheet("Barbers");
  barbers.addRow(["Barber", "Total jobs", "Completed appointments", "Walk-in sales", `Revenue (${business.currency})`, `Direct cost (${business.currency})`, `Commission (${business.currency})`, `Contribution (${business.currency})`]);
  data.barbers.forEach((barber) => barbers.addRow([safeText(barber.name), barber.bookings, barber.appointments, barber.manualSales, barber.revenueCents / 100, barber.directCostCents / 100, barber.commissionCents / 100, barber.contributionCents / 100]));
  styleSheet(barbers);
  [5, 6, 7, 8].forEach((column) => { barbers.getColumn(column).numFmt = moneyFormat; });

  const customers = workbook.addWorksheet("Customers");
  customers.addRow(["Customer", "Contact", "Visits", `Spend (${business.currency})`, `Average ticket (${business.currency})`]);
  data.topCustomers.forEach((customer) => customers.addRow([safeText(customer.name), safeText(customer.contact), customer.visits, customer.spendCents / 100, customer.visits ? customer.spendCents / customer.visits / 100 : 0]));
  styleSheet(customers);
  [4, 5].forEach((column) => { customers.getColumn(column).numFmt = moneyFormat; });

  const expenses = workbook.addWorksheet("Expenses");
  expenses.addRow(["Date", "Category", "Description", `Amount (${business.currency})`]);
  data.expenses.forEach((expense) => expenses.addRow([formatLocalDateTime(expense.incurredAt), expense.category, safeText(expense.description), expense.amountCents / 100]));
  styleSheet(expenses);
  expenses.getColumn(4).numFmt = moneyFormat;

  const trend = workbook.addWorksheet("Daily Trend");
  trend.addRow(["Date", `Revenue (${business.currency})`, `Estimated net profit (${business.currency})`, "Bookings", "Walk-in sales"]);
  data.trend.forEach((point) => trend.addRow([point.key, point.revenueCents / 100, point.netProfitCents / 100, point.bookings, point.manualSales]));
  styleSheet(trend);
  [2, 3].forEach((column) => { trend.getColumn(column).numFmt = moneyFormat; });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `barbershop-report-${data.range.from}-to-${data.range.to}.xlsx`;
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
