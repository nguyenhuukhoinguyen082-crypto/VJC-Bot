"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plane, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { Suspense } from "react";
import { AIRLINE_NAME, LOGO_ICON } from "@/lib/branding";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";
  const { setUser } = useAuthStore();

  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.login(nickname, password);
      const userData = await api.fetchMe();
      if (!userData) {
        throw { message: "Login succeeded but session could not be loaded" };
      }
      setUser(userData);
      toast.success("Welcome back!");
      router.push(redirect);
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || "Login failed");
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
          <h1 className="text-2xl font-bold">Welcome Back</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your {AIRLINE_NAME} account</p>
        </div>

        <Card className="bg-card/50 border-emerald-500/10">
          <CardContent className="p-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="login-nickname" className="text-xs text-muted-foreground">Nickname</Label>
                <Input
                  id="login-nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Enter your nickname"
                  required
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="login-password" className="text-xs text-muted-foreground">Password</Label>
                <div className="relative mt-1.5">
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white"
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-emerald-600 hover:underline">
                Sign Up
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[80vh]">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}

