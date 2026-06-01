"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Plane,
  Wallet,
  MapPin,
  Clock,
  Gift,
  ArrowRight,
  Copy,
  TrendingUp,
  Armchair,
} from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/lib/store";
import { api } from "@/lib/api";
import { LINKS } from "@/lib/branding";
import { toast } from "sonner";

const CREDIT_TYPES = new Set([
  "add",
  "admin_addition",
  "payment_received",
  "referral_reward",
  "referral_bonus",
  "job_earning",
  "flight_refund",
]);

export default function DashboardPage() {
  const { user, setUser, isLoading } = useAuthStore();

  useEffect(() => {
    const refresh = async () => {
      const fresh = await api.fetchMe();
      if (fresh) setUser(fresh);
    };
    refresh();
  }, [setUser]);

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const referralLink = `${LINKS.website}/register?ref=${user.user_id}`;

  return (
    <div className="container mx-auto px-4 py-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold mb-6">
          Welcome back,{" "}
          <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            {user.nickname}
          </span>
        </h1>
      </motion.div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          {
            icon: Wallet,
            label: "Balance",
            value: `${user.money.toLocaleString()} VND`,
            color: "text-emerald-600",
          },
          {
            icon: MapPin,
            label: "Flight Miles",
            value: user.flightmiles.toLocaleString(),
            color: "text-teal-600",
          },
          {
            icon: TrendingUp,
            label: "Membership",
            value: user.flightmiles >= 1000 ? "Gold" : user.flightmiles >= 500 ? "Silver" : "Bronze",
            color: "text-amber-400",
          },
          {
            icon: Plane,
            label: "Group",
            value: user.group.charAt(0).toUpperCase() + user.group.slice(1),
            color: "text-sky-400",
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="bg-card/50">
              <CardContent className="p-4">
                <stat.icon className={`h-5 w-5 ${stat.color} mb-2`} />
                <div className="text-xs text-muted-foreground">{stat.label}</div>
                <div className="text-lg font-bold mt-0.5">{stat.value}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Upcoming Flight */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-card/50">
            <CardContent className="p-6">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <Plane className="h-4 w-4 text-emerald-600" />
                Upcoming Flights
              </h2>
              {user.upcoming_flight ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-emerald-600">{user.upcoming_flight.flight}</div>
                      <div className="text-xs text-muted-foreground">Confirmed Reservation</div>
                    </div>
                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 capitalize font-medium">
                      {user.upcoming_flight.class} Class
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 py-2">
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">From</div>
                      <div className="text-xl font-black">{user.upcoming_flight.departure_icao}</div>
                    </div>
                    <div className="flex flex-col items-center gap-1 opacity-40">
                      <Plane className="h-4 w-4 rotate-90" />
                      <div className="h-px w-12 bg-border" />
                    </div>
                    <div className="flex-1 text-right">
                      <div className="text-xs text-muted-foreground uppercase font-bold tracking-wider">To</div>
                      <div className="text-xl font-black">{user.upcoming_flight.arrival_icao}</div>
                    </div>
                  </div>

                  <Separator className="bg-emerald-500/5" />

                  <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4 text-emerald-600" />
                      <span>{user.upcoming_flight.timestamp ? new Date(user.upcoming_flight.timestamp * 1000).toLocaleString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: false 
                      }) : "TBA"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground justify-end">
                      <Armchair className="h-4 w-4 text-emerald-600" />
                      <span className="font-mono font-bold">{user.upcoming_flight.seat}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Plane className="h-8 w-8 mx-auto mb-3 opacity-30" />
                  No upcoming flights
                  <div className="mt-3">
                    <Link href="/booking">
                      <Button size="sm" variant="outline" className="text-xs">
                        Book a Flight <ArrowRight className="ml-1 h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Referral Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="bg-card/50">
            <CardContent className="p-6">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <Gift className="h-4 w-4 text-emerald-600" />
                Referral Program
              </h2>
              <p className="text-sm text-muted-foreground mb-3">
                Earn 50,000 VND for each friend you refer!
              </p>
              <div className="flex gap-2">
                <div className="flex-1 bg-background/50 rounded-lg px-3 py-2 text-xs font-mono text-muted-foreground truncate">
                  {referralLink}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(referralLink);
                    toast.success("Copied!");
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex items-center gap-4 mt-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Referrals: </span>
                  <span className="font-bold">{user.referrals?.count || 0}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Earned: </span>
                  <span className="font-bold text-emerald-600">
                    {(user.referrals?.total_rewards || 0).toLocaleString()} VND
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Transaction History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="md:col-span-2"
        >
          <Card className="bg-card/50">
            <CardContent className="p-6">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 text-emerald-600" />
                Recent Transactions
              </h2>
              {user.transactions && user.transactions.length > 0 ? (
                <div className="space-y-2">
                  {user.transactions.slice(-10).reverse().map((tx, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                    >
                      <div>
                        <div className="text-sm font-medium capitalize">
                          {tx.type.replace(/_/g, " ")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {tx.reason || tx.job || tx.flight || ""}
                          {tx.timestamp
                            ? ` · ${new Date(tx.timestamp * 1000).toLocaleString()}`
                            : ""}
                        </div>
                      </div>
                      <div
                        className={`text-sm font-bold ${
                          CREDIT_TYPES.has(tx.type)
                            ? "text-emerald-600"
                            : "text-red-400"
                        }`}
                      >
                        {CREDIT_TYPES.has(tx.type) ? "+" : "-"}
                        {tx.amount.toLocaleString()} VND
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  No transactions yet
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
