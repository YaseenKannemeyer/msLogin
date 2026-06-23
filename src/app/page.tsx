"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signOut, useSession, authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MfaVerifyPage, MfaManageCard } from "@/components/mfa";

// ─── MFA Status Type ─────────────────────────────────────────────
interface MfaStatus {
  mfaEnabled: boolean;
  phoneNumber: string | null;
  hasPhoneNumber: boolean;
  email: string;
  name: string;
}

function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending, error: sessionError } = useSession();

  // Auth state
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [verificationEmailSent, setVerificationEmailSent] = useState("");

  // MFA state
  const [mfaStatus, setMfaStatus] = useState<MfaStatus | null>(null);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaVerified, setMfaVerified] = useState(false);
  const [checkingMfa, setCheckingMfa] = useState(false);

  // Reset form errors when toggling sign in / sign up
  useEffect(() => {
    setAuthError("");
    setAuthSuccess("");
  }, [isSignUp]);

  // Handle error/success from URL params (from OAuth redirect)
  useEffect(() => {
    const urlError = searchParams.get("error");
    const urlSuccess = searchParams.get("success");
    if (urlError) {
      const errorMessages: Record<string, string> = {
        invalid_token:
          "The verification link is invalid or has expired. Please request a new one.",
        oauth_error:
          "Microsoft sign-in was cancelled or failed. Please try again.",
      };
      setAuthError(
        errorMessages[urlError] || "An error occurred during authentication.",
      );
    }
    if (urlSuccess === "true") {
      setAuthSuccess(
        "Account created successfully! Please sign in with your credentials.",
      );
    }
  }, [searchParams]);

  // ─── Check MFA status when session appears ────────────────────────
  const checkMfaStatus = useCallback(async () => {
    if (!session?.user?.id) return;
    setCheckingMfa(true);
    try {
      const res = await fetch("/api/mfa");
      if (res.ok) {
        const data = await res.json();
        setMfaStatus(data);
        if (data.mfaEnabled) {
          setMfaRequired(true);
          setMfaVerified(false);
        }
      }
    } catch {
      // If MFA check fails, let them through (non-blocking)
    } finally {
      setCheckingMfa(false);
    }
  }, [session?.user?.id]);

  // Check MFA when session first loads
  useEffect(() => {
    if (session?.user?.id) {
      checkMfaStatus();
    }
  }, [session?.user?.id, checkMfaStatus]);

  // ─── Microsoft OAuth Sign In ────────────────────────────────────────
  const handleMicrosoftSignIn = async () => {
    setAuthError("");
    setVerificationEmailSent("");
    setLoading(true);
    try {
      await signIn.social({
        provider: "microsoft",
        callbackURL: "/",
      });
      setAuthError("Microsoft sign-in redirect failed. Please try again.");
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Microsoft sign-in failed. Please check your configuration.";
      setAuthError(message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Resend Verification Email ────────────────────────────────────
  const handleResendVerification = async () => {
    if (!email.trim()) return;
    setAuthError("");
    setVerificationEmailSent("");
    setLoading(true);
    try {
      await authClient.sendVerificationEmail({
        email: email.trim(),
        callbackURL: "/",
      });
      setVerificationEmailSent(email.trim());
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to send verification email.";
      setAuthError(message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Email/Password Sign In ─────────────────────────────────────────
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");

    if (!email.trim() || !password.trim()) {
      setAuthError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      const result = await signIn.email({
        email: email.trim(),
        password,
      });

      if (result.error) {
        if (result.error.status === 403) {
          setAuthError(
            "Your email address has not been verified. Check your inbox for the verification link.",
          );
        } else if (result.error.status === 401) {
          setAuthError(
            "Invalid email or password. Please check your credentials.",
          );
        } else if (result.error.status === 422) {
          setAuthError(
            "No account found with this email. Please sign up first.",
          );
        } else {
          setAuthError(
            result.error.message || "Sign in failed. Please try again.",
          );
        }
      }
      // Success: session is set automatically by Better Auth
      // MFA check will happen in useEffect
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setAuthError(message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Email/Password Sign Up ─────────────────────────────────────────
  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");

    if (!name.trim() || !email.trim() || !password.trim()) {
      setAuthError("Please fill in all required fields.");
      return;
    }

    if (password.length < 8) {
      setAuthError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setAuthError("Passwords do not match.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAuthError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const result = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
        callbackURL: "/",
      });

      if (result.error) {
        if (result.error.status === 422) {
          setAuthError(
            "An account with this email already exists. Please sign in instead.",
          );
        } else {
          setAuthError(
            result.error.message || "Sign up failed. Please try again.",
          );
        }
      } else {
        setAuthSuccess(
          "Account created! Check your email for a verification link, then sign in.",
        );
        setIsSignUp(false);
        setEmail("");
        setName("");
        setPassword("");
        setConfirmPassword("");
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      setAuthError(message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Sign Out ──────────────────────────────────────────────────────
  const handleSignOut = async () => {
    setMfaRequired(false);
    setMfaVerified(false);
    setMfaStatus(null);
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.refresh();
        },
      },
    });
  };

  // ─── MFA Verified Handler ─────────────────────────────────────────
  const handleMfaVerified = () => {
    setMfaVerified(true);
    setMfaRequired(false);
  };

  // ─── MFA Cancel (sign out) ─────────────────────────────────────────
  const handleMfaCancel = () => {
    setMfaRequired(false);
    handleSignOut();
  };

  // ─── Loading State ────────────────────────────────────────────────
  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <Card className="w-full max-w-md mx-4 p-8">
          <div className="flex flex-col items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </Card>
      </div>
    );
  }

  // ─── MFA Verification Page ────────────────────────────────────────
  // After login, if user has MFA enabled, show verification page
  if (session?.user && mfaRequired && !mfaVerified) {
    return (
      <MfaVerifyPage
        userId={session.user.id}
        userEmail={session.user.email}
        userName={session.user.name}
        userImage={session.user.image}
        maskedPhone={mfaStatus?.phoneNumber ?? null}
        onVerified={handleMfaVerified}
        onCancel={handleMfaCancel}
      />
    );
  }

  // ─── Authenticated Dashboard ───────────────────────────────────────
  if (session?.user && (!mfaRequired || mfaVerified)) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        {/* Header */}
        <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                <svg
                  className="h-4 w-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <span className="font-semibold text-slate-900 dark:text-white text-lg">
                SecurePortal
              </span>
              <Badge
                variant="secondary"
                className="hidden sm:inline-flex text-xs"
              >
                Production
              </Badge>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-10 w-10 rounded-full"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage
                      src={session.user.image || undefined}
                      alt={session.user.name || "User"}
                    />
                    <AvatarFallback className="bg-emerald-100 text-emerald-700 text-sm font-medium">
                      {session.user.name
                        ? session.user.name
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)
                        : "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {session.user.name || "User"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {session.user.email}
                    </p>
                    {session.user.emailVerified && (
                      <Badge
                        variant="secondary"
                        className="w-fit text-xs mt-1 bg-emerald-50 text-emerald-700 border-emerald-200"
                      >
                        Verified
                      </Badge>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-slate-600 dark:text-slate-300 cursor-pointer">
                  <svg
                    className="mr-2 h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  Profile Settings
                </DropdownMenuItem>
                <DropdownMenuItem className="text-slate-600 dark:text-slate-300 cursor-pointer">
                  <svg
                    className="mr-2 h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  Security Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-red-600 dark:text-red-400 cursor-pointer focus:text-red-600 dark:focus:text-red-400"
                >
                  <svg
                    className="mr-2 h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="grid gap-6">
            {/* Welcome Card */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <CardHeader>
                <CardTitle className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                  Welcome back
                  {session.user.name
                    ? `, ${session.user.name.split(" ")[0]}`
                    : ""}
                </CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400">
                  You&apos;re securely signed in. Your session is active and
                  protected.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                        <svg
                          className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                          />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Status
                      </span>
                    </div>
                    <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                      Authenticated
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <svg
                          className="h-4 w-4 text-blue-600 dark:text-blue-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Email
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {session.user.email}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-8 w-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <svg
                          className="h-4 w-4 text-purple-600 dark:text-purple-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Session
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      Active (7 days)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Security & MFA Card */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <svg
                    className="h-5 w-5 text-slate-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  Security
                </CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400">
                  Manage your account security and two-step verification
                  settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* MFA Card */}
                {mfaStatus && (
                  <MfaManageCard
                    userId={session.user.id}
                    mfaEnabled={mfaStatus.mfaEnabled}
                    hasPhoneNumber={mfaStatus.hasPhoneNumber}
                    phoneNumber={mfaStatus.phoneNumber}
                    onMfaChanged={checkMfaStatus}
                  />
                )}

                {/* Email Verification Status */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                        session.user.emailVerified
                          ? "bg-emerald-100 dark:bg-emerald-900/30"
                          : "bg-amber-100 dark:bg-amber-900/30"
                      }`}
                    >
                      <svg
                        className={`h-5 w-5 ${
                          session.user.emailVerified
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-amber-600 dark:text-amber-400"
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        Email Verification
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {session.user.emailVerified
                          ? "Your email is verified"
                          : "Your email has not been verified"}
                      </p>
                    </div>
                  </div>
                  {session.user.emailVerified ? (
                    <Badge
                      variant="secondary"
                      className="bg-emerald-50 text-emerald-700 border-emerald-200"
                    >
                      Verified
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="bg-amber-50 text-amber-700 border-amber-200"
                    >
                      Unverified
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    className="h-auto py-4 px-4 justify-start gap-3 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                    onClick={handleSignOut}
                  >
                    <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                      <svg
                        className="h-5 w-5 text-red-600 dark:text-red-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                        />
                      </svg>
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-slate-900 dark:text-white">
                        Sign Out
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        End your current session securely
                      </p>
                    </div>
                  </Button>

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-auto py-4 px-4 justify-start gap-3 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                          <svg
                            className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                            />
                          </svg>
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-slate-900 dark:text-white">
                            Change Password
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Update your account password
                          </p>
                        </div>
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Change Password</DialogTitle>
                        <DialogDescription>
                          Update your account password to keep your account
                          secure.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Password reset is available via email. Use the
                          &quot;Forgot password&quot; link on the sign-in page
                          to receive a reset link.
                        </p>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 dark:border-slate-800 mt-auto">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-emerald-600 flex items-center justify-center">
                  <svg
                    className="h-3 w-3 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                </div>
                <span>SecurePortal</span>
              </div>
              <p>
                &copy; {new Date().getFullYear()} All rights reserved. Secured
                with Microsoft Entra ID.
              </p>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // ─── Sign In / Sign Up Page ─────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Top Nav */}
      <nav className="border-b border-slate-200/60 dark:border-slate-800/60 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-md bg-emerald-600 flex items-center justify-center">
              <svg
                className="h-3.5 w-3.5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <span className="font-semibold text-slate-900 dark:text-white">
              SecurePortal
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            onClick={() => setIsSignUp(!isSignUp)}
          >
            {isSignUp ? "Sign In" : "Create Account"}
          </Button>
        </div>
      </nav>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg shadow-slate-200/30 dark:shadow-slate-900/30">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto h-12 w-12 rounded-xl bg-emerald-600 flex items-center justify-center mb-3">
              <svg
                className="h-6 w-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white">
              {isSignUp ? "Create your account" : "Welcome back"}
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">
              {isSignUp
                ? "Enter your details to get started"
                : "Sign in to access your secure portal"}
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            {/* Error / Success Alerts */}
            {authError && (
              <Alert
                variant="destructive"
                className="mb-4 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50"
              >
                <AlertDescription className="text-red-700 dark:text-red-300 text-sm">
                  {authError}
                </AlertDescription>
              </Alert>
            )}
            {authSuccess && (
              <Alert className="mb-4 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50">
                <AlertDescription className="text-emerald-700 dark:text-emerald-300 text-sm">
                  {authSuccess}
                </AlertDescription>
              </Alert>
            )}

            {/* ─── Microsoft Sign In Button (Primary) ────────────────── */}
            <Button
              onClick={handleMicrosoftSignIn}
              disabled={loading}
              className="w-full h-12 text-base font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white shadow-sm transition-all duration-200 mb-4"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 border-2 border-slate-300 border-t-slate-700 dark:border-slate-600 dark:border-t-white rounded-full animate-spin" />
                  <span>Connecting to Microsoft...</span>
                </div>
              ) : (
                <>
                  <svg
                    className="h-5 w-5 mr-2.5"
                    viewBox="0 0 21 21"
                    fill="none"
                  >
                    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                  </svg>
                  Continue with Microsoft
                </>
              )}
            </Button>

            {/* Divider */}
            <div className="relative my-6">
              <Separator />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="bg-white dark:bg-slate-900 px-3 text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  or continue with email
                </span>
              </div>
            </div>

            {/* ─── Email/Password Form ───────────────────────────────────── */}
            <form
              onSubmit={isSignUp ? handleEmailSignUp : handleEmailSignIn}
              className="space-y-4"
            >
              {isSignUp && (
                <div className="space-y-2">
                  <Label
                    htmlFor="name"
                    className="text-slate-700 dark:text-slate-300 text-sm font-medium"
                  >
                    Full Name
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={loading}
                    autoComplete="name"
                    className="h-11 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-slate-700 dark:text-slate-300 text-sm font-medium"
                >
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                  autoComplete={isSignUp ? "email" : "current-email"}
                  className="h-11 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="password"
                    className="text-slate-700 dark:text-slate-300 text-sm font-medium"
                  >
                    Password
                  </Label>
                  {!isSignUp && (
                    <button
                      type="button"
                      className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                      onClick={() => {
                        setAuthError(
                          "Password reset: Set up an email service (see setup instructions) to enable password reset.",
                        );
                      }}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                    autoComplete={
                      isSignUp ? "new-password" : "current-password"
                    }
                    className="h-11 pr-10 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
                {isSignUp && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Must be at least 8 characters
                  </p>
                )}
              </div>

              {isSignUp && (
                <div className="space-y-2">
                  <Label
                    htmlFor="confirmPassword"
                    className="text-slate-700 dark:text-slate-300 text-sm font-medium"
                  >
                    Confirm Password
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    required
                    autoComplete="new-password"
                    className="h-11 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400"
                  />
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium shadow-sm transition-all duration-200"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>
                      {isSignUp ? "Creating account..." : "Signing in..."}
                    </span>
                  </div>
                ) : isSignUp ? (
                  "Create Account"
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="justify-center pb-6">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {isSignUp
                ? "Already have an account? "
                : "Don't have an account? "}
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium transition-colors"
              >
                {isSignUp ? "Sign in" : "Create one"}
              </button>
            </p>
          </CardFooter>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 dark:border-slate-800/60 mt-auto">
        <div className="max-w-md mx-auto px-4 py-6 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <span>Secured with enterprise-grade encryption</span>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            &copy; {new Date().getFullYear()} SecurePortal. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense>
      <AuthPage />
    </Suspense>
  );
}
