import { z } from "zod";

const serverSchema = z.object({
  DATABASE_URL: z.string().min(1)
});

export const env = serverSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL
});
