export { PrismaClient } from "@prisma/client";

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export const isUniqueConstraintError = (e: unknown): boolean =>
  e instanceof Error && "code" in e && (e as { code?: string }).code === "P2002";