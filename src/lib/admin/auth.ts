import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";

const credentialsSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1).max(200),
});

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/admin/login" },
  providers: [
    CredentialsProvider({
      name: "Staff credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success || bcrypt.truncates(parsed.data.password)) return null;
        const user = await db.user.findUnique({ where: { email: parsed.data.email } });
        if (!user?.passwordHash) {
          await new Promise((resolve) => setTimeout(resolve, 350));
          return null;
        }
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await new Promise((resolve) => setTimeout(resolve, 350));
          return null;
        }
        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) {
          const shouldLock = user.failedLoginCount >= 9;
          await db.user.update({
            where: { id: user.id },
            data: { failedLoginCount: { increment: 1 }, lockedUntil: shouldLock ? new Date(Date.now() + 15 * 60 * 1000) : null },
          });
          return null;
        }
        if (user.role === "BARBER" && !user.barberId) return null;
        await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
        return { id: user.id, email: user.email, role: user.role, barberId: user.barberId };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.role = user.role; token.barberId = user.barberId ?? null; }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = token.role === "ADMIN" ? "ADMIN" : "BARBER";
        session.user.barberId = typeof token.barberId === "string" ? token.barberId : null;
      }
      return session;
    },
  },
};

export async function getStaffSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return {
    userId: session.user.id,
    email: session.user.email ?? "",
    role: session.user.role,
    barberId: session.user.barberId ?? null,
  };
}

export async function requireStaff() {
  const session = await getStaffSession();
  if (!session) redirect("/admin/login");
  return session;
}

export async function getAdminSession() {
  const session = await getStaffSession();
  if (!session || session.role !== "ADMIN") return null;
  return { ...session, role: "ADMIN" as const };
}

export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) redirect("/staff");
  return session;
}
