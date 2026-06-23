"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp";

// ─── Types ─────────────────────────────────────────────────────────
interface MfaVerifyProps {
  userId: string;
  userEmail: string;
  userName?: string;
  userImage?: string | null;
  onVerified: () => void;
  onCancel: () => void;
}

interface MfaSetupProps {
  userId: string;
  onEnabled: () => void;
  onCancel: () => void;
}

interface MfaManageProps {
  userId: string;
  mfaEnabled: boolean;
  hasPhoneNumber: boolean;
  phoneNumber?: string | null;
  onMfaChanged: () => void;
}

// ═══════════════════════════════════════════════════════════════════
//  MFA VERIFICATION PAGE  (Microsoft-style "Enter code" screen)
// ═══════════════════════════════════════════════════════════════════
export function MfaVerifyPage({
  userId,
  userEmail,
  userName,
  userImage,
  onVerified,
  onCancel,
}: MfaVerifyProps) {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [error, setError] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [method, setMethod] = useState<"sms" | "whatsapp">("sms");
  const [countdown, setCountdown] = useState(0);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [showMethods, setShowMethods] = useState(false);
  const otpRef = useRef<HTMLInputElement>(null);

  // Send initial code on mount
  useEffect(() => {
    sendCode("sms");
  }, []);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const sendCode = useCallback(async (m?: "sms" | "whatsapp") => {
    setError("");
    setSendingCode(true);
    setDevCode(null);
    const useMethod = m || method;
    try {
      const res = await fetch("/api/mfa/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, method: useMethod }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to send code");
        return;
      }
      setMaskedPhone(data.maskedPhone);
      setMethod(useMethod);
      setCountdown(60); // 60 second cooldown before resend
      if (data.devMode && data.devCode) {
        setDevCode(data.devCode);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSendingCode(false);
    }
  }, [userId, method]);

  const handleVerify = async () => {
    if (otp.length !== 6) {
      setError("Please enter the full 6-digit code.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/mfa/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, code: otp }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Verification failed");
        return;
      }

      onVerified();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleMethodSwitch = (newMethod: "sms" | "whatsapp") => {
    setOtp("");
    setMethod(newMethod);
    setShowMethods(false);
    sendCode(newMethod);
  };

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Top Bar */}
      <nav className="border-b border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* Microsoft-style 4-color logo */}
            <svg className="h-6 w-6" viewBox="0 0 21 21" fill="none">
              <rect x="1" y="1" width="9" height="9" fill="#f25022" />
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
              <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
              <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
            </svg>
            <span className="font-semibold text-slate-900 dark:text-white">SecurePortal</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400"
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Identity Header */}
          <div className="flex items-center gap-3 mb-6">
            <svg className="h-6 w-6" viewBox="0 0 21 21" fill="none">
              <rect x="1" y="1" width="9" height="9" fill="#f25022" />
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
              <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
              <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
            </svg>
            <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{userEmail}</span>
          </div>

          <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg shadow-slate-200/30 dark:shadow-slate-900/30">
            <CardHeader className="text-left pb-2">
              <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white">
                Enter code
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400 text-base">
                {maskedPhone
                  ? `We sent a code to your phone ${maskedPhone}. Please enter the code to sign in.`
                  : "Sending verification code..."}
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-4 space-y-5">
              {/* Error Alert */}
              {error && (
                <Alert variant="destructive" className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50">
                  <AlertDescription className="text-red-700 dark:text-red-300 text-sm">{error}</AlertDescription>
                </Alert>
              )}

              {/* Dev Mode Notice */}
              {devCode && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 p-3">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Dev Mode — No SMS service configured</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    Your verification code is: <span className="font-mono font-bold text-lg">{devCode}</span>
                  </p>
                </div>
              )}

              {/* OTP Input */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Code</Label>
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={setOtp}
                  onComplete={handleVerify}
                  disabled={loading}
                  render={({ slots }) => (
                    <InputOTPGroup>
                      {slots.map((slot, i) => (
                        <InputOTPSlot key={i} {...slot} index={i} className="h-12 w-12 text-lg font-semibold" />
                      ))}
                    </InputOTPGroup>
                  )}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Enter the 6-digit code sent to your phone
                </p>
              </div>

              {/* Verify Button */}
              <Button
                onClick={handleVerify}
                disabled={loading || otp.length !== 6}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium shadow-sm transition-all duration-200"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Verifying...</span>
                  </div>
                ) : (
                  "Verify"
                )}
              </Button>

              {/* Resend / Method options */}
              <div className="space-y-2 pt-2">
                {countdown > 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Resend code in <span className="font-medium text-slate-700 dark:text-slate-300">{formatCountdown(countdown)}</span>
                  </p>
                ) : (
                  <button
                    onClick={() => sendCode()}
                    disabled={sendingCode}
                    className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors disabled:opacity-50"
                  >
                    {sendingCode ? "Sending..." : "Send a new code"}
                  </button>
                )}

                <div className="pt-1">
                  <span className="text-sm text-slate-600 dark:text-slate-400">Having trouble? </span>
                  <button
                    onClick={() => setShowMethods(!showMethods)}
                    className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Sign in another way
                  </button>
                </div>

                {/* Alternative Methods Panel */}
                {showMethods && (
                  <div className="mt-3 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-3">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Choose a different verification method</p>

                    {method !== "sms" && (
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-3 h-auto py-3"
                        onClick={() => handleMethodSwitch("sms")}
                        disabled={sendingCode}
                      >
                        <svg className="h-5 w-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <div className="text-left">
                          <p className="text-sm font-medium text-slate-900 dark:text-white">Text message (SMS)</p>
                          <p className="text-xs text-slate-500">Get a code via text</p>
                        </div>
                      </Button>
                    )}

                    {method !== "whatsapp" && (
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-3 h-auto py-3"
                        onClick={() => handleMethodSwitch("whatsapp")}
                        disabled={sendingCode}
                      >
                        <svg className="h-5 w-5 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                        <div className="text-left">
                          <p className="text-sm font-medium text-slate-900 dark:text-white">WhatsApp</p>
                          <p className="text-xs text-slate-500">Get a code via WhatsApp</p>
                        </div>
                      </Button>
                    )}

                    <button
                      onClick={onCancel}
                      className="w-full text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors text-center py-1"
                    >
                      Cancel and sign in again
                    </button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="mt-6 text-center">
            <button className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
              More information
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  MFA SETUP DIALOG  (from dashboard)
// ═══════════════════════════════════════════════════════════════════
export function MfaSetupDialog({
  userId,
  onEnabled,
  onCancel,
}: MfaSetupProps) {
  const [step, setStep] = useState<"phone" | "verify">("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [method, setMethod] = useState<"sms" | "whatsapp">("sms");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [devCode, setDevCode] = useState<string | null>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendCode = async () => {
    setError("");
    if (!phoneNumber.trim()) {
      setError("Please enter a phone number with country code (e.g., +27821234567)");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/mfa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, phoneNumber: phoneNumber.trim(), method }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to send code");
        return;
      }

      setMaskedPhone(data.maskedPhone);
      setStep("verify");
      setCountdown(60);
      if (data.devMode && data.devCode) {
        setDevCode(data.devCode);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSetup = async () => {
    if (otp.length !== 6) {
      setError("Please enter the full 6-digit code.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/mfa/confirm-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, code: otp }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Verification failed");
        return;
      }

      onEnabled();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/mfa/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, method }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to resend code");
        return;
      }
      setCountdown(60);
      if (data.devMode && data.devCode) setDevCode(data.devCode);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog open onOpenChange={() => onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "phone" ? "Set up two-step verification" : "Verify your phone number"}
          </DialogTitle>
          <DialogDescription>
            {step === "phone"
              ? "Add a phone number to receive verification codes during sign-in."
              : `We sent a code to ${maskedPhone}. Enter it below to confirm.`}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="border-red-200 bg-red-50">
            <AlertDescription className="text-red-700 text-sm">{error}</AlertDescription>
          </Alert>
        )}

        {devCode && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
            <p className="text-sm font-medium text-amber-800">Dev Mode</p>
            <p className="text-sm text-amber-700 mt-1">
              Your code is: <span className="font-mono font-bold text-lg">{devCode}</span>
            </p>
          </div>
        )}

        {step === "phone" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Phone number</Label>
              <Input
                type="tel"
                placeholder="+27821234567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={loading}
                className="h-11"
              />
              <p className="text-xs text-slate-500">Include your country code (e.g., +27 for South Africa)</p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Delivery method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as "sms" | "whatsapp")}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sms">
                    <div className="flex items-center gap-2">
                      <span>📱</span> Text message (SMS)
                    </div>
                  </SelectItem>
                  <SelectItem value="whatsapp">
                    <div className="flex items-center gap-2">
                      <span>💬</span> WhatsApp
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={onCancel}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={handleSendCode}
                disabled={loading}
              >
                {loading ? "Sending..." : "Send Code"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center py-2">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={setOtp}
                onComplete={handleConfirmSetup}
                disabled={loading}
                render={({ slots }) => (
                  <InputOTPGroup>
                    {slots.map((slot, i) => (
                      <InputOTPSlot key={i} {...slot} index={i} className="h-12 w-12 text-lg font-semibold" />
                    ))}
                  </InputOTPGroup>
                )}
              />
            </div>

            <div className="text-center">
              {countdown > 0 ? (
                <p className="text-sm text-slate-500">Resend in {formatCountdown(countdown)}</p>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={loading}
                  className="text-sm font-medium text-blue-600 hover:underline disabled:opacity-50"
                >
                  Resend code
                </button>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setStep("phone"); setOtp(""); setError(""); }}>
                Back
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={handleConfirmSetup}
                disabled={loading || otp.length !== 6}
              >
                {loading ? "Verifying..." : "Enable MFA"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  MFA MANAGE CARD  (shown in dashboard)
// ═══════════════════════════════════════════════════════════════════
export function MfaManageCard({
  userId,
  mfaEnabled,
  hasPhoneNumber,
  phoneNumber,
  onMfaChanged,
}: MfaManageProps) {
  const [showSetup, setShowSetup] = useState(false);
  const [showDisable, setShowDisable] = useState(false);
  const [disabling, setDisabling] = useState(false);

  const handleDisable = async () => {
    setDisabling(true);
    try {
      const res = await fetch("/api/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        setShowDisable(false);
        onMfaChanged();
      }
    } catch {
      // silent
    } finally {
      setDisabling(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
            mfaEnabled
              ? "bg-emerald-100 dark:bg-emerald-900/30"
              : "bg-slate-200 dark:bg-slate-700"
          }`}>
            <svg className={`h-5 w-5 ${
              mfaEnabled
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-slate-500 dark:text-slate-400"
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              Two-Step Verification
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {mfaEnabled
                ? `Enabled — ${phoneNumber || "Phone number on file"}`
                : "Not enabled — add an extra layer of security"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {mfaEnabled ? (
            <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/50" onClick={() => setShowDisable(true)}>
              Disable
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800" onClick={() => setShowSetup(true)}>
              Set Up
            </Button>
          )}
        </div>
      </div>

      {/* Disable Confirmation Dialog */}
      <Dialog open={showDisable} onOpenChange={setShowDisable}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Disable Two-Step Verification?</DialogTitle>
            <DialogDescription>
              This will remove your phone number and turn off two-step verification. Your account will be less secure.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowDisable(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleDisable}
              disabled={disabling}
            >
              {disabling ? "Disabling..." : "Disable MFA"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Setup Dialog */}
      {showSetup && (
        <MfaSetupDialog
          userId={userId}
          onEnabled={() => {
            setShowSetup(false);
            onMfaChanged();
          }}
          onCancel={() => setShowSetup(false)}
        />
      )}
    </>
  );
}