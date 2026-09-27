"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  return <button className="ghost-button" type="button" onClick={() => signOut({ callbackUrl: "/admin/login" })}>Sign out</button>;
}
