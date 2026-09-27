import { redirect } from "next/navigation";
import { business } from "@/config/business";
import { getStaffSession } from "@/lib/admin/auth";
import { LoginForm } from "./login-form";

export default async function AdminLoginPage() {
  const session = await getStaffSession();
  if (session) redirect(session.role === "ADMIN" ? "/admin" : "/staff");
  return (
    <main className="admin-login-shell">
      <section className="admin-login-card">
        <div className="admin-login-brand"><span className="brand-mark">A27</span><div><strong>{business.name}</strong><p>Business console</p></div></div>
        <div><p className="eyebrow">Private area</p><h1>Staff sign in</h1><p className="login-copy">Admins can manage analytics and reports. Barber accounts can quickly record walk-in sales for their own chair.</p></div>
        <LoginForm />
        <p className="login-footnote">Staff sessions expire after 8 hours. Accounts lock for 15 minutes after 10 consecutive failed password attempts.</p>
      </section>
    </main>
  );
}
