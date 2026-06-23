// ─── SMS Service ──────────────────────────────────────────────────────
// Supports Twilio for production SMS/WhatsApp, with dev-mode fallback.
// In dev mode, the code is returned in the API response instead of sent via SMS.

interface SmsResult {
  success: boolean;
  devMode?: boolean;
  code?: string;
  message?: string;
  error?: string;
}

export async function sendSmsCode({
  phoneNumber,
  code,
  method = "sms",
}: {
  phoneNumber: string;
  code: string;
  method?: "sms" | "whatsapp";
}): Promise<SmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_SMS_FROM;

  // ─── Dev Mode: no Twilio configured ────────────────────────────────
  if (!accountSid || !authToken || !fromNumber) {
    console.log(
      `[MFA DEV MODE] Code: ${code} | Phone: ${phoneNumber} | Method: ${method}`,
    );
    return {
      success: true,
      devMode: true,
      code,
      message: "Dev mode: code logged to console",
    };
  }

  // ─── Production: send via Twilio ───────────────────────────────────
  try {
    const twilio = (await import("twilio")).default;
    const client = twilio(accountSid, authToken);

    const formattedPhone = phoneNumber.startsWith("+")
      ? phoneNumber
      : `+${phoneNumber}`;
    const sender = fromNumber.startsWith("+") ? fromNumber : `+${fromNumber}`;

    const body = `Your SecurePortal verification code is: ${code}. This code expires in 5 minutes. Do not share it with anyone.`;

    if (method === "whatsapp") {
      await client.messages.create({
        body,
        from: `whatsapp:${sender}`,
        to: `whatsapp:${formattedPhone}`,
      });
    } else {
      await client.messages.create({
        body,
        from: sender,
        to: formattedPhone,
      });
    }

    console.log(`[MFA] ${method.toUpperCase()} code sent to ${formattedPhone}`);
    return {
      success: true,
      message: `Code sent via ${method}`,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[MFA] Failed to send ${method} to ${phoneNumber}:`, error);
    return {
      success: false,
      error,
    };
  }
}

export function generateMfaCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
