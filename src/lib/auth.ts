import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";

declare const process: {
  env: Record<string, string | undefined> & { NODE_ENV?: string };
};

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error"] : [],
  });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Validate required env vars at startup
const required = [
  "BETTER_AUTH_SECRET",
  "MICROSOFT_CLIENT_ID",
  "MICROSOFT_CLIENT_SECRET",
];
const missing = required.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`[AUTH] Missing required env vars: ${missing.join(", ")}`);
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  // ─── Email & Password ──────────────────────────────────────────────
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
    sendResetPassword: async ({ user, url, token }, request) => {
      console.log(`[PASSWORD RESET] To: ${user.email}, URL: ${url}`);
    },
    revokeSessionsOnPasswordReset: true,
  },

  // ─── Social Providers ──────────────────────────────────────────────
  socialProviders: {
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID as string,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET as string,
      tenantId: process.env.MICROSOFT_TENANT_ID || "common",
      authority:
        process.env.MICROSOFT_AUTHORITY || "https://login.microsoftonline.com",
      prompt: "select_account",
    },
  },

  // ─── Session ───────────────────────────────────────────────────────
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },

  // ─── Advanced Security ──────────────────────────────────────────────
  advanced: {
    crossSubDomainCookies: {
      enabled: false,
    },
  },

  // ─── Email Verification ─────────────────────────────────────────────
  emailVerification: {
    sendVerificationEmail: async ({ user, url, token }, request) => {
      console.log(`[EMAIL VERIFICATION] To: ${user.email}, URL: ${url}`);
    },
    autoSignInAfterVerification: true,
  },

  // ─── Account ───────────────────────────────────────────────────────
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["microsoft"],
    },
  },
});

export type Auth = typeof auth;
