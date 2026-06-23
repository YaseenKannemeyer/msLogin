import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { generateMfaCode, sendSmsCode } from "@/lib/sms";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ─── POST /api/mfa/send-code ───────────────────────────────────────
// Send a verification code to the user's phone
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, method = "sms" } = body as { userId?: string; method?: "sms" | "whatsapp" };

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Look up user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phoneNumber: true, mfaEnabled: true, email: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.phoneNumber) {
      return NextResponse.json({ error: "No phone number on file. Please set up MFA first." }, { status: 400 });
    }

    // Rate limit: max 3 codes in 5 minutes
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentCodes = await prisma.mfaCode.count({
      where: {
        userId,
        createdAt: { gte: fiveMinAgo },
      },
    });

    if (recentCodes >= 3) {
      return NextResponse.json(
        { error: "Too many codes requested. Please wait a few minutes before trying again." },
        { status: 429 }
      );
    }

    // Generate code
    const code = generateMfaCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Save code to DB
    await prisma.mfaCode.create({
      data: {
        userId,
        code,
        phoneNumber: user.phoneNumber,
        method,
        expiresAt,
      },
    });

    // Send via SMS/WhatsApp
    const smsResult = await sendSmsCode({
      phoneNumber: user.phoneNumber,
      code,
      method,
    });

    if (!smsResult.success) {
      return NextResponse.json(
        { error: `Failed to send code: ${smsResult.error || "Unknown error"}` },
        { status: 500 }
      );
    }

    // Mask phone for response
    const digits = user.phoneNumber.replace(/\D/g, "");
    let maskedPhone = user.phoneNumber;
    if (digits.length >= 4) {
      maskedPhone = `+${digits[0]}${"*".repeat(digits.length - 5)}${digits.slice(-4)}`;
    }

    return NextResponse.json({
      success: true,
      devMode: smsResult.devMode || false,
      devCode: smsResult.code,     // Only in dev mode
      method,
      maskedPhone,
      expiresIn: 300,              // 5 minutes in seconds
      message: smsResult.devMode
        ? `Dev mode: code is ${smsResult.code}`
        : `Code sent to ${maskedPhone} via ${method}`,
    });
  } catch (err) {
    console.error("[MFA SEND-CODE ERROR]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}