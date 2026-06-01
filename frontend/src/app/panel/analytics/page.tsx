"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Download, Users, Plane, DollarSign, TrendingUp } from "lucide-react";

const mockData = {
  daily: { registrations: 0, bookings: 0, revenue: "0", flights: 1, users: 1 },
  weekly: { registrations: 1, bookings: 0, revenue: "0", flights: 1, users: 1 },
  monthly: { registrations: 1, bookings: 0, revenue: "0", flights: 1, users: 1 },
};

function StatsGrid({ data }: { data: typeof mockData.daily }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {[
        { icon: Users, label: "Registrations", value: data.registrations },
        { icon: Plane, label: "Bookings", value: data.bookings },
        { icon: DollarSign, label: "Revenue", value: `${data.revenue} VND` },
        { icon: Plane, label: "Flights", value: data.flights },
        { icon: TrendingUp, label: "Total Users", value: data.users },
      ].map((s) => (
        <Card key={s.label} className="bg-card/50">
          <CardContent className="p-3">
            <s.icon className="h-4 w-4 text-emerald-600 mb-1" />
            <div className="text-lg font-bold">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function PanelAnalyticsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      <Tabs defaultValue="daily">
        <TabsList className="mb-6">
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
        </TabsList>
        <TabsContent value="daily"><StatsGrid data={mockData.daily} /></TabsContent>
        <TabsContent value="weekly"><StatsGrid data={mockData.weekly} /></TabsContent>
        <TabsContent value="monthly"><StatsGrid data={mockData.monthly} /></TabsContent>
      </Tabs>

      <Card className="bg-card/50 mt-6">
        <CardContent className="p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-emerald-600" /> Charts
          </h2>
          <div className="h-48 flex items-center justify-center text-sm text-muted-foreground border border-dashed border-border/50 rounded-lg">
            Charts will populate with real data from the API
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
