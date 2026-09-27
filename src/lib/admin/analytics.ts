import { BookingStatus, PaymentStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { localDateKey, parseAdminRange } from "@/lib/admin/date-range";

const bookingInclude = {
  barber: { select: { id: true, displayName: true } },
  customer: { select: { id: true, name: true, email: true, phoneE164: true } },
  items: { select: { serviceId: true, serviceNameSnapshot: true, priceCents: true, costCents: true, durationMinutes: true } },
} satisfies Prisma.BookingInclude;

const manualSaleInclude = {
  barber: { select: { id: true, displayName: true } },
  createdBy: { select: { id: true, email: true, role: true } },
  items: { select: { serviceId: true, serviceNameSnapshot: true, priceCents: true, costCents: true } },
} satisfies Prisma.ManualSaleInclude;

export type AnalyticsBooking = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;
export type AnalyticsManualSale = Prisma.ManualSaleGetPayload<{ include: typeof manualSaleInclude }>;

type TrendPoint = { key: string; label: string; revenueCents: number; netProfitCents: number; bookings: number; manualSales: number };
type CustomerRow = { id: string; name: string; contact: string; visits: number; spendCents: number };

function addDays(dateKey: string, days: number) {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function shortLabel(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(Date.UTC(y, m - 1, d)));
}

function bookingEconomics(booking: AnalyticsBooking) {
  if (booking.status !== BookingStatus.COMPLETED) {
    const forfeited = booking.paymentStatus === PaymentStatus.FORFEITED ? booking.depositAmountCents ?? 0 : 0;
    return { revenueCents: forfeited, directCostCents: 0, commissionCents: 0, grossProfitCents: forfeited };
  }
  const directCostCents = booking.items.reduce((sum, item) => sum + item.costCents, 0);
  const commissionCents = Math.round((booking.totalPriceCents * booking.barberCommissionBps) / 10_000);
  return {
    revenueCents: booking.totalPriceCents,
    directCostCents,
    commissionCents,
    grossProfitCents: booking.totalPriceCents - directCostCents - commissionCents,
  };
}

function customerKey(email?: string | null, phone?: string | null, fallback?: string | null) {
  const normalizedEmail = email?.trim().toLowerCase();
  if (normalizedEmail) return `email:${normalizedEmail}`;
  const normalizedPhone = phone?.replace(/\s+/g, "").trim();
  if (normalizedPhone) return `phone:${normalizedPhone}`;
  const normalizedName = fallback?.trim().toLowerCase();
  return normalizedName ? `name:${normalizedName}` : null;
}

export async function getAdminAnalytics(from?: string, to?: string) {
  const range = parseAdminRange(from, to);
  const [bookings, manualSales, expenses, newCustomers, serviceSettings, barberSettings] = await Promise.all([
    db.booking.findMany({
      where: { startAt: { gte: range.start, lte: range.end } },
      include: bookingInclude,
      orderBy: { startAt: "desc" },
    }),
    db.manualSale.findMany({
      where: { occurredAt: { gte: range.start, lte: range.end } },
      include: manualSaleInclude,
      orderBy: { occurredAt: "desc" },
    }),
    db.operatingExpense.findMany({ where: { incurredAt: { gte: range.start, lte: range.end } }, orderBy: { incurredAt: "desc" } }),
    db.customer.count({ where: { createdAt: { gte: range.start, lte: range.end } } }),
    db.service.findMany({ select: { id: true, name: true, priceCents: true, costCents: true, isActive: true }, orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }] }),
    db.barber.findMany({ select: { id: true, displayName: true, commissionBps: true, isActive: true }, orderBy: [{ isActive: "desc" }, { displayName: "asc" }] }),
  ]);

  let revenueCents = 0;
  let completedRevenueCents = 0;
  let manualRevenueCents = 0;
  let forfeitedDepositRevenueCents = 0;
  let directCostCents = 0;
  let commissionCents = 0;
  let completed = 0;
  let noShows = 0;
  let cancelled = 0;
  const identifiableCustomers = new Set<string>();
  const serviceMap = new Map<string, { id: string; name: string; bookings: number; revenueCents: number; costCents: number }>();
  const barberMap = new Map<string, { id: string; name: string; bookings: number; appointments: number; manualSales: number; revenueCents: number; directCostCents: number; commissionCents: number }>();
  const customerMap = new Map<string, CustomerRow>();
  const trend = new Map<string, TrendPoint>();

  for (let key = range.from; key <= range.to; key = addDays(key, 1)) {
    trend.set(key, { key, label: shortLabel(key), revenueCents: 0, netProfitCents: 0, bookings: 0, manualSales: 0 });
  }

  for (const booking of bookings) {
    const identifiable = customerKey(booking.customer.email, booking.customer.phoneE164, booking.customer.name) ?? `booking-customer:${booking.customerId}`;
    identifiableCustomers.add(identifiable);
    if (booking.status === BookingStatus.COMPLETED) completed += 1;
    if (booking.status === BookingStatus.NO_SHOW) noShows += 1;
    if (booking.status === BookingStatus.CANCELLED) cancelled += 1;

    const econ = bookingEconomics(booking);
    revenueCents += econ.revenueCents;
    if (booking.status === BookingStatus.COMPLETED) completedRevenueCents += econ.revenueCents;
    else forfeitedDepositRevenueCents += econ.revenueCents;
    directCostCents += econ.directCostCents;
    commissionCents += econ.commissionCents;

    const key = localDateKey(booking.startAt);
    const day = trend.get(key);
    if (day) {
      day.bookings += 1;
      day.revenueCents += econ.revenueCents;
      day.netProfitCents += econ.grossProfitCents;
    }

    if (booking.status === BookingStatus.COMPLETED) {
      for (const item of booking.items) {
        const current = serviceMap.get(item.serviceId) ?? { id: item.serviceId, name: item.serviceNameSnapshot, bookings: 0, revenueCents: 0, costCents: 0 };
        current.bookings += 1;
        current.revenueCents += item.priceCents;
        current.costCents += item.costCents;
        serviceMap.set(item.serviceId, current);
      }
      const barber = barberMap.get(booking.barberId) ?? { id: booking.barberId, name: booking.barber.displayName, bookings: 0, appointments: 0, manualSales: 0, revenueCents: 0, directCostCents: 0, commissionCents: 0 };
      barber.bookings += 1;
      barber.appointments += 1;
      barber.revenueCents += booking.totalPriceCents;
      barber.directCostCents += econ.directCostCents;
      barber.commissionCents += econ.commissionCents;
      barberMap.set(booking.barberId, barber);

      const cKey = customerKey(booking.customer.email, booking.customer.phoneE164, booking.customer.name) ?? `booking-customer:${booking.customerId}`;
      const customer = customerMap.get(cKey) ?? { id: cKey, name: booking.customer.name, contact: booking.customer.email || booking.customer.phoneE164, visits: 0, spendCents: 0 };
      customer.visits += 1;
      customer.spendCents += booking.totalPriceCents;
      customerMap.set(cKey, customer);
    }
  }

  for (const sale of manualSales) {
    const commission = Math.round((sale.totalRevenueCents * sale.barberCommissionBps) / 10_000);
    const gross = sale.totalRevenueCents - sale.directCostCents - commission;
    revenueCents += sale.totalRevenueCents;
    manualRevenueCents += sale.totalRevenueCents;
    directCostCents += sale.directCostCents;
    commissionCents += commission;

    const key = localDateKey(sale.occurredAt);
    const day = trend.get(key);
    if (day) {
      day.manualSales += 1;
      day.revenueCents += sale.totalRevenueCents;
      day.netProfitCents += gross;
    }

    for (const item of sale.items) {
      const mapKey = item.serviceId ?? `manual:${item.serviceNameSnapshot.trim().toLowerCase()}`;
      const current = serviceMap.get(mapKey) ?? { id: mapKey, name: item.serviceNameSnapshot, bookings: 0, revenueCents: 0, costCents: 0 };
      current.bookings += 1;
      current.revenueCents += item.priceCents;
      current.costCents += item.costCents;
      serviceMap.set(mapKey, current);
    }

    const barber = barberMap.get(sale.barberId) ?? { id: sale.barberId, name: sale.barber.displayName, bookings: 0, appointments: 0, manualSales: 0, revenueCents: 0, directCostCents: 0, commissionCents: 0 };
    barber.bookings += 1;
    barber.manualSales += 1;
    barber.revenueCents += sale.totalRevenueCents;
    barber.directCostCents += sale.directCostCents;
    barber.commissionCents += commission;
    barberMap.set(sale.barberId, barber);

    const cKey = customerKey(sale.customerEmail, sale.customerPhone, null) ?? (sale.customerName ? `manual-sale:${sale.id}` : null);
    if (cKey) {
      identifiableCustomers.add(cKey);
      const customer = customerMap.get(cKey) ?? { id: cKey, name: sale.customerName || "Walk-in customer", contact: sale.customerEmail || sale.customerPhone || "Walk-in", visits: 0, spendCents: 0 };
      customer.visits += 1;
      customer.spendCents += sale.totalRevenueCents;
      customerMap.set(cKey, customer);
    }
  }

  const operatingExpenseCents = expenses.reduce((sum, expense) => sum + expense.amountCents, 0);
  for (const expense of expenses) {
    const day = trend.get(localDateKey(expense.incurredAt));
    if (day) day.netProfitCents -= expense.amountCents;
  }

  const grossProfitCents = revenueCents - directCostCents - commissionCents;
  const netProfitCents = grossProfitCents - operatingExpenseCents;
  const attendedBase = completed + noShows;
  const completedTransactions = completed + manualSales.length;

  const services = [...serviceMap.values()]
    .map((s) => ({ ...s, grossProfitCents: s.revenueCents - s.costCents, margin: s.revenueCents ? (s.revenueCents - s.costCents) / s.revenueCents : 0 }))
    .sort((a, b) => b.revenueCents - a.revenueCents);
  const barbers = [...barberMap.values()]
    .map((b) => ({ ...b, contributionCents: b.revenueCents - b.directCostCents - b.commissionCents }))
    .sort((a, b) => b.revenueCents - a.revenueCents);
  const topCustomers = [...customerMap.values()].sort((a, b) => b.spendCents - a.spendCents).slice(0, 20);

  return {
    range,
    bookings,
    manualSales,
    expenses,
    trend: [...trend.values()],
    services,
    barbers,
    topCustomers,
    serviceSettings,
    barberSettings,
    metrics: {
      revenueCents,
      completedRevenueCents,
      manualRevenueCents,
      forfeitedDepositRevenueCents,
      directCostCents,
      commissionCents,
      operatingExpenseCents,
      grossProfitCents,
      netProfitCents,
      totalBookings: bookings.length,
      completedBookings: completed,
      manualSalesCount: manualSales.length,
      completedTransactions,
      cancelledBookings: cancelled,
      noShows,
      noShowRate: attendedBase ? noShows / attendedBase : 0,
      cancellationRate: bookings.length ? cancelled / bookings.length : 0,
      averageTicketCents: completedTransactions ? Math.round((completedRevenueCents + manualRevenueCents) / completedTransactions) : 0,
      uniqueCustomers: identifiableCustomers.size,
      newCustomers,
    },
  };
}
