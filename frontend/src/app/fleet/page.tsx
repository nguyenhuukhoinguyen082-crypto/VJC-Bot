"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plane, Gauge, Calendar, Settings2 } from "lucide-react";
import { fleetData } from "@/lib/data";
import type { FleetAircraft } from "@/lib/types";

export default function FleetPage() {
  const [filter, setFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedAircraft, setSelectedAircraft] = useState<FleetAircraft | null>(null);

  const filtered = fleetData.filter((a) => {
    if (filter !== "all" && a.type !== filter) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="container mx-auto px-4 py-12">
      <motion.div
        className="text-center mb-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-4xl font-bold mb-3">
          Our{" "}
          <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            Fleet
          </span>
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Explore the aircraft that make up our virtual fleet.
        </p>
      </motion.div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-8 justify-center">
        <Select value={filter} onValueChange={(v) => setFilter(v ?? "all")}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="Narrow-Body">Narrow-Body</SelectItem>
            <SelectItem value="Wide-Body">Wide-Body</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Retired">Retired</SelectItem>
            <SelectItem value="Stored">Stored</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Aircraft Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((aircraft, i) => (
          <motion.div
            key={aircraft.registration}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card
              className="group cursor-pointer hover:border-emerald-500/30 transition-all hover:shadow-lg hover:shadow-emerald-500/5 bg-card/50"
              onClick={() => setSelectedAircraft(aircraft)}
            >
              <div className="h-48 bg-gradient-to-br from-emerald-900/40 to-teal-900/40 flex items-center justify-center relative overflow-hidden">
                <Plane className="h-20 w-20 text-emerald-600/20 group-hover:text-emerald-600/40 transition-all group-hover:scale-110" />
                <Badge
                  className="absolute top-3 right-3 bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                >
                  {aircraft.status}
                </Badge>
              </div>
              <CardContent className="p-5">
                <h3 className="text-lg font-bold mb-1">{aircraft.registration}</h3>
                <p className="text-sm text-muted-foreground mb-3">{aircraft.model}</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Plane className="h-3 w-3 text-emerald-600" />
                    {aircraft.type}
                  </div>
                  <div className="flex items-center gap-1">
                    <Gauge className="h-3 w-3 text-emerald-600" />
                    {aircraft.capacity}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-emerald-600" />
                    Since {aircraft.firstFlight}
                  </div>
                  <div className="flex items-center gap-1">
                    <Settings2 className="h-3 w-3 text-emerald-600" />
                    {aircraft.range || "N/A"}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          No aircraft match your filters.
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={!!selectedAircraft} onOpenChange={() => setSelectedAircraft(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {selectedAircraft?.registration}
            </DialogTitle>
          </DialogHeader>
          {selectedAircraft && (
            <div className="space-y-4">
              <div className="h-40 bg-gradient-to-br from-emerald-900/40 to-teal-900/40 rounded-lg flex items-center justify-center">
                <Plane className="h-16 w-16 text-emerald-600/30" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Model</div>
                  <div className="font-medium">{selectedAircraft.model}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Type</div>
                  <div className="font-medium">{selectedAircraft.type}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Capacity</div>
                  <div className="font-medium">{selectedAircraft.capacity}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">First Flight</div>
                  <div className="font-medium">{selectedAircraft.firstFlight}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Range</div>
                  <div className="font-medium">{selectedAircraft.range || "N/A"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Engines</div>
                  <div className="font-medium">{selectedAircraft.engines || "N/A"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Status</div>
                  <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                    {selectedAircraft.status}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
