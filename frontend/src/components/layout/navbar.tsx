"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Plane,
  Menu,
  User,
  LayoutDashboard,
  LogOut,
  Shield,
  ChevronDown,
} from "lucide-react";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { AIRLINE_NAME, LOGO_MAIN } from "@/lib/branding";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/flights", label: "Flights" },
  { href: "/menu", label: "Menu" },
  { href: "/fleet", label: "Fleet" },
  { href: "/team", label: "Team" },
  { href: "/contact", label: "Contact" },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout: storeLogout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    api.logout();
    storeLogout();
    router.push("/");
  };

  const isAdmin = user?.group === "dev" || user?.group === "director" || user?.group === "staff";

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60"
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <img 
            src={LOGO_MAIN} 
            alt={AIRLINE_NAME} 
            className="h-10 w-auto"
          />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link key={link.href} href={link.href}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`relative px-4 text-sm font-medium transition-colors ${
                    isActive
                      ? "text-emerald-600"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <motion.div
                      layoutId="navbar-indicator"
                      className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full"
                    />
                  )}
                </Button>
              </Link>
            );
          })}
        </nav>

        {/* Desktop Auth */}
        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger
              render={(props) => (
                <Button {...props} variant="ghost" size="sm" className="gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xs">
                      {user.nickname.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{user.nickname}</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </Button>
              )}
            />
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => router.push("/dashboard")} className="cursor-pointer">
                  <LayoutDashboard className="h-4 w-4 mr-2" />
                  Dashboard
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/dashboard/settings")} className="cursor-pointer">
                  <User className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push("/panel")} className="cursor-pointer text-emerald-600">
                      <Shield className="h-4 w-4 mr-2" />
                      Director Panel
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-red-400 focus:text-red-400 cursor-pointer"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link href="/register">
                <Button
                  size="sm"
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/25"
                >
                  Sign Up
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger
            render={(props) => (
              <Button {...props} variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            )}
          />
          <SheetContent side="right" className="w-72 pt-12">
            <nav className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                >
                  <Button
                    variant={pathname === link.href ? "secondary" : "ghost"}
                    className="w-full justify-start"
                  >
                    {link.label}
                  </Button>
                </Link>
              ))}
              <div className="my-4 h-px bg-border" />
              {user ? (
                <>
                  <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start gap-2">
                      <LayoutDashboard className="h-4 w-4" />
                      Dashboard
                    </Button>
                  </Link>
                  {isAdmin && (
                    <Link href="/panel" onClick={() => setMobileOpen(false)}>
                      <Button variant="ghost" className="w-full justify-start gap-2 text-emerald-600">
                        <Shield className="h-4 w-4" />
                        Director Panel
                      </Button>
                    </Link>
                  )}
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 text-red-400"
                    onClick={() => {
                      handleLogout();
                      setMobileOpen(false);
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Link href="/login" onClick={() => setMobileOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/register" onClick={() => setMobileOpen(false)}>
                    <Button className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
                      Sign Up
                    </Button>
                  </Link>
                </>
              )}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </motion.header>
  );
}
