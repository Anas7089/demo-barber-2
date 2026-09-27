import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const email = process.argv[2]?.trim().toLowerCase();
const password = process.argv[3];
const barberSlug = process.argv[4]?.trim();
if (!email || !password || !barberSlug) { console.error("Usage: npm run staff:create -- barber@example.com 'StrongPasswordHere' barber-slug"); process.exit(1); }
if (password.length < 12 || bcrypt.truncates(password)) { console.error("Password must be at least 12 characters and at most 72 UTF-8 bytes."); process.exit(1); }
try {
  const barber = await prisma.barber.findUnique({ where: { slug: barberSlug }, select: { id: true, displayName: true } });
  if (!barber) throw new Error(`No barber found with slug: ${barberSlug}`);
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "BARBER", barberId: barber.id, failedLoginCount: 0, lockedUntil: null },
    create: { email, passwordHash, role: "BARBER", barberId: barber.id },
    select: { id: true, email: true },
  });
  console.log(`Barber staff account ready: ${user.email} → ${barber.displayName} (${user.id})`);
} finally { await prisma.$disconnect(); }
