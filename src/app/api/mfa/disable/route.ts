import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ─── POST /api/mfa/disable ────────────────────────────────────────
// Disable MFA for the user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body as { userId?: string };

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        phoneNumber: null,
      },
    });

    // Clean up all MFA codes for this user
    await prisma.mfaCode.deleteMany({
      where: { userId },
    });

    return NextResponse.json({
      success: true,
      message: "MFA has been disabled",
    });
  } catch (err) {
    console.error("[MFA DISABLE ERROR]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}