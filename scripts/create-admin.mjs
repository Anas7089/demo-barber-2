import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const email = process.argv[2]?.trim().toLowerCase();
const password = process.argv[3];

if (!email || !password) {
  console.error("Usage: npm run admin:create -- admin@example.com 'StrongPasswordHere'");
  process.exit(1);
}
if (password.length < 12 || bcrypt.truncates(password)) {
  console.error("Password must be at least 12 characters and at most 72 UTF-8 bytes.");
  process.exit(1);
}

try {
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: "ADMIN", failedLoginCount: 0, lockedUntil: null },
    create: { email, passwordHash, role: "ADMIN" },
    select: { id: true, email: true, role: true },
  });
  console.log(`Admin ready: ${user.email} (${user.id})`);
} finally {
  await prisma.$disconnect();
}
