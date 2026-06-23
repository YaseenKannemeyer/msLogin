import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ─── POST /api/mfa/confirm-setup ─────────────────────────────────
// Verifies the setup code and enables MFA for the user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, code } = body as { userId?: string; code?: string };

    if (!userId || !code) {
      return NextResponse.json({ error: "User ID and code are required" }, { status: 400 });
    }

    // Find the most recent valid unverified code
    const mfaRecord = await prisma.mfaCode.findFirst({
      where: {
        userId,
        code,
        verified: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!mfaRecord) {
      const anyRecentCode = await prisma.mfaCode.findFirst({
        where: {
          userId,
          createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!anyRecentCode) {
        return NextResponse.json({ error: "No code was sent. Please request a new code." }, { status: 400 });
      }

      if (anyRecentCode.expiresAt < new Date()) {
        return NextResponse.json({ error: "This code has expired. Please request a new one." }, { status: 400 });
      }

      return NextResponse.json({ error: "Invalid code. Please check and try again." }, { status: 400 });
    }

    // Mark code as verified AND enable MFA
    await prisma.$transaction([
      prisma.mfaCode.update({
        where: { id: mfaRecord.id },
        data: { verified: true },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { mfaEnabled: true },
      }),
    ]);

    // Clean up old codes
    await prisma.mfaCode.deleteMany({
      where: {
        userId,
        verified: false,
        expiresAt: { lt: new Date() },
      },
    });

    return NextResponse.json({
      success: true,
      message: "MFA has been enabled successfully",
      method: mfaRecord.method,
    });
  } catch (err) {
    console.error("[MFA CONFIRM-SETUP ERROR]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}