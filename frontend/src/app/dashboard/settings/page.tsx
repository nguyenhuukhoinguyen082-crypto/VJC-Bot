"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Lock, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/lib/store";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    toast.success("Settings saved!");
    setLoading(false);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold mb-6">Account Settings</h1>

        <form onSubmit={handleSave} className="space-y-6">
          <Card className="bg-card/50">
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-emerald-600" /> Profile
              </h2>
              <div>
                <Label htmlFor="settings-nickname" className="text-xs text-muted-foreground">Display Name</Label>
                <Input id="settings-nickname" defaultValue={user.nickname} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="settings-email" className="text-xs text-muted-foreground">Email</Label>
                <Input id="settings-email" type="email" defaultValue={user.email} className="mt-1.5" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50">
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold flex items-center gap-2">
                <Lock className="h-4 w-4 text-emerald-600" /> Change Password
              </h2>
              <div>
                <Label htmlFor="settings-current-pw" className="text-xs text-muted-foreground">Current Password</Label>
                <Input id="settings-current-pw" type="password" placeholder="Enter current password" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="settings-new-pw" className="text-xs text-muted-foreground">New Password</Label>
                <Input id="settings-new-pw" type="password" placeholder="Enter new password" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="settings-confirm-pw" className="text-xs text-muted-foreground">Confirm New Password</Label>
                <Input id="settings-confirm-pw" type="password" placeholder="Re-enter new password" className="mt-1.5" />
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white"
          >
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </form>

        <Separator className="my-8" />

        <Card className="bg-card/50 border-destructive/30">
          <CardContent className="p-6">
            <h2 className="font-semibold text-destructive mb-2">Danger Zone</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Permanently delete your account and all associated data.
            </p>
            <Button variant="destructive" size="sm">
              Delete Account
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
