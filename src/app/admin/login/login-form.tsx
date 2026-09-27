"use client";

import { FormEvent, useState } from "react";
import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(false);
    const form = new FormData(event.currentTarget);
    const result = await signIn("credentials", { email: String(form.get("email") ?? ""), password: String(form.get("password") ?? ""), redirect: false, callbackUrl: "/staff" });
    if (!result?.ok) { setError(true); setBusy(false); return; }
    const session = await getSession();
    router.replace(session?.user?.role === "ADMIN" ? "/admin" : "/staff"); router.refresh();
  }
  return <form onSubmit={submit} className="admin-form">{error ? <div className="alert alert-error" role="alert">Email or password is incorrect.</div> : null}<label>Email<input name="email" type="email" autoComplete="username" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label><button className="primary-button" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button></form>;
}
