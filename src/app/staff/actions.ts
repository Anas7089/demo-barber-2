"use server";

import { PaymentMethod } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { business } from "@/config/business";
import { requireStaff } from "@/lib/admin/auth";
import { zonedDateTimeToUtc } from "@/lib/admin/date-range";
import { db } from "@/lib/db";

const saleSchema = z.object({
  barberId: z.string().cuid().optional(),
  customerName: z.string().trim().max(100).optional(),
  customerEmail: z.union([z.literal(""), z.string().trim().email().max(160)]).optional(),
  customerPhone: z.string().trim().max(40).optional(),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  occurredTime: z.string().regex(/^\d{2}:\d{2}$/),
  paymentMethod: z.nativeEnum(PaymentMethod),
  amountPaid: z.union([z.literal(""), z.coerce.number().positive().max(1_000_000)]).optional(),
  customDescription: z.string().trim().max(120).optional(),
  customAmount: z.union([z.literal(""), z.coerce.number().positive().max(1_000_000)]).optional(),
  customCost: z.union([z.literal(""), z.coerce.number().min(0).max(1_000_000)]).optional(),
  note: z.string().trim().max(500).optional(),
});

function allocatePrices<T extends { priceCents: number }>(items: T[], targetCents: number) {
  const listTotal = items.reduce((sum, item) => sum + item.priceCents, 0);
  if (targetCents === listTotal || !items.length) return items.map((item) => item.priceCents);
  if (listTotal <= 0) {
    const base = Math.floor(targetCents / items.length);
    return items.map((_, index) => index === items.length - 1 ? targetCents - base * (items.length - 1) : base);
  }
  let assigned = 0;
  return items.map((item, index) => {
    if (index === items.length - 1) return targetCents - assigned;
    const value = Math.floor((targetCents * item.priceCents) / listTotal);
    assigned += value;
    return value;
  });
}

export async function createManualSaleAction(formData: FormData) {
  const session = await requireStaff();
  const parsed = saleSchema.safeParse({
    barberId: formData.get("barberId") || undefined,
    customerName: formData.get("customerName") || undefined,
    customerEmail: formData.get("customerEmail") ?? "",
    customerPhone: formData.get("customerPhone") || undefined,
    occurredOn: formData.get("occurredOn"),
    occurredTime: formData.get("occurredTime"),
    paymentMethod: formData.get("paymentMethod"),
    amountPaid: formData.get("amountPaid") ?? "",
    customDescription: formData.get("customDescription") || undefined,
    customAmount: formData.get("customAmount") ?? "",
    customCost: formData.get("customCost") ?? "",
    note: formData.get("note") || undefined,
  });
  const serviceIds = [...new Set(formData.getAll("serviceIds").map(String).filter(Boolean))];
  if (!parsed.success || serviceIds.length > 12) redirect("/staff?error=invalid");

  const barberId = session.role === "BARBER" ? session.barberId : parsed.data.barberId;
  if (!barberId) redirect("/staff?error=barber");

  const [barber, services] = await Promise.all([
    db.barber.findFirst({ where: { id: barberId, isActive: true }, select: { id: true, commissionBps: true } }),
    serviceIds.length ? db.service.findMany({ where: { id: { in: serviceIds }, isActive: true }, select: { id: true, name: true, priceCents: true, costCents: true } }) : Promise.resolve([]),
  ]);
  if (!barber || services.length !== serviceIds.length) redirect("/staff?error=invalid");

  const ordered = serviceIds.map((id) => services.find((service) => service.id === id)!).filter(Boolean);
  const customAmountCents = parsed.data.customAmount === "" || parsed.data.customAmount == null ? 0 : Math.round(Number(parsed.data.customAmount) * 100);
  const customCostCents = parsed.data.customCost === "" || parsed.data.customCost == null ? 0 : Math.round(Number(parsed.data.customCost) * 100);
  const customDescription = parsed.data.customDescription?.trim();
  if ((customAmountCents > 0) !== !!customDescription || (customCostCents > 0 && customAmountCents <= 0)) redirect("/staff?error=custom");

  const baseItems = [
    ...ordered.map((service) => ({ serviceId: service.id, serviceNameSnapshot: service.name, priceCents: service.priceCents, costCents: service.costCents })),
    ...(customAmountCents > 0 && customDescription ? [{ serviceId: null, serviceNameSnapshot: customDescription, priceCents: customAmountCents, costCents: customCostCents }] : []),
  ];
  if (!baseItems.length) redirect("/staff?error=services");

  const listedTotal = baseItems.reduce((sum, item) => sum + item.priceCents, 0);
  const totalRevenueCents = parsed.data.amountPaid === "" || parsed.data.amountPaid == null ? listedTotal : Math.round(Number(parsed.data.amountPaid) * 100);
  if (totalRevenueCents <= 0) redirect("/staff?error=amount");
  const allocated = allocatePrices(baseItems, totalRevenueCents);
  const directCostCents = baseItems.reduce((sum, item) => sum + item.costCents, 0);
  const occurredAt = zonedDateTimeToUtc(parsed.data.occurredOn, `${parsed.data.occurredTime}:00`, business.timezone);
  const now = Date.now();
  if (occurredAt.getTime() > now + 5 * 60 * 1000) redirect("/staff?error=future");
  if (session.role === "BARBER" && occurredAt.getTime() < now - 7 * 24 * 60 * 60 * 1000) redirect("/staff?error=old");

  await db.manualSale.create({
    data: {
      barberId,
      customerName: parsed.data.customerName || null,
      customerEmail: parsed.data.customerEmail || null,
      customerPhone: parsed.data.customerPhone || null,
      occurredAt,
      totalRevenueCents,
      directCostCents,
      barberCommissionBps: barber.commissionBps,
      paymentMethod: parsed.data.paymentMethod,
      note: parsed.data.note || null,
      createdByUserId: session.userId,
      items: {
        create: baseItems.map((item, index) => ({ ...item, priceCents: allocated[index], sortOrder: index })),
      },
    },
  });

  revalidatePath("/staff");
  revalidatePath("/admin");
  redirect("/staff?added=1");
}
