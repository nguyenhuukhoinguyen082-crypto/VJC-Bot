"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plane,
  Users,
  Ticket,
  TrendingUp,
  DollarSign,
  Activity,
} from "lucide-react";

const overviewStats = [
  { icon: Users, label: "Total Users", value: "1", change: "+0 today" },
  { icon: Plane, label: "Active Flights", value: "1", change: "1 scheduled" },
  { icon: Ticket, label: "Bookings", value: "0", change: "No bookings yet" },
  { icon: DollarSign, label: "Revenue", value: "0 VND", change: "Economy total" },
  { icon: TrendingUp, label: "Total Miles", value: "150", change: "All users" },
  { icon: Activity, label: "API Status", value: "Healthy", change: "Latency: <50ms" },
];

export default function PanelPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Panel Overview</h1>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {overviewStats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="bg-card/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <stat.icon className="h-4 w-4 text-emerald-600" />
                  <Badge variant="secondary" className="text-[10px]">
                    {stat.change}
                  </Badge>
                </div>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-card/50">
          <CardContent className="p-6">
            <h2 className="font-semibold mb-4">Recent Activity</h2>
            <div className="text-sm text-muted-foreground text-center py-8">
              No recent activity to display
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-6">
            <h2 className="font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2 text-sm">
              <a href="/panel/flights" className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <Plane className="h-4 w-4 text-emerald-600" /> Manage Flights
              </a>
              <a href="/panel/users" className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <Users className="h-4 w-4 text-emerald-600" /> Manage Users
              </a>
              <a href="/panel/analytics" className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <TrendingUp className="h-4 w-4 text-emerald-600" /> View Analytics
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
