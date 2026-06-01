"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plane, Eye, EyeOff, Check } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { AIRLINE_NAME, LOGO_ICON, LINKS } from "@/lib/branding";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "verify">("form");
  const [userId, setUserId] = useState("");

  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [discordId, setDiscordId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordValid = password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /[^a-zA-Z0-9]/.test(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordValid) {
      toast.error("Password must be 8+ chars with mixed case and a symbol");
      return;
    }
    if (!passwordsMatch) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const data = await api.register(nickname, email, password, discordId) as { user_id: string };
      setUserId(data.user_id);
      setStep("verify");
      toast.success("Account created! Check your Discord DM for the verification code.");
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.verify(userId, otp);
      toast.success("Account verified! You can now sign in.");
      router.push("/login");
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center mb-8">
          <div className="flex h-16 w-16 items-center justify-center mx-auto mb-4">
            <img 
              src={LOGO_ICON} 
              alt={AIRLINE_NAME} 
              className="h-full w-auto"
            />
          </div>
          <h1 className="text-2xl font-bold">
            {step === "form" ? "Create Account" : "Verify Email"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {step === "form"
              ? `Join ${AIRLINE_NAME} virtual`
              : "Enter the verification code sent to your Discord DM"}
          </p>
        </div>

        <Card className="bg-card/50">
          <CardContent className="p-6">
            {step === "form" ? (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <Label htmlFor="reg-nickname" className="text-xs text-muted-foreground">Username</Label>
                  <Input id="reg-nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Your display name" required className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="reg-email" className="text-xs text-muted-foreground">Email</Label>
                  <Input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="reg-discord" className="text-xs text-muted-foreground">Discord ID</Label>
                  <Input id="reg-discord" value={discordId} onChange={(e) => setDiscordId(e.target.value)} placeholder="Your Discord user ID" required className="mt-1.5" />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    You must already be in our{" "}
                    <a
                      href={LINKS.discord}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-600 hover:underline"
                    >
                      Discord server
                    </a>{" "}
                    to register.
                  </p>
                </div>
                <div>
                  <Label htmlFor="reg-password" className="text-xs text-muted-foreground">Password</Label>
                  <div className="relative mt-1.5">
                    <Input
                      id="reg-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 8 chars, mixed case, symbol"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {password && (
                    <div className="mt-2 space-y-1 text-xs">
                      <div className={passwordValid ? "text-emerald-600" : "text-muted-foreground"}>
                        {passwordValid ? <Check className="inline h-3 w-3 mr-1" /> : "○ "}
                        8+ chars, uppercase, lowercase, symbol
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <Label htmlFor="reg-confirm" className="text-xs text-muted-foreground">Confirm Password</Label>
                  <Input
                    id="reg-confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    required
                    className="mt-1.5"
                  />
                  {confirmPassword && (
                    <div className={`mt-1 text-xs ${passwordsMatch ? "text-emerald-600" : "text-destructive"}`}>
                      {passwordsMatch ? "✓ Passwords match" : "✗ Passwords do not match"}
                    </div>
                  )}
                </div>
                <Button
                  type="submit"
                  disabled={loading || !passwordValid || !passwordsMatch}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white"
                >
                  {loading ? "Creating..." : "Create Account"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <Label htmlFor="otp" className="text-xs text-muted-foreground">Verification Code</Label>
                  <Input
                    id="otp"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Paste code from Discord"
                    required
                    className="mt-1.5 text-center text-sm font-mono"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading || otp.trim().length < 16}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white"
                >
                  {loading ? "Verifying..." : "Verify"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-sm"
                  onClick={async () => {
                    await api.resendCode(userId);
                    toast.success("Code resent!");
                  }}
                >
                  Resend Code
                </Button>
              </form>
            )}

            {step === "form" && (
              <div className="mt-4 text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="text-emerald-600 hover:underline">
                  Sign In
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
