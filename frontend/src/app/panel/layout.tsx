"use client";

import { AuthGuard } from "@/components/auth/auth-guard";
import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Plane,
  Users,
  UserCog,
  BarChart3,
  Settings,
  Ticket,
  ShieldCheck,
  Menu,
  ChevronLeft,
} from "lucide-react";

const panelNav = [
  { href: "/panel", label: "Overview", icon: BarChart3 },
  { href: "/panel/flights", label: "Flights", icon: Plane },
  { href: "/panel/fleet", label: "Fleet", icon: Plane },
  { href: "/panel/users", label: "Users", icon: Users },
  { href: "/panel/team", label: "Team", icon: UserCog },
  { href: "/panel/bookings", label: "Bookings", icon: Ticket },
  { href: "/panel/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/panel/settings", label: "Settings", icon: Settings },
];

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[40vh] text-muted-foreground">Loading...</div>}>
    <AuthGuard requirePanel>
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <motion.aside
        className={`sticky top-16 h-[calc(100vh-4rem)] border-r border-border/50 bg-card/30 flex flex-col shrink-0 ${
          collapsed ? "w-16" : "w-56"
        }`}
        layout
      >
        <div className="flex items-center justify-between p-3 border-b border-border/50">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-semibold">Director Panel</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
        <nav className="flex-1 py-2 space-y-0.5 px-2">
          {panelNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  className={`w-full justify-start gap-3 h-9 text-sm ${
                    isActive
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "text-muted-foreground hover:text-foreground"
                  } ${collapsed ? "justify-center px-0" : ""}`}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && item.label}
                </Button>
              </Link>
            );
          })}
        </nav>
      </motion.aside>

      {/* Content */}
      <div className="flex-1 p-6">{children}</div>
    </div>
    </AuthGuard>
    </Suspense>
  );
}
