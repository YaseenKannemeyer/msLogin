import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { generateMfaCode, sendSmsCode } from "@/lib/sms";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ─── POST /api/mfa/setup ──────────────────────────────────────────
// Save phone number, send a test code, and enable MFA after verification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, phoneNumber, method = "sms" } = body as {
      userId?: string;
      phoneNumber?: string;
      method?: "sms" | "whatsapp";
    };

    if (!userId || !phoneNumber) {
      return NextResponse.json({ error: "User ID and phone number are required" }, { status: 400 });
    }

    // Validate phone number (basic: must be 7-15 digits, optionally starting with +)
    const cleaned = phoneNumber.replace(/\D/g, "");
    if (cleaned.length < 7 || cleaned.length > 15) {
      return NextResponse.json(
        { error: "Invalid phone number. Please enter a valid number with country code." },
        { status: 400 }
      );
    }

    const formattedPhone = phoneNumber.startsWith("+") ? phoneNumber : `+${cleaned}`;

    // Generate code
    const code = generateMfaCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Save the phone number and create verification code
    await prisma.user.update({
      where: { id: userId },
      data: { phoneNumber: formattedPhone },
    });

    await prisma.mfaCode.create({
      data: {
        userId,
        code,
        phoneNumber: formattedPhone,
        method,
        expiresAt,
      },
    });

    // Send the code
    const smsResult = await sendSmsCode({
      phoneNumber: formattedPhone,
      code,
      method,
    });

    if (!smsResult.success) {
      // Roll back phone number if send fails
      await prisma.user.update({
        where: { id: userId },
        data: { phoneNumber: null },
      });
      return NextResponse.json(
        { error: `Failed to send verification code: ${smsResult.error || "Unknown error"}` },
        { status: 500 }
      );
    }

    // Mask phone for response
    const digits = formattedPhone.replace(/\D/g, "");
    const maskedPhone = `+${digits[0]}${"*".repeat(digits.length - 5)}${digits.slice(-4)}`;

    return NextResponse.json({
      success: true,
      devMode: smsResult.devMode || false,
      devCode: smsResult.code,
      method,
      maskedPhone,
      expiresIn: 300,
      message: smsResult.devMode
        ? `Dev mode: code is ${smsResult.code}`
        : `Verification code sent to ${maskedPhone} via ${method}`,
    });
  } catch (err) {
    console.error("[MFA SETUP ERROR]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}