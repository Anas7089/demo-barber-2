import { ExpenseCategory } from "@prisma/client";
import { business } from "@/config/business";
import { BarList } from "@/components/admin/bar-list";
import { MetricCard } from "@/components/admin/metric-card";
import { TrendChart } from "@/components/admin/trend-chart";
import { LogoutButton } from "@/components/admin/logout-button";
import { getAdminAnalytics } from "@/lib/admin/analytics";
import { requireAdmin } from "@/lib/admin/auth";
import { formatLocalDateTime, localDateKey } from "@/lib/admin/date-range";
import { money, percent } from "@/lib/admin/format";
import { createExpenseAction, deleteExpenseAction, updateBarberCommissionAction, updateServiceCostAction } from "./actions";

const expenseLabels: Record<ExpenseCategory, string> = {
  RENT: "Rent", UTILITIES: "Utilities", SUPPLIES: "Supplies", MARKETING: "Marketing", SOFTWARE: "Software",
  PAYROLL: "Payroll", TAX: "Tax", INSURANCE: "Insurance", MAINTENANCE: "Maintenance", OTHER: "Other",
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; expenseAdded?: string; expenseError?: string }> }) {
  const session = await requireAdmin();
  const query = await searchParams;
  const data = await getAdminAnalytics(query.from, query.to);
  const { metrics } = data;
  const exportHref = `/api/admin/export?from=${encodeURIComponent(data.range.from)}&to=${encodeURIComponent(data.range.to)}`;

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-brand"><span className="brand-mark">A27</span><div><strong>{business.name}</strong><span>Admin analytics</span></div></div>
        <div className="topbar-actions"><span className="admin-user">{session.email}</span><LogoutButton /></div>
      </header>

      <div className="admin-content">
        <section className="dashboard-heading">
          <div><p className="eyebrow">Business intelligence</p><h1>Performance overview</h1><p>Track sales, profitability, customers, services and barber contribution from real booking data.</p></div>
          <div className="heading-actions">
            <form className="date-filter" method="get">
              <label>From<input name="from" type="date" defaultValue={data.range.from} /></label>
              <label>To<input name="to" type="date" defaultValue={data.range.to} /></label>
              <button className="secondary-button" type="submit">Apply</button>
            </form>
            <a className="secondary-button" href="/staff">Add walk-in sale</a>
            <a className="primary-button excel-button" href={exportHref}>Download Excel</a>
          </div>
        </section>

        <div className="report-period">Reporting period: <strong>{data.range.from}</strong> to <strong>{data.range.to}</strong> · {business.timezone}</div>

        <section className="metric-grid">
          <MetricCard label="Revenue" value={money(metrics.revenueCents)} hint={`${metrics.completedBookings} appointments · ${metrics.manualSalesCount} walk-ins · ${money(metrics.forfeitedDepositRevenueCents)} forfeited deposits`} />
          <MetricCard label="Estimated net profit" value={money(metrics.netProfitCents)} hint="After direct costs, commissions & recorded expenses" />
          <MetricCard label="Gross profit" value={money(metrics.grossProfitCents)} hint={`Direct costs ${money(metrics.directCostCents)}`} />
          <MetricCard label="Average ticket" value={money(metrics.averageTicketCents)} hint="Completed appointments + walk-ins" />
          <MetricCard label="Bookings" value={metrics.totalBookings.toLocaleString("en-GB")} hint={`${metrics.completedBookings} completed · ${metrics.cancelledBookings} cancelled · ${metrics.noShows} no-show`} />
          <MetricCard label="Walk-in sales" value={metrics.manualSalesCount.toLocaleString("en-GB")} hint={`${money(metrics.manualRevenueCents)} recognized revenue`} />
          <MetricCard label="Customers" value={metrics.uniqueCustomers.toLocaleString("en-GB")} hint={`${metrics.newCustomers} newly added`} />
          <MetricCard label="No-show rate" value={percent(metrics.noShowRate)} hint="No-shows / completed + no-show" />
          <MetricCard label="Operating expenses" value={money(metrics.operatingExpenseCents)} hint={`Barber commissions ${money(metrics.commissionCents)}`} />
        </section>

        <section className="dashboard-grid dashboard-grid-wide">
          <TrendChart data={data.trend} currency={business.currency} />
          <BarList eyebrow="Services" title="Revenue by service" rows={data.services.slice(0, 8).map((s) => ({ label: s.name, value: s.revenueCents, secondary: `${s.bookings} sold · margin ${percent(s.margin)}` }))} formatValue={money} />
        </section>

        <section className="dashboard-grid">
          <BarList eyebrow="People" title="Revenue by barber" rows={data.barbers.slice(0, 8).map((barber) => ({ label: barber.name, value: barber.revenueCents, secondary: `${barber.appointments} appointments + ${barber.manualSales} walk-ins · contribution ${money(barber.contributionCents)}` }))} formatValue={money} />
          <BarList eyebrow="Operations" title="Booking outcomes" rows={[
            { label: "Completed", value: data.bookings.filter((b) => b.status === "COMPLETED").length },
            { label: "Confirmed", value: data.bookings.filter((b) => b.status === "CONFIRMED").length },
            { label: "Pending", value: data.bookings.filter((b) => b.status === "PENDING").length },
            { label: "Cancelled", value: data.bookings.filter((b) => b.status === "CANCELLED").length },
            { label: "No-show", value: data.bookings.filter((b) => b.status === "NO_SHOW").length },
          ]} formatValue={(value) => value.toLocaleString("en-GB")} />
        </section>

        <section className="admin-card profit-explainer">
          <div><p className="eyebrow">Profit model</p><h2>How the dashboard calculates profit</h2></div>
          <div className="profit-equation"><span>{money(metrics.revenueCents)}<small>Revenue</small></span><b>−</b><span>{money(metrics.directCostCents)}<small>Service costs</small></span><b>−</b><span>{money(metrics.commissionCents)}<small>Commissions</small></span><b>−</b><span>{money(metrics.operatingExpenseCents)}<small>Expenses</small></span><b>=</b><span className="profit-result">{money(metrics.netProfitCents)}<small>Estimated net profit</small></span></div>
          <p className="subtle">This is a management estimate, not statutory accounting profit. Configure service cost and barber commission values accurately and record shop expenses for useful margins.</p>
        </section>

        <section className="dashboard-grid">
          <div className="admin-card table-card">
            <div className="section-heading"><div><p className="eyebrow">People</p><h2>Barber contribution</h2></div></div>
            <div className="table-scroll"><table><thead><tr><th>Barber</th><th>Jobs</th><th>Revenue</th><th>Commission</th><th>Contribution</th></tr></thead><tbody>
              {data.barbers.length ? data.barbers.map((barber) => <tr key={barber.id}><td><strong>{barber.name}</strong></td><td>{barber.bookings}<small className="table-subtext">{barber.appointments} appt · {barber.manualSales} walk-in</small></td><td>{money(barber.revenueCents)}</td><td>{money(barber.commissionCents)}</td><td><strong>{money(barber.contributionCents)}</strong></td></tr>) : <tr><td colSpan={5} className="empty-cell">No completed bookings yet.</td></tr>}
            </tbody></table></div>
          </div>

          <div className="admin-card table-card">
            <div className="section-heading"><div><p className="eyebrow">Customers</p><h2>Highest-value clients</h2></div></div>
            <div className="table-scroll"><table><thead><tr><th>Customer</th><th>Visits</th><th>Spend</th><th>Avg.</th></tr></thead><tbody>
              {data.topCustomers.length ? data.topCustomers.slice(0, 10).map((customer) => <tr key={customer.id}><td><strong>{customer.name}</strong><small className="table-subtext">{customer.contact}</small></td><td>{customer.visits}</td><td>{money(customer.spendCents)}</td><td>{money(Math.round(customer.spendCents / customer.visits))}</td></tr>) : <tr><td colSpan={4} className="empty-cell">No customer spending data yet.</td></tr>}
            </tbody></table></div>
          </div>
        </section>

        <section className="dashboard-grid">
          <div className="admin-card table-card">
            <div className="section-heading"><div><p className="eyebrow">Profit settings</p><h2>Service direct costs</h2></div><span className="section-meta">Used for historical snapshots on new bookings</span></div>
            <div className="table-scroll"><table><thead><tr><th>Service</th><th>Price</th><th>Direct cost</th><th>Gross margin</th><th /></tr></thead><tbody>
              {data.serviceSettings.length ? data.serviceSettings.map((service) => { const margin = service.priceCents ? (service.priceCents - service.costCents) / service.priceCents : 0; return <tr key={service.id}><td><strong>{service.name}</strong>{!service.isActive ? <small className="table-subtext">Inactive</small> : null}</td><td>{money(service.priceCents)}</td><td><form action={updateServiceCostAction} className="inline-setting-form"><input type="hidden" name="serviceId" value={service.id} /><input aria-label={`Direct cost for ${service.name}`} name="cost" type="number" min="0" step="0.01" defaultValue={(service.costCents / 100).toFixed(2)} /><button className="text-button" type="submit">Save</button></form></td><td>{percent(margin)}</td><td /></tr>; }) : <tr><td colSpan={5} className="empty-cell">Add services to configure costs.</td></tr>}
            </tbody></table></div>
          </div>

          <div className="admin-card table-card">
            <div className="section-heading"><div><p className="eyebrow">Profit settings</p><h2>Barber commissions</h2></div><span className="section-meta">Percentage of completed booking revenue</span></div>
            <div className="table-scroll"><table><thead><tr><th>Barber</th><th>Commission</th><th /></tr></thead><tbody>
              {data.barberSettings.length ? data.barberSettings.map((barber) => <tr key={barber.id}><td><strong>{barber.displayName}</strong>{!barber.isActive ? <small className="table-subtext">Inactive</small> : null}</td><td><form action={updateBarberCommissionAction} className="inline-setting-form"><input type="hidden" name="barberId" value={barber.id} /><input aria-label={`Commission percentage for ${barber.displayName}`} name="commissionPercent" type="number" min="0" max="100" step="0.01" defaultValue={(barber.commissionBps / 100).toFixed(2)} /><span>%</span><button className="text-button" type="submit">Save</button></form></td><td /></tr>) : <tr><td colSpan={3} className="empty-cell">Add barbers to configure commissions.</td></tr>}
            </tbody></table></div>
          </div>
        </section>

        <section className="dashboard-grid">
          <div className="admin-card expense-card">
            <div className="section-heading"><div><p className="eyebrow">Costs</p><h2>Record operating expense</h2></div></div>
            {query.expenseAdded ? <div className="alert alert-success">Expense recorded.</div> : null}
            {query.expenseError ? <div className="alert alert-error">Please check the expense values.</div> : null}
            <form action={createExpenseAction} className="expense-form">
              <label>Category<select name="category" defaultValue="SUPPLIES">{Object.entries(expenseLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              <label>Description<input name="description" maxLength={160} placeholder="e.g. Hair products supplier" required /></label>
              <div className="form-row"><label>Amount ({business.currency})<input name="amount" min="0.01" max="1000000" step="0.01" inputMode="decimal" required /></label><label>Date<input name="incurredOn" type="date" defaultValue={localDateKey(new Date())} required /></label></div>
              <button className="secondary-button" type="submit">Add expense</button>
            </form>
          </div>

          <div className="admin-card table-card">
            <div className="section-heading"><div><p className="eyebrow">Costs</p><h2>Expenses in period</h2></div></div>
            <div className="table-scroll"><table><thead><tr><th>Date</th><th>Expense</th><th>Amount</th><th /></tr></thead><tbody>
              {data.expenses.length ? data.expenses.slice(0, 12).map((expense) => <tr key={expense.id}><td>{formatLocalDateTime(expense.incurredAt).split(",")[0]}</td><td><strong>{expense.description}</strong><small className="table-subtext">{expenseLabels[expense.category]}</small></td><td>{money(expense.amountCents)}</td><td><form action={deleteExpenseAction}><input type="hidden" name="id" value={expense.id} /><button className="text-button danger" type="submit">Delete</button></form></td></tr>) : <tr><td colSpan={4} className="empty-cell">No expenses recorded in this period.</td></tr>}
            </tbody></table></div>
          </div>
        </section>


        <section className="admin-card table-card">
          <div className="section-heading"><div><p className="eyebrow">Walk-ins</p><h2>Recent manual sales</h2></div><span className="section-meta">{data.manualSales.length} in selected period · <a href="/staff">Add another</a></span></div>
          <div className="table-scroll"><table><thead><tr><th>Date</th><th>Customer</th><th>Barber</th><th>Services / work</th><th>Payment</th><th>Revenue</th><th>Entered by</th></tr></thead><tbody>
            {data.manualSales.length ? data.manualSales.slice(0, 20).map((sale) => <tr key={sale.id}><td>{formatLocalDateTime(sale.occurredAt)}</td><td><strong>{sale.customerName || "Walk-in"}</strong><small className="table-subtext">{sale.customerEmail || sale.customerPhone || "Anonymous"}</small></td><td>{sale.barber.displayName}</td><td>{sale.items.map((i) => i.serviceNameSnapshot).join(", ")}</td><td>{sale.paymentMethod.replace("_", " ")}</td><td><strong>{money(sale.totalRevenueCents)}</strong></td><td>{sale.createdBy.email}<small className="table-subtext">{sale.createdBy.role}</small></td></tr>) : <tr><td colSpan={7} className="empty-cell">No walk-in/manual sales in this period.</td></tr>}
          </tbody></table></div>
        </section>

        <section className="admin-card table-card">
          <div className="section-heading"><div><p className="eyebrow">Operations</p><h2>Recent bookings</h2></div><span className="section-meta">Showing {Math.min(data.bookings.length, 20)} of {data.bookings.length}</span></div>
          <div className="table-scroll"><table><thead><tr><th>Date</th><th>Customer</th><th>Barber</th><th>Services</th><th>Status</th><th>Total</th></tr></thead><tbody>
            {data.bookings.length ? data.bookings.slice(0, 20).map((booking) => <tr key={booking.id}><td>{formatLocalDateTime(booking.startAt)}</td><td><strong>{booking.customer.name}</strong><small className="table-subtext">{booking.customer.email}</small></td><td>{booking.barber.displayName}</td><td>{booking.items.map((i) => i.serviceNameSnapshot).join(", ")}</td><td><span className={`status-pill status-${booking.status.toLowerCase()}`}>{booking.status.replace("_", " ")}</span></td><td>{money(booking.totalPriceCents)}</td></tr>) : <tr><td colSpan={6} className="empty-cell">No bookings in this period.</td></tr>}
          </tbody></table></div>
        </section>
      </div>
    </main>
  );
}
