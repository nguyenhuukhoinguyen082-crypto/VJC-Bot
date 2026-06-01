"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Activity, Bell, Shield, Power } from "lucide-react";
import { toast } from "sonner";

export default function PanelSettingsPage() {
  const [maintenance, setMaintenance] = useState(false);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">System Settings</h1>

      <div className="space-y-6">
        <Card className="bg-card/50">
          <CardContent className="p-6">
            <h2 className="font-semibold flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-emerald-600" /> API Health
            </h2>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm">Backend API</div>
                <div className="text-xs text-muted-foreground">localhost:8000</div>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-600">Healthy</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="p-6">
            <h2 className="font-semibold flex items-center gap-2 mb-4">
              <Bell className="h-4 w-4 text-emerald-600" /> Announcement Banner
            </h2>
            <p className="text-sm text-muted-foreground mb-3">
              Show a site-wide notice bar to all users.
            </p>
            <Button variant="outline" size="sm">Configure Banner</Button>
          </CardContent>
        </Card>

        <Card className={`bg-card/50 ${maintenance ? "border-amber-500/30" : ""}`}>
          <CardContent className="p-6">
            <h2 className="font-semibold flex items-center gap-2 mb-4">
              <Power className="h-4 w-4 text-amber-400" /> Maintenance Mode
            </h2>
            <p className="text-sm text-muted-foreground mb-3">
              When active, non-staff users see a maintenance page instead of the site.
            </p>
            <div className="flex items-center justify-between">
              <Badge className={maintenance ? "bg-amber-500/10 text-amber-400" : "bg-muted text-muted-foreground"}>
                {maintenance ? "Active" : "Inactive"}
              </Badge>
              <Button
                variant={maintenance ? "destructive" : "outline"}
                size="sm"
                onClick={() => {
                  setMaintenance(!maintenance);
                  toast.success(maintenance ? "Maintenance mode disabled" : "Maintenance mode enabled");
                }}
              >
                {maintenance ? "Disable" : "Enable"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
