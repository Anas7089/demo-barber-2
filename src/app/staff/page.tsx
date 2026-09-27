import { PaymentMethod } from "@prisma/client";
import { business } from "@/config/business";
import { LogoutButton } from "@/components/admin/logout-button";
import { requireStaff } from "@/lib/admin/auth";
import { formatLocalDateTime, localDateKey, localTimeKey } from "@/lib/admin/date-range";
import { money } from "@/lib/admin/format";
import { db } from "@/lib/db";
import { createManualSaleAction } from "./actions";

const paymentLabels: Record<PaymentMethod, string> = { CASH: "Cash", CARD: "Card", BANK_TRANSFER: "Bank transfer", MOBILE: "Mobile payment", OTHER: "Other" };

export default async function StaffSalesPage({ searchParams }: { searchParams: Promise<{ added?: string; error?: string }> }) {
  const session = await requireStaff();
  const query = await searchParams;
  const now = new Date();
  const [services, barbers, recentSales] = await Promise.all([
    db.service.findMany({ where: { isActive: true }, select: { id: true, name: true, priceCents: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    session.role === "ADMIN" ? db.barber.findMany({ where: { isActive: true }, select: { id: true, displayName: true }, orderBy: { displayName: "asc" } }) : db.barber.findMany({ where: { id: session.barberId ?? "" }, select: { id: true, displayName: true } }),
    db.manualSale.findMany({
      where: session.role === "BARBER" ? { barberId: session.barberId ?? "__none__" } : undefined,
      include: { barber: { select: { displayName: true } }, items: { select: { serviceNameSnapshot: true } } },
      orderBy: { occurredAt: "desc" },
      take: 12,
    }),
  ]);
  const currentBarber = barbers[0];

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-brand"><span className="brand-mark">A27</span><div><strong>{business.name}</strong><span>Walk-in sales</span></div></div>
        <div className="topbar-actions">{session.role === "ADMIN" ? <a className="ghost-button" href="/admin">Analytics</a> : null}<span className="admin-user">{session.email}</span><LogoutButton /></div>
      </header>
      <div className="admin-content staff-content">
        <section className="dashboard-heading">
          <div><p className="eyebrow">Fast counter entry</p><h1>Add walk-in sale</h1><p>Use this when a customer comes without an online appointment. The sale goes directly into revenue, profit, barber performance and Excel reporting without creating a calendar booking.</p></div>
        </section>

        {query.added ? <div className="alert alert-success" role="status">Walk-in sale added successfully.</div> : null}
        {query.error ? <div className="alert alert-error" role="alert">Could not add the sale. Check the barber, services, amounts and date/time, then try again.</div> : null}

        <section className="dashboard-grid walkin-grid">
          <div className="admin-card expense-card">
            <div className="section-heading"><div><p className="eyebrow">Sale details</p><h2>What did the customer have done?</h2></div><span className="section-meta">{session.role === "BARBER" ? `Recording for ${currentBarber?.displayName ?? "your barber account"}` : "Admin entry"}</span></div>
            <form action={createManualSaleAction} className="expense-form walkin-form">
              {session.role === "ADMIN" ? <label>Barber<select name="barberId" required defaultValue=""><option value="" disabled>Select barber</option>{barbers.map((barber) => <option key={barber.id} value={barber.id}>{barber.displayName}</option>)}</select></label> : <input type="hidden" name="barberId" value={currentBarber?.id ?? ""} />}

              <fieldset className="service-picker"><legend>Services performed</legend>{services.length ? services.map((service) => <label key={service.id} className="service-choice"><input type="checkbox" name="serviceIds" value={service.id} /><span><strong>{service.name}</strong><small>{money(service.priceCents)}</small></span></label>) : <p className="subtle">No active services are configured yet. You can use the custom service fields below.</p>}</fieldset>

              <div className="form-row"><label>Custom/other work<input name="customDescription" placeholder="e.g. Product / special styling" maxLength={120} /></label><label>Custom amount ({business.currency})<input name="customAmount" type="number" min="0.01" max="1000000" step="0.01" inputMode="decimal" placeholder="0.00" /></label></div>
              <label>Custom direct cost ({business.currency}) <span className="label-note">optional, for products/materials used</span><input name="customCost" type="number" min="0" max="1000000" step="0.01" inputMode="decimal" placeholder="0.00" /></label>
              <label>Actual amount paid ({business.currency}) <span className="label-note">optional — leave blank to use service prices</span><input name="amountPaid" type="number" min="0.01" max="1000000" step="0.01" inputMode="decimal" placeholder="Uses selected service total" /></label>

              <div className="form-row"><label>Date<input name="occurredOn" type="date" defaultValue={localDateKey(now)} required /></label><label>Time<input name="occurredTime" type="time" defaultValue={localTimeKey(now)} required /></label></div>
              <label>Payment method<select name="paymentMethod" defaultValue="CASH">{Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>

              <div className="section-divider"><span>Customer details</span><small>Optional for anonymous walk-ins</small></div>
              <label>Customer name<input name="customerName" maxLength={100} placeholder="Optional" autoComplete="name" /></label>
              <div className="form-row"><label>Email<input name="customerEmail" type="email" maxLength={160} placeholder="Optional" autoComplete="email" /></label><label>Phone<input name="customerPhone" maxLength={40} placeholder="Optional" autoComplete="tel" /></label></div>
              <label>Note<textarea name="note" maxLength={500} rows={3} placeholder="Optional note about the service or payment" /></label>
              <button className="primary-button" type="submit">Add sale to revenue</button>
            </form>
          </div>

          <div className="admin-card table-card">
            <div className="section-heading"><div><p className="eyebrow">Recent</p><h2>{session.role === "BARBER" ? "Your manual sales" : "Latest manual sales"}</h2></div></div>
            <div className="table-scroll"><table><thead><tr><th>Date</th><th>Customer</th><th>Barber</th><th>Work</th><th>Paid</th></tr></thead><tbody>
              {recentSales.length ? recentSales.map((sale) => <tr key={sale.id}><td>{formatLocalDateTime(sale.occurredAt)}</td><td><strong>{sale.customerName || "Walk-in"}</strong></td><td>{sale.barber.displayName}</td><td>{sale.items.map((item) => item.serviceNameSnapshot).join(", ")}</td><td><strong>{money(sale.totalRevenueCents)}</strong></td></tr>) : <tr><td className="empty-cell" colSpan={5}>No manual sales recorded yet.</td></tr>}
            </tbody></table></div>
          </div>
        </section>
      </div>
    </main>
  );
}
