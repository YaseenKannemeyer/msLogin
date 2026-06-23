import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "sqlite",
  }),

  // ─── Email & Password ──────────────────────────────────────────────
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
  },

  // ─── Social Providers ──────────────────────────────────────────────
  socialProviders: {
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID as string,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET as string,
      tenantId: process.env.MICROSOFT_TENANT_ID || "common",
      authority:
        process.env.MICROSOFT_AUTHORITY ||
        "https://login.microsoftonline.com",
      prompt: "select_account",
    },
  },

  // ─── Session ───────────────────────────────────────────────────────
  session: {
    expiresIn: 60 * 60 * 24 * 7,       // 7 days
    updateAge: 60 * 60 * 24,            // 1 day – refreshes session activity
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,                   // cache cookie for 5 minutes
    },
  },

  // ─── Advanced Security ──────────────────────────────────────────────
  advanced: {
    cookieCache: {
      enabled: true,
    },
    crossSubdomainCookies: {
      enabled: false,
    },
  },

  // ─── Email Verification (production-ready) ─────────────────────────
  emailVerification: {
    sendVerificationEmail: async ({ user, url, token }, request) => {
      // In production, replace with your email service (Resend, SendGrid, etc.)
      // Example with Resend:
      // await resend.emails.send({
      //   from: 'noreply@yourdomain.com',
      //   to: user.email,
      //   subject: 'Verify your email address',
      //   html: `<p>Click <a href="${url}">here</a> to verify your email.</p>`,
      // });
      console.log(`[EMAIL VERIFICATION] To: ${user.email}, URL: ${url}`);
    },
    autoSignInAfterVerification: true,
  },

  // ─── Password Reset ────────────────────────────────────────────────
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url, token }, request) => {
      // In production, replace with your email service
      console.log(`[PASSWORD RESET] To: ${user.email}, URL: ${url}`);
    },
    revokeSessionsOnPasswordReset: true,
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
