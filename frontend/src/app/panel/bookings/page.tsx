"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Eye, XCircle, Check, ShieldAlert } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function PanelBookingsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<any>(null);

  const { data: flights = {}, isLoading } = useQuery({
    queryKey: ["flights"],
    queryFn: () => api.get<Record<string, any>>("/flights"),
  });

  const updateBookingMutation = useMutation({
    mutationFn: ({ flightId, seat, updates }: { flightId: string; seat: string; updates: any }) =>
      api.patch(`/flights/${flightId}/bookings/${seat}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flights"] });
      toast.success("Booking status updated");
    },
    onError: (err: any) => toast.error(err.message || "Failed to update booking"),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ flightId, seat }: { flightId: string; seat: string }) =>
      api.delete(`/flights/${flightId}/book/${seat}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flights"] });
      toast.success("Booking cancelled and refunded successfully");
    },
    onError: (err: any) => toast.error(err.message || "Failed to cancel booking"),
  });

  const bookingsList = Object.entries(flights).flatMap(([id, f]: [string, any]) => {
    if (!f.seating || !Array.isArray(f.seating)) return [];
    return f.seating.map((booking: any) => ({
      flightId: id,
      flightNo: f.flight,
      seat: booking.seat,
      class: booking.class || "Economy",
      passengerName: booking.details?.name || booking.username || "Unknown",
      username: booking.username || "Unknown",
      checkedIn: !!booking.checked_in,
      boarded: !!booking.boarded,
      details: booking.details,
      bookedAt: booking.booked_at,
    }));
  });

  const filteredBookings = bookingsList.filter((b) => {
    const s = search.toLowerCase();
    return (
      b.flightNo.toLowerCase().includes(s) ||
      b.username.toLowerCase().includes(s) ||
      b.passengerName.toLowerCase().includes(s) ||
      b.seat.toLowerCase().includes(s) ||
      b.flightId.toLowerCase().includes(s)
    );
  });

  const handleCancelBooking = (flightId: string, seat: string, passengerName: string) => {
    if (confirm(`Are you sure you want to cancel the booking for ${passengerName} on seat ${seat}? This will issue a 50% refund.`)) {
      cancelMutation.mutate({ flightId, seat });
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Booking Oversight</h1>

      <Card className="bg-card/50 mb-6">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search bookings by user, passenger, seat or flight..." 
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Flight</TableHead>
              <TableHead>Passenger</TableHead>
              <TableHead>Seat & Class</TableHead>
              <TableHead>Check-In Status</TableHead>
              <TableHead>Boarding Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  Loading bookings...
                </TableCell>
              </TableRow>
            ) : filteredBookings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  No bookings found
                </TableCell>
              </TableRow>
            ) : filteredBookings.map((b, i) => (
              <TableRow key={i} className="hover:bg-muted/30 transition-colors">
                <TableCell className="font-mono text-xs text-muted-foreground">{b.flightId.slice(0, 8)}</TableCell>
                <TableCell className="font-semibold">{b.flightNo}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{b.passengerName}</span>
                    <span className="text-[10px] text-muted-foreground">Account: @{b.username}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="font-mono text-xs">{b.seat}</Badge>
                    <span className="text-xs text-muted-foreground">{b.class}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge 
                    onClick={() => updateBookingMutation.mutate({
                      flightId: b.flightId,
                      seat: b.seat,
                      updates: { checked_in: !b.checkedIn }
                    })}
                    className={`cursor-pointer select-none transition-all duration-200 hover:scale-105 active:scale-95 ${
                      b.checkedIn 
                        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20" 
                        : "bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20"
                    }`}
                  >
                    {b.checkedIn ? "Checked In" : "Pending Check-In"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge 
                    onClick={() => {
                      if (!b.checkedIn && !b.boarded) {
                        toast.warning("Passenger must check in first!");
                        return;
                      }
                      updateBookingMutation.mutate({
                        flightId: b.flightId,
                        seat: b.seat,
                        updates: { boarded: !b.boarded }
                      });
                    }}
                    className={`cursor-pointer select-none transition-all duration-200 hover:scale-105 active:scale-95 ${
                      b.boarded 
                        ? "bg-sky-500/10 text-sky-500 border border-sky-500/20 hover:bg-sky-500/20" 
                        : "bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20"
                    }`}
                  >
                    {b.boarded ? "Boarded" : "Not Boarded"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-emerald-600 hover:text-emerald-500 hover:bg-emerald-500/10"
                    onClick={() => setSelectedBooking(b)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={() => handleCancelBooking(b.flightId, b.seat, b.passengerName)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Passenger Details Dialog */}
      <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <DialogContent className="sm:max-w-md bg-card/95 border-border/50 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-emerald-600" />
              Passenger Boarding Information
            </DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4 pt-4 text-sm">
              <div className="grid grid-cols-2 gap-4 border-b border-border/50 pb-3">
                <div>
                  <div className="text-xs text-muted-foreground uppercase">Passenger Name</div>
                  <div className="font-semibold text-foreground text-base">{selectedBooking.passengerName}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase">Username</div>
                  <div className="font-semibold text-foreground text-base">@{selectedBooking.username}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Roblox Username</div>
                  <div className="font-medium text-foreground">{selectedBooking.details?.roblox_username || selectedBooking.details?.roblox_name || "N/A"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Discord ID</div>
                  <div className="font-medium text-foreground">{selectedBooking.details?.discord_id || "N/A"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Nationality</div>
                  <div className="font-medium text-foreground">{selectedBooking.details?.nationality || "N/A"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Seat Number</div>
                  <div className="font-mono text-emerald-500 font-bold">{selectedBooking.seat} ({selectedBooking.class})</div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground">Special Requests</div>
                  <div className="font-medium text-foreground">{selectedBooking.details?.special_requests || "None"}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground">Booked At</div>
                  <div className="font-medium text-muted-foreground text-xs">
                    {selectedBooking.bookedAt ? new Date(selectedBooking.bookedAt).toLocaleString() : "N/A"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-border/50">
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground mb-1">Check-in Status</div>
                  <Badge className={selectedBooking.checkedIn ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"}>
                    {selectedBooking.checkedIn ? "Checked In" : "Pending"}
                  </Badge>
                </div>
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground mb-1">Boarding Status</div>
                  <Badge className={selectedBooking.boarded ? "bg-sky-500/10 text-sky-500" : "bg-amber-500/10 text-amber-500"}>
                    {selectedBooking.boarded ? "Boarded" : "Not Boarded"}
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
