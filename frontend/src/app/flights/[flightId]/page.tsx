"use client";

import { use } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Plane, Clock, ArrowLeft, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import {
  formatTime,
  formatDuration,
  formatDate,
  computeSeatCapacity,
  seatsInClass,
  classAvailabilityLabel,
} from "@/lib/utils";

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "checking in": "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  boarding: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  departed: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  landed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  completed: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  delayed: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

type FlightBooking = {
  seat: string;
  class: string;
  username?: string;
};

type FlightData = {
  flight: string;
  departure: {
    icao: string;
    name: string;
    timestamp: number;
  };
  arrival: {
    icao: string;
    name: string;
    timestamp: number;
  };
  aircraft: string;
  pax: number;
  status: string;
  price: Record<string, number>;
  seating?: FlightBooking[];
  flight_miles_reward?: number;
};

function normalizeSeating(seating: unknown): FlightBooking[] {
  if (Array.isArray(seating)) return seating;
  return [];
}

export default function FlightDetailPage({
  params,
}: {
  params: Promise<{ flightId: string }>;
}) {
  const { flightId } = use(params);
  const { user, isLoading: authLoading } = useAuthStore();

  const {
    data: flight,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["flight", flightId],
    queryFn: () => api.get<FlightData>(`/flights/${flightId}`),
  });

  const { data: seatmap } = useQuery({
    queryKey: ["seatmap", flight?.aircraft],
    queryFn: () => api.get<Record<string, { row?: [number, number]; number?: [number, number]; letter?: string[] }>>(
      `/planes/${flight!.aircraft}/seatmap`
    ),
    enabled: !!flight?.aircraft,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-24 flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        Loading flight details...
      </div>
    );
  }

  if (isError || !flight) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <p className="text-muted-foreground mb-4">Flight not found.</p>
        <Link href="/flights">
          <Button variant="outline">Back to Flights</Button>
        </Link>
      </div>
    );
  }

  const bookings = normalizeSeating(flight.seating);
  const bookedCount = bookings.length;
  const totalCapacity = computeSeatCapacity(seatmap);
  const priceClasses = Object.entries(flight.price || {}).filter(([, price]) => price > 0);

  const bookedByClass = bookings.reduce<Record<string, number>>((acc, b) => {
    const cls = b.class || "Economy";
    acc[cls] = (acc[cls] || 0) + 1;
    return acc;
  }, {});

  const depTs = flight.departure?.timestamp ?? 0;
  const arrTs = flight.arrival?.timestamp ?? 0;
  const status = (flight.status || "scheduled").toLowerCase();

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <Link
        href="/flights"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Flights
      </Link>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="bg-card/50 overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-100/60 to-teal-100/50 dark:from-emerald-500/12 dark:to-teal-500/10 p-6 border-b border-emerald-500/10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold">{flight.flight}</h1>
                <p className="text-sm text-muted-foreground">
                  {flight.aircraft}
                  {totalCapacity > 0 ? ` · ${totalCapacity} seats` : ""}
                </p>
              </div>
              <Badge className={(statusColors[status] || statusColors.scheduled) + " text-sm px-3 py-1 capitalize"}>
                {status}
              </Badge>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-3xl font-black">{formatTime(depTs)}</div>
                <div className="text-lg font-bold text-emerald-600">{flight.departure?.icao}</div>
                <div className="text-xs text-muted-foreground max-w-[140px]">
                  {flight.departure?.name}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{formatDate(depTs)}</div>
              </div>
              <div className="flex-1 flex flex-col items-center gap-1">
                <div className="text-xs text-muted-foreground">
                  {formatDuration(depTs, arrTs)}
                </div>
                <div className="flex items-center w-full">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <div className="h-px flex-1 bg-emerald-500/25" />
                  <Plane className="h-4 w-4 text-emerald-600 mx-1" />
                  <div className="h-px flex-1 bg-emerald-500/25" />
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                </div>
                <div className="text-xs text-muted-foreground">Direct</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-black">{formatTime(arrTs)}</div>
                <div className="text-lg font-bold text-emerald-600">{flight.arrival?.icao}</div>
                <div className="text-xs text-muted-foreground max-w-[140px]">
                  {flight.arrival?.name}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{formatDate(arrTs)}</div>
              </div>
            </div>
          </div>

          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Aircraft</div>
                <div className="font-bold">{flight.aircraft}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Passengers</div>
                <div className="font-bold">
                  {bookedCount}
                  {totalCapacity > 0 ? ` / ${totalCapacity}` : ""} booked
                </div>
              </div>
              {flight.flight_miles_reward != null && flight.flight_miles_reward > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Miles reward</div>
                  <div className="font-bold text-emerald-600">
                    {flight.flight_miles_reward.toLocaleString()}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-3">Class availability & pricing</h3>
              {priceClasses.length === 0 ? (
                <p className="text-sm text-muted-foreground">Pricing not configured for this flight.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {priceClasses.map(([className, price]) => {
                    const bookedInClass = bookedByClass[className] || 0;
                    const totalInClass = seatsInClass(seatmap, className);
                    const isBusiness = className.toLowerCase().includes("business") || className.toLowerCase().includes("first");

                    return (
                      <Card key={className} className="bg-background/50">
                        <CardContent className="p-4">
                          <div className="text-sm text-muted-foreground">{className}</div>
                          <div
                            className={`text-2xl font-bold mt-1 ${
                              isBusiness ? "text-amber-500" : "text-emerald-600"
                            }`}
                          >
                            {price.toLocaleString()}{" "}
                            <span className="text-sm text-muted-foreground font-normal">VND</span>
                          </div>
                          <Badge variant="secondary" className="mt-2 text-xs">
                            {classAvailabilityLabel(bookedInClass, totalInClass)}
                            {totalInClass > 0 && ` · ${bookedInClass}/${totalInClass}`}
                          </Badge>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {bookings.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-emerald-600" />
                    Booked seats ({bookings.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {bookings.map((b) => (
                      <Badge key={b.seat} variant="outline" className="font-mono text-xs">
                        {b.seat} · {b.class}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="flex flex-col gap-2">
              {!authLoading && !user && (
                <p className="text-sm text-muted-foreground text-center">
                  You must be logged in to book a flight.
                </p>
              )}
              <Link
                href={
                  user
                    ? `/booking?flightId=${flightId}`
                    : `/login?redirect=${encodeURIComponent(`/booking?flightId=${flightId}`)}`
                }
                className="flex-1"
              >
                <Button
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white"
                  disabled={status === "completed" || status === "cancelled"}
                >
                  {user ? "Book This Flight" : "Sign In to Book"}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
