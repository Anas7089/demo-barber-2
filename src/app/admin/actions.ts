"use server";

import { ExpenseCategory } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { business } from "@/config/business";
import { requireAdmin } from "@/lib/admin/auth";
import { zonedDateTimeToUtc } from "@/lib/admin/date-range";
import { db } from "@/lib/db";

const expenseSchema = z.object({
  category: z.nativeEnum(ExpenseCategory),
  description: z.string().trim().min(2).max(160),
  amount: z.coerce.number().positive().max(1_000_000),
  incurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function createExpenseAction(formData: FormData) {
  await requireAdmin();
  const parsed = expenseSchema.safeParse({
    category: formData.get("category"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    incurredOn: formData.get("incurredOn"),
  });
  if (!parsed.success) redirect("/admin?expenseError=invalid");

  await db.operatingExpense.create({
    data: {
      category: parsed.data.category,
      description: parsed.data.description,
      amountCents: Math.round(parsed.data.amount * 100),
      incurredAt: zonedDateTimeToUtc(parsed.data.incurredOn, "12:00:00", business.timezone),
    },
  });
  revalidatePath("/admin");
  redirect(`/admin?expenseAdded=1`);
}

export async function deleteExpenseAction(formData: FormData) {
  await requireAdmin();
  const id = z.string().cuid().safeParse(formData.get("id"));
  if (!id.success) return;
  await db.operatingExpense.deleteMany({ where: { id: id.data } });
  revalidatePath("/admin");
}

const serviceCostSchema = z.object({
  serviceId: z.string().cuid(),
  cost: z.coerce.number().min(0).max(1_000_000),
});

export async function updateServiceCostAction(formData: FormData) {
  await requireAdmin();
  const parsed = serviceCostSchema.safeParse({ serviceId: formData.get("serviceId"), cost: formData.get("cost") });
  if (!parsed.success) return;
  await db.service.updateMany({ where: { id: parsed.data.serviceId }, data: { costCents: Math.round(parsed.data.cost * 100) } });
  revalidatePath("/admin");
}

const commissionSchema = z.object({
  barberId: z.string().cuid(),
  commissionPercent: z.coerce.number().min(0).max(100),
});

export async function updateBarberCommissionAction(formData: FormData) {
  await requireAdmin();
  const parsed = commissionSchema.safeParse({ barberId: formData.get("barberId"), commissionPercent: formData.get("commissionPercent") });
  if (!parsed.success) return;
  await db.barber.updateMany({ where: { id: parsed.data.barberId }, data: { commissionBps: Math.round(parsed.data.commissionPercent * 100) } });
  revalidatePath("/admin");
}
