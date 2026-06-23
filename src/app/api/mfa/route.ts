import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ─── GET /api/mfa/status ────────────────────────────────────────────
// Check if the current user has MFA enabled
export async function GET(request: NextRequest) {
  try {
    // Get session from Better Auth cookie
    const sessionCookie = request.cookies.get("better-auth.session_token")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await prisma.session.findUnique({
      where: { token: sessionCookie },
      include: { user: { select: { id: true, phoneNumber: true, mfaEnabled: true, email: true, name: true } } },
    });

    if (!session || !session.user) {
      return NextResponse.json({ error: "Session not found" }, { status: 401 });
    }

    // Mask phone number for display
    let maskedPhone: string | null = null;
    if (session.user.phoneNumber) {
      const digits = session.user.phoneNumber.replace(/\D/g, "");
      if (digits.length >= 4) {
        maskedPhone = `+${digits[0]}${"*".repeat(digits.length - 5)}${digits.slice(-4)}`;
      } else {
        maskedPhone = session.user.phoneNumber;
      }
    }

    return NextResponse.json({
      mfaEnabled: session.user.mfaEnabled,
      phoneNumber: session.user.phoneNumber ? maskedPhone : null,
      hasPhoneNumber: !!session.user.phoneNumber,
      email: session.user.email,
      name: session.user.name,
    });
  } catch (err) {
    console.error("[MFA STATUS ERROR]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}