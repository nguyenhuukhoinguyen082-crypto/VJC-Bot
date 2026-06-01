"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plane,
  User,
  Armchair,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Copy,
} from "lucide-react";
import { api } from "@/lib/api";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import Link from "next/link";
import { useAuthStore } from "@/lib/store";
import { AIRLINE_NAME } from "@/lib/branding";

const steps = ["Select Flight", "Passenger Info", "Seat Selection", "Review", "Confirmed"];

// Demo flight data for selection
const availableFlights = [
  { id: "flight-1", flight: "BAV001", from: "HAN", to: "DAD", time: "08:30 → 09:55", priceEconomy: 500, priceBusiness: 1500, aircraft: "A320" },
  { id: "flight-2", flight: "BAV042", from: "HAN", to: "SGN", time: "14:00 → 16:10", priceEconomy: 750, priceBusiness: 2200, aircraft: "A321" },
  { id: "flight-3", flight: "BAV108", from: "SGN", to: "PQC", time: "10:15 → 11:20", priceEconomy: 450, priceBusiness: 1350, aircraft: "A320" },
];

// A320 seat layout
function SeatMap({
  aircraft,
  selected,
  onSelect,
  seatClass,
  bookedSeats = [],
}: {
  aircraft: string;
  selected: string | null;
  onSelect: (seat: string) => void;
  seatClass: string;
  bookedSeats: any[];
}) {
  const { data: layout } = useQuery({
    queryKey: ["seatmap", aircraft],
    queryFn: () => api.get<any>(`/planes/${aircraft}/seatmap`),
    enabled: !!aircraft,
  });

  if (!layout || !layout[seatClass]) {
    return <div className="py-8 text-center text-muted-foreground animate-pulse">Loading seat map for {aircraft}...</div>;
  }

  const config = layout[seatClass];
  const letters = config.letter || [];
  const range = config.row || config.number || [1, 1];
  const rows = Array.from({ length: range[1] - range[0] + 1 }, (_, i) => range[0] + i);
  
  const takenSeats = Array.isArray(bookedSeats) ? bookedSeats.map(s => s.seat) : [];

  return (
    <div className="flex flex-col items-center gap-1 overflow-x-auto py-4">
      <div className="flex gap-1 mb-2 text-xs text-muted-foreground">
        {letters.map((l: string) => (
          <div key={l} className="w-9 text-center font-mono uppercase">{l}</div>
        ))}
      </div>
      {rows.map((row) => (
        <div key={row} className="flex items-center gap-1">
          {letters.map((letter: string) => {
            const seat = `${row}${letter}`;
            const isTaken = takenSeats.includes(seat);
            const isSelected = selected === seat;
            return (
              <button
                key={seat}
                disabled={isTaken}
                onClick={() => onSelect(seat)}
                className={`w-9 h-9 rounded-md text-[10px] font-mono flex items-center justify-center transition-all ${
                  isTaken
                    ? "bg-muted/40 text-muted-foreground/30 border border-transparent cursor-not-allowed"
                    : isSelected
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 border border-emerald-400"
                    : "bg-card hover:bg-emerald-500/20 border border-border/50 hover:border-emerald-500/30 cursor-pointer"
                }`}
                title={isTaken ? "Occupied" : seat}
              >
                {isTaken ? "×" : isSelected ? "✓" : seat}
              </button>
            );
          })}
          <span className="text-xs text-muted-foreground w-6 text-center font-mono ml-2 italic">{row}</span>
        </div>
      ))}
    </div>
  );
}

function BookingContent() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<string>("Economy");
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  
  const { user } = useAuthStore();

  const [passengerInfo, setPassengerInfo] = useState({
    name: "",
    roblox_username: "",
    discord_id: "",
    nationality: "",
    special_requests: ""
  });

  useEffect(() => {
    if (user) {
      setPassengerInfo(prev => ({
        ...prev,
        name: prev.name || user.nickname || "",
        roblox_username: prev.roblox_username || user.nickname || "",
        discord_id: prev.discord_id || (user.discordID ? String(user.discordID) : ""),
      }));
    }
  }, [user]);

  const [bookingRef, setBookingRef] = useState("");

  const { data: flightsMap = {}, isLoading: isLoadingFlights } = useQuery({
    queryKey: ["flights"],
    queryFn: () => api.get<Record<string, any>>("/flights"),
  });

  useEffect(() => {
    const preselect = searchParams.get("flightId");
    if (preselect && flightsMap[preselect]) {
      setSelectedFlightId(preselect);
    }
  }, [searchParams, flightsMap]);

  const availableFlights = Object.entries(flightsMap)
    .map(([id, data]) => ({ id, ...data }))
    .filter(f => f.status !== "completed" && f.status !== "cancelled");

  const selectedFlight = selectedFlightId ? flightsMap[selectedFlightId] : null;

  const bookMutation = useMutation({
    mutationFn: (data: any) => api.post(`/flights/${selectedFlightId}/book`, data),
    onSuccess: (res: any) => {
        setBookingRef(res.booking.booked_at.split('T')[0].replace(/-/g, '') + "-" + Math.random().toString(36).substring(2, 6).toUpperCase());
        toast.success("Booking confirmed!");
        setStep(5);
    },
    onError: (err: any) => {
        const msg = err.response?.data?.detail || err.message || "Failed to book flight";
        if (msg.toLowerCase().includes("insufficient funds")) {
            toast.error(msg, {
                duration: 6000,
                description: "Pro-tip: Jump into our Discord and use /work to earn more VND!"
            });
        } else {
            toast.error(msg);
        }
    },
  });

  const price = selectedFlight?.price?.[selectedClass] || 0;
  const classes = selectedFlight?.price ? Object.keys(selectedFlight.price) : ["Economy"];

  const handleBooking = () => {
    bookMutation.mutate({
        class_type: selectedClass,
        seat: selectedSeat,
        passenger: passengerInfo
    });
  };

  const reset = () => {
    setSelectedFlightId(null);
    setSelectedClass("Economy");
    setSelectedSeat(null);
    setPassengerInfo({
        name: user?.nickname || "",
        roblox_username: user?.nickname || "",
        discord_id: user?.discordID ? String(user.discordID) : "",
        nationality: "",
        special_requests: ""
    });
    setStep(1);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Book a Flight</h1>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2 shrink-0">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                i + 1 < step
                  ? "bg-emerald-500 text-white"
                  : i + 1 === step
                  ? "bg-emerald-500/20 text-emerald-600 ring-2 ring-emerald-500"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1 < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-xs ${i + 1 === step ? "text-emerald-600 font-medium" : "text-muted-foreground"}`}>
              {s}
            </span>
            {i < steps.length - 1 && <div className="w-6 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* Step 1: Select Flight */}
      {step === 1 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
          {isLoadingFlights ? (
            <div className="py-20 text-center text-muted-foreground">Loading available flights...</div>
          ) : availableFlights.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground italic border-2 border-dashed rounded-xl">No active flights available for booking at the moment.</div>
          ) : (
            availableFlights.map((f: any) => (
                <Card
                  key={f.id}
                  className={`cursor-pointer transition-all hover:border-emerald-500/30 ${
                    selectedFlightId === f.id ? "border-emerald-500 ring-1 ring-emerald-500/30 shadow-lg shadow-emerald-500/10" : "bg-card/50"
                  }`}
                  onClick={() => {
                      setSelectedFlightId(f.id);
                      setSelectedClass(Object.keys(f.price || {})[0] || "Economy");
                  }}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground font-mono">{f.flight}</span>
                        <div className="flex items-center gap-2">
                            <span className="font-bold">{f.departure?.icao}</span>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <span className="font-bold">{f.arrival?.icao}</span>
                        </div>
                      </div>
                      <Separator orientation="vertical" className="h-8" />
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground uppercase">{f.aircraft}</span>
                        <span className="text-sm">{AIRLINE_NAME}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-emerald-600">From {(f.price?.[Object.keys(f.price)[0]] || 0).toLocaleString()} VND</div>
                      <Badge variant="outline" className="text-[10px] uppercase font-bold text-muted-foreground">{f.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
          )}
          {selectedFlightId && (
            <div className="flex items-center gap-3 mt-6 p-4 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
              <Label className="text-sm font-semibold">Select Cabin Class:</Label>
              <Select value={selectedClass} onValueChange={(v) => setSelectedClass(v ?? "Economy")}>
                <SelectTrigger className="w-48 bg-background border-emerald-500/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {classes.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex justify-end mt-4">
            <Button onClick={() => selectedFlightId && setStep(2)} disabled={!selectedFlightId} className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      )}

      {/* Step 2: Passenger Info */}
      {step === 2 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <Card className="bg-card/50">
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold flex items-center gap-2"><User className="h-4 w-4 text-emerald-600" /> Passenger Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Full Name / Display Name</Label>
                  <Input value={passengerInfo.name} onChange={(e) => setPassengerInfo({ ...passengerInfo, name: e.target.value })} placeholder="e.g. Quoc Anh" className="mt-1.5" required />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Roblox Username</Label>
                    {user?.nickname && <span className="text-[10px] text-emerald-500 font-medium animate-pulse">✓ Autofilled</span>}
                  </div>
                  <Input value={passengerInfo.roblox_username} onChange={(e) => setPassengerInfo({ ...passengerInfo, roblox_username: e.target.value })} placeholder="Roblox Username" className="mt-1.5" required />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Discord ID</Label>
                    {user?.discordID && <span className="text-[10px] text-emerald-500 font-medium animate-pulse">✓ Autofilled</span>}
                  </div>
                  <Input value={passengerInfo.discord_id} onChange={(e) => setPassengerInfo({ ...passengerInfo, discord_id: e.target.value })} placeholder="Discord ID" className="mt-1.5" required />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Nationality</Label>
                  <Input value={passengerInfo.nationality} onChange={(e) => setPassengerInfo({ ...passengerInfo, nationality: e.target.value })} placeholder="e.g. Vietnamese" className="mt-1.5" required />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Special Requests During Flights</Label>
                  <Input value={passengerInfo.special_requests} onChange={(e) => setPassengerInfo({ ...passengerInfo, special_requests: e.target.value })} placeholder="e.g. Window seat priority, assistance, etc." className="mt-1.5" />
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-between mt-4">
            <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
            <Button onClick={() => setStep(3)} disabled={!passengerInfo.name} className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      )}

      {/* Step 3: Seat Selection */}
      {step === 3 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <Card className="bg-card/50">
            <CardContent className="p-6">
              <h2 className="font-semibold flex items-center gap-2 mb-4"><Armchair className="h-4 w-4 text-emerald-600" /> Select Your Seat</h2>
              <p className="text-sm text-muted-foreground mb-4">
                {selectedClass} class • {selectedFlight?.aircraft} • Seat: {selectedSeat || "Not selected"}
              </p>
              <SeatMap 
                aircraft={selectedFlight?.aircraft} 
                selected={selectedSeat} 
                onSelect={setSelectedSeat} 
                seatClass={selectedClass || "Economy"} 
                bookedSeats={selectedFlight?.seating || []}
              />
              <div className="flex items-center gap-4 mt-6 text-[10px] text-muted-foreground justify-center border-t pt-4 border-emerald-500/5">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-card border border-border/50" /> Available
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-emerald-500 shadow-md shadow-emerald-500/20" /> Selected
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-muted/40 border border-transparent text-muted-foreground/30 flex items-center justify-center text-[7px] font-bold">×</div> Occupied
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-between mt-4">
            <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
            <Button onClick={() => setStep(4)} disabled={!selectedSeat} className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      )}

      {/* Step 4: Review */}
      {step === 4 && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <Card className="bg-card/50">
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold">Booking Summary</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="text-muted-foreground font-mono">Flight ID</div>
                <div className="font-medium text-emerald-600">{selectedFlight?.flight}</div>
                <div className="text-muted-foreground font-mono">Route</div>
                <div className="font-medium">{selectedFlight?.departure?.icao} → {selectedFlight?.arrival?.icao}</div>
                <div className="text-muted-foreground font-mono">Cabin</div>
                <div className="font-medium">{selectedClass}</div>
                <div className="text-muted-foreground font-mono">Seat</div>
                <div className="font-medium text-emerald-600 font-bold">{selectedSeat}</div>
                <div className="text-muted-foreground font-mono">Passenger</div>
                <div className="font-medium">{passengerInfo.name}</div>
                <div className="text-muted-foreground font-mono">Roblox Username</div>
                <div className="font-medium">{passengerInfo.roblox_username || "N/A"}</div>
                <div className="text-muted-foreground font-mono">Discord ID</div>
                <div className="font-medium">{passengerInfo.discord_id || "N/A"}</div>
                <div className="text-muted-foreground font-mono">Special Requests</div>
                <div className="font-medium">{passengerInfo.special_requests || "None"}</div>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="font-semibold">Total Price</span>
                <span className="text-2xl font-bold text-emerald-600">{price.toLocaleString()} VND</span>
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-between mt-4">
            <Button variant="outline" onClick={() => setStep(3)}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
            <Button
              onClick={handleBooking}
              disabled={bookMutation.isPending}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white min-w-[140px]"
            >
              {bookMutation.isPending ? "Confirming..." : "Confirm Booking"}
            </Button>
          </div>
        </motion.div>
      )}

      {/* Step 5: Confirmation */}
      {step === 5 && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Booking Confirmed!</h2>
          <p className="text-muted-foreground mb-6">Your flight has been booked successfully.</p>
          <Card className="bg-card/50 inline-block">
            <CardContent className="p-6">
              <div className="text-xs text-muted-foreground mb-1">Booking Reference</div>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-black font-mono tracking-wider text-emerald-600">{bookingRef}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => {
                    navigator.clipboard.writeText(bookingRef);
                    toast.success("Copied!");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-center gap-3 mt-8">
            <Link href="/dashboard">
              <Button variant="outline">View in Dashboard</Button>
            </Link>
            <Button onClick={reset} className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
              Book Another Flight
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-24 text-center text-muted-foreground">
          Loading booking...
        </div>
      }
    >
      <BookingContent />
    </Suspense>
  );
}
