"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plane, Search, ArrowRight } from "lucide-react";
import { airports } from "@/lib/data";
import { api } from "@/lib/api";
import { formatTime, formatDuration } from "@/lib/utils";

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "checking in": "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  boarding: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  departed: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  landed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  completed: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  delayed: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

export default function FlightsPage() {
  const [origin, setOrigin] = useState("all");
  const [destination, setDestination] = useState("all");
  const [sortBy, setSortBy] = useState("price");

  const { data: flights = {}, isLoading } = useQuery({
    queryKey: ["flights"],
    queryFn: () => api.get<Record<string, any>>("/flights"),
  });

  const flightsList = Object.entries(flights).map(([id, data]) => ({
    id,
    ...data,
    priceEconomy: data.price?.Economy || 500,
  }));

  const filteredFlights = flightsList
    .filter((f) => {
      if (origin !== "all" && f.departure?.icao !== origin) return false;
      if (destination !== "all" && f.arrival?.icao !== destination) return false;
      return true;
    })
    .sort((a, b) =>
      sortBy === "price" ? a.priceEconomy - b.priceEconomy : (a.departure?.timestamp || 0) - (b.departure?.timestamp || 0)
    );

  return (
    <div className="container mx-auto px-4 py-12">
      <motion.div
        className="text-center mb-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-4xl font-bold mb-3">
          Search{" "}
          <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
            Flights
          </span>
        </h1>
        <p className="text-muted-foreground">
          Find and track flights across our network.
        </p>
      </motion.div>

      {/* Search Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="mb-8 bg-card/50">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Origin</Label>
                <Select value={origin} onValueChange={(v) => setOrigin(v || "all")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any origin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any origin</SelectItem>
                    {Object.entries(airports).map(([code, name]) => (
                      <SelectItem key={code} value={code}>
                        {code} — {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Destination</Label>
                <Select value={destination} onValueChange={(v) => setDestination(v || "all")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any destination" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any destination</SelectItem>
                    {Object.entries(airports).map(([code, name]) => (
                      <SelectItem key={code} value={code}>
                        {code} — {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Sort By</Label>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v || "price")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="price">Price (Low → High)</SelectItem>
                    <SelectItem value="time">Departure Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => { setOrigin("all"); setDestination("all"); }}
                variant="outline"
                className="h-10"
              >
                <Search className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Results */}
      <div className="space-y-4">
        {isLoading ? (
            <div className="text-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-muted-foreground">Loading flight network...</p>
            </div>
        ) : filteredFlights.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
                <Plane className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>No flights found matching your criteria.</p>
            </div>
        ) : filteredFlights.map((flight, i) => (
          <motion.div
            key={flight.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.05 }}
          >
            <Card className="hover:border-emerald-500/30 transition-all bg-card/50">
              <CardContent className="p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Flight info */}
                  <div className="flex items-center gap-6 flex-1">
                    <div className="text-center min-w-[60px]">
                      <div className="text-sm font-bold text-emerald-600">{flight.flight}</div>
                      <div className="text-xs text-muted-foreground">{flight.aircraft}</div>
                    </div>
                    <div className="flex items-center gap-4 flex-1">
                      <div className="text-center">
                        <div className="text-xl font-bold">{formatTime(flight.departure?.timestamp)}</div>
                        <div className="text-sm font-medium">{flight.departure?.icao}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">{flight.departure?.name}</div>
                      </div>
                      <div className="flex-1 flex flex-col items-center gap-1">
                        <div className="text-xs text-muted-foreground">
                            {formatDuration(flight.departure?.timestamp, flight.arrival?.timestamp)}
                        </div>
                        <div className="flex items-center w-full">
                          <div className="h-px flex-1 bg-border" />
                          <Plane className="h-3 w-3 text-emerald-600 mx-2" />
                          <div className="h-px flex-1 bg-border" />
                        </div>
                        <Badge className={statusColors[flight.status] || "bg-secondary"}>
                          {flight.status}
                        </Badge>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold">{formatTime(flight.arrival?.timestamp)}</div>
                        <div className="text-sm font-medium">{flight.arrival?.icao}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">{flight.arrival?.name}</div>
                      </div>
                    </div>
                  </div>

                  {/* Price & Action */}
                  <div className="flex md:flex-col items-center md:items-end gap-3 md:gap-1 ml-auto md:min-w-[140px]">
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Economy from</div>
                      <div className="text-2xl font-bold text-emerald-600">
                        {flight.priceEconomy}
                        <span className="text-xs text-muted-foreground ml-1">VND</span>
                      </div>
                    </div>
                    <Link href={`/flights/${flight.id}`}>
                      <Button size="sm" variant="outline" className="text-xs">
                        Details
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
