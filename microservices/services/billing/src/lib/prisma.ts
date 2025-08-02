import { PrismaClient } from "../generated/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    log: ["query", "error", "warn"],
    errorFormat: "pretty",
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

export { prisma };
