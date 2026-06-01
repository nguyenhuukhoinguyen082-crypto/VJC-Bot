"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Plane, Edit, Trash2, Ticket, Users, Check } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { toUnixTimestamp, fromUnixTimestamp } from "@/lib/utils";


const statusColors: Record<string, string> = {
  scheduled: "bg-blue-500/10 text-blue-400",
  "checking in": "bg-indigo-500/10 text-indigo-400",
  boarding: "bg-amber-500/10 text-amber-400",
  departed: "bg-sky-500/10 text-sky-400",
  landed: "bg-emerald-500/10 text-emerald-600",
  completed: "bg-teal-500/10 text-teal-400",
  cancelled: "bg-red-500/10 text-red-400",
};

export default function PanelFlightsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // Form State
  const [form, setForm] = useState({
    flight: "",
    departure_icao: "",
    departure_name: "",
    departure_ingame_icao: "",
    departure_date: "",
    departure_time: "",
    arrival_icao: "",
    arrival_name: "",
    arrival_ingame_icao: "",
    arrival_date: "",
    arrival_time: "",
    aircraft: "",
    seating_class_prices: {} as Record<string, number>,
    flight_miles_reward: 0,
    pax: 0,
    status: "scheduled"
  });

  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: flights = {}, isLoading } = useQuery({
    queryKey: ["flights"],
    queryFn: () => api.get<Record<string, any>>("/flights"),
  });

  const { data: planes = [] } = useQuery({
    queryKey: ["planes"],
    queryFn: () => api.get<string[]>("/planes"),
  });

  const createMutation = useMutation({
    mutationFn: (newFlight: any) => api.post("/flights", newFlight),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flights"] });
      toast.success("Flight created successfully");
      setOpen(false);
      resetForm();
    },
    onError: (err: any) => toast.error(err.message || "Failed to create flight"),
  });

  const updateMutation = useMutation({
    mutationFn: ({id, updates}: {id: string, updates: any}) => api.patch(`/flights/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flights"] });
      toast.success("Flight updated successfully");
      setEditOpen(false);
      setEditingId(null);
      resetForm();
    },
    onError: (err: any) => toast.error(err.message || "Failed to update flight"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/flights/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flights"] });
      toast.success("Flight deleted successfully");
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete flight"),
  });

  // Boarding and check-in dialog states
  const [boardingFlightId, setBoardingFlightId] = useState<string | null>(null);
  const [boardingSearch, setBoardingSearch] = useState("");

  const completeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/flights/${id}/complete`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flights"] });
      toast.success("Flight completed and miles distributed successfully!");
      setBoardingFlightId(null);
    },
    onError: (err: any) => toast.error(err.message || "Failed to complete flight"),
  });

  const updateBookingMutation = useMutation({
    mutationFn: ({ flightId, seat, updates }: { flightId: string; seat: string; updates: any }) =>
      api.patch(`/flights/${flightId}/bookings/${seat}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flights"] });
      toast.success("Passenger status updated");
    },
    onError: (err: any) => toast.error(err.message || "Failed to update passenger"),
  });

  const resetForm = () => {
    setForm({
        flight: "",
        departure_icao: "",
        departure_name: "",
        departure_ingame_icao: "",
        departure_date: "",
        departure_time: "",
        arrival_icao: "",
        arrival_name: "",
        arrival_ingame_icao: "",
        arrival_date: "",
        arrival_time: "",
        aircraft: "",
        seating_class_prices: {},
        flight_miles_reward: 0,
        pax: 0,
        status: "scheduled"
    });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const departure_timestamp = toUnixTimestamp(form.departure_date, form.departure_time);
    const arrival_timestamp = toUnixTimestamp(form.arrival_date, form.arrival_time);
    
    createMutation.mutate({
      ...form,
      departure_timestamp,
      arrival_timestamp,
    });
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
        const departure_timestamp = toUnixTimestamp(form.departure_date, form.departure_time);
        const arrival_timestamp = toUnixTimestamp(form.arrival_date, form.arrival_time);
        
        updateMutation.mutate({ 
            id: editingId, 
            updates: { 
                ...form, 
                departure_timestamp, 
                arrival_timestamp 
            } 
        });
    }
  };

  const startEdit = (f: any) => {
    setEditingId(f.id);
    const dep = fromUnixTimestamp(f.departure?.timestamp || Math.floor(Date.now()/1000));
    const arr = fromUnixTimestamp(f.arrival?.timestamp || Math.floor(Date.now()/1000) + 3600);
    
    setForm({
        flight: f.flight || "",
        departure_icao: f.departure?.icao || "",
        departure_name: f.departure?.name || "",
        departure_ingame_icao: f.departure?.["ingame-icao"] || "",
        departure_date: dep.date,
        departure_time: dep.time,
        arrival_icao: f.arrival?.icao || "",
        arrival_name: f.arrival?.name || "",
        arrival_ingame_icao: f.arrival?.["ingame-icao"] || "",
        arrival_date: arr.date,
        arrival_time: arr.time,
        aircraft: f.aircraft || "",
        seating_class_prices: f.price || {},
        flight_miles_reward: f.flight_miles_reward || 0,
        pax: f.pax || 0,
        status: f.status || "scheduled"
    });
    setEditOpen(true);
  };

  const boardingFlight = boardingFlightId && flights[boardingFlightId]
    ? { id: boardingFlightId, ...flights[boardingFlightId] }
    : null;

  const flightsList = Object.entries(flights)
    .map(([id, data]) => ({ id, ...data }))
    .filter((f) => f.flight?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Flight Management</h1>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button size="sm" className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white" onClick={resetForm}>
                 <Plus className="h-4 w-4 mr-2" /> Add Flight
              </Button>
            }
          />
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Flight</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 pt-4">
              <FlightFormFields form={form} setForm={setForm} />
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={createMutation.isPending} className="w-full">
                  {createMutation.isPending ? "Creating..." : "Create Flight"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Flight {form.flight}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-4 pt-4">
              <FlightFormFields form={form} setForm={setForm} isEdit />
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={updateMutation.isPending} className="w-full bg-emerald-600 hover:bg-emerald-700">
                  {updateMutation.isPending ? "Updating..." : "Update Flight"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

      </div>

      <Card className="bg-card/50 mb-6">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search flights..." 
                className="pl-9" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Flight</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Aircraft</TableHead>
              <TableHead>PAX</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Loading flights...</TableCell>
              </TableRow>
            ) : flightsList.length === 0 ? (
               <TableRow>
                <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No flights found.</TableCell>
              </TableRow>
            ) : flightsList.map((f: any) => (
              <TableRow key={f.id}>
                <TableCell className="font-medium">{f.flight}</TableCell>
                <TableCell>{f.departure?.icao} → {f.arrival?.icao}</TableCell>
                <TableCell>{f.aircraft}</TableCell>
                <TableCell>{f.pax || 0}</TableCell>
                <TableCell>
                  <Badge className={statusColors[f.status] || "bg-secondary text-secondary-foreground"}>
                    {f.status || 'unknown'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-blue-600 hover:text-blue-500 hover:bg-blue-500/10" 
                    onClick={() => setBoardingFlightId(f.id)}
                    title="Boarding & Check-in Control"
                  >
                    <Ticket className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:text-emerald-500" onClick={() => startEdit(f)}>
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                    onClick={() => {
                        if(confirm("Are you sure you want to delete this flight?")) {
                            deleteMutation.mutate(f.id);
                        }
                    }}
                  ><Trash2 className="h-3 w-3" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Flight Boarding & Passenger Control Dialog */}
      <Dialog open={!!boardingFlightId} onOpenChange={(open) => !open && setBoardingFlightId(null)}>
        <DialogContent className="sm:max-w-4xl bg-card/95 border-border/50 backdrop-blur-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Plane className="h-5 w-5 text-emerald-600" />
              Flight Control Center — {boardingFlight?.flight || ""}
            </DialogTitle>
          </DialogHeader>

          {boardingFlight && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
              {/* Left Column: Flight Info & Status Dispatch Actions */}
              <div className="md:col-span-1 space-y-4 border-r border-border/50 pr-4">
                <div className="bg-muted/30 p-4 rounded-xl space-y-3">
                  <h3 className="font-semibold text-emerald-600 text-sm">Flight Operations</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Route:</span>
                      <span className="font-medium text-foreground">
                        {boardingFlight.departure?.icao} → {boardingFlight.arrival?.icao}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Aircraft:</span>
                      <span className="font-mono font-medium text-foreground">{boardingFlight.aircraft}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current Status:</span>
                      <Badge className={statusColors[boardingFlight.status] || "bg-secondary text-secondary-foreground"}>
                        {boardingFlight.status || "unknown"}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Booked Pax:</span>
                      <span className="font-semibold text-emerald-600">{Array.isArray(boardingFlight.seating) ? boardingFlight.seating.length : 0} booked</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Dispatch Status</h4>
                  <div className="flex flex-col gap-2">
                    <Button 
                      size="sm" 
                      variant={boardingFlight.status === "checking in" ? "default" : "outline"}
                      onClick={() => updateMutation.mutate({ id: boardingFlight.id, updates: { status: "checking in" } })}
                      className="justify-start"
                    >
                      1. Open Check-In
                    </Button>
                    <Button 
                      size="sm" 
                      variant={boardingFlight.status === "boarding" ? "default" : "outline"}
                      onClick={() => updateMutation.mutate({ id: boardingFlight.id, updates: { status: "boarding" } })}
                      className="justify-start"
                    >
                      2. Start Boarding
                    </Button>
                    <Button 
                      size="sm" 
                      variant={boardingFlight.status === "departed" ? "default" : "outline"}
                      onClick={() => updateMutation.mutate({ id: boardingFlight.id, updates: { status: "departed" } })}
                      className="justify-start"
                    >
                      3. Depart Flight
                    </Button>
                    <Button 
                      size="sm" 
                      variant={boardingFlight.status === "landed" ? "default" : "outline"}
                      onClick={() => updateMutation.mutate({ id: boardingFlight.id, updates: { status: "landed" } })}
                      className="justify-start"
                    >
                      4. Land Flight
                    </Button>
                    
                    <div className="border-t border-border/50 my-2 pt-2" />
                    
                    <Button 
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                      disabled={completeMutation.isPending || boardingFlight.status === "completed" || boardingFlight.status === "scheduled"}
                      onClick={() => {
                        if (confirm("Are you sure you want to complete this flight? This will award flight miles to all boarded passengers!")) {
                          completeMutation.mutate(boardingFlight.id);
                        }
                      }}
                    >
                      {completeMutation.isPending ? "Completing..." : "Complete & Award Miles"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Right Column: Passenger & Seat Management */}
              <div className="md:col-span-2 space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-emerald-600" />
                  <h3 className="font-semibold text-sm">Passenger Manifest</h3>
                </div>

                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input 
                    placeholder="Search passenger name or seat..." 
                    className="pl-8 h-8 text-xs"
                    value={boardingSearch}
                    onChange={(e) => setBoardingSearch(e.target.value)}
                  />
                </div>

                <div className="max-h-[50vh] overflow-y-auto border border-border/50 rounded-lg">
                  <Table>
                    <TableHeader className="bg-muted/40 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="py-2 text-xs">Seat</TableHead>
                        <TableHead className="py-2 text-xs">Passenger</TableHead>
                        <TableHead className="py-2 text-xs">Check-In</TableHead>
                        <TableHead className="py-2 text-xs">Boarded</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!Array.isArray(boardingFlight.seating) || boardingFlight.seating.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">
                            No passengers booked on this flight.
                          </TableCell>
                        </TableRow>
                      ) : (
                        boardingFlight.seating
                          .filter((b: any) => {
                            const name = (b.details?.name || b.username || "").toLowerCase();
                            const seat = (b.seat || "").toLowerCase();
                            const s = boardingSearch.toLowerCase();
                            return name.includes(s) || seat.includes(s);
                          })
                          .map((b: any) => (
                            <TableRow key={b.seat} className="hover:bg-muted/20 transition-colors">
                              <TableCell className="font-mono text-xs py-2">
                                <Badge variant="outline" className="font-bold text-emerald-600 bg-emerald-500/5">{b.seat}</Badge>
                              </TableCell>
                              <TableCell className="py-2">
                                <div className="flex flex-col">
                                  <span className="text-xs font-semibold text-foreground">
                                    {b.details?.name || b.username}
                                    {(b.details?.roblox_username || b.details?.roblox_name) && ` (${b.details.roblox_username || b.details.roblox_name})`}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    Discord: {b.details?.discord_id || "N/A"} | @{b.username} ({b.class || "Economy"})
                                  </span>
                                  {b.details?.special_requests && (
                                    <span className="text-[9px] text-emerald-600 bg-emerald-500/5 px-1.5 py-0.5 rounded border border-emerald-500/10 w-fit mt-1 font-medium">
                                      Req: {b.details.special_requests}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="py-2">
                                <Badge 
                                  onClick={() => updateBookingMutation.mutate({
                                    flightId: boardingFlight.id,
                                    seat: b.seat,
                                    updates: { checked_in: !b.checked_in }
                                  })}
                                  className={`cursor-pointer text-[10px] py-0.5 select-none transition-all duration-200 hover:scale-105 active:scale-95 ${
                                    b.checked_in 
                                      ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20" 
                                      : "bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20"
                                  }`}
                                >
                                  {b.checked_in ? "Checked In" : "Pending"}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-2">
                                <Badge 
                                  onClick={() => {
                                    if (!b.checked_in && !b.boarded) {
                                      toast.warning("Passenger must check in first!");
                                      return;
                                    }
                                    updateBookingMutation.mutate({
                                      flightId: boardingFlight.id,
                                      seat: b.seat,
                                      updates: { boarded: !b.boarded }
                                    });
                                  }}
                                  className={`cursor-pointer text-[10px] py-0.5 select-none transition-all duration-200 hover:scale-105 active:scale-95 ${
                                    b.boarded 
                                      ? "bg-sky-500/10 text-sky-500 border border-sky-500/20 hover:bg-sky-500/20" 
                                      : "bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20"
                                  }`}
                                >
                                  {b.boarded ? "Boarded" : "Not Boarded"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FlightFormFields({ form, setForm, isEdit = false }: { form: any, setForm: any, isEdit?: boolean }) {
    const { data: planes = [] } = useQuery({
        queryKey: ["planes"],
        queryFn: () => api.get<string[]>("/planes"),
    });

    const { data: seatmap } = useQuery({
        queryKey: ["seatmap", form.aircraft],
        queryFn: () => api.get<any>(`/planes/${form.aircraft}/seatmap`),
        enabled: !!form.aircraft,
    });

    const classes = seatmap ? Object.keys(seatmap) : [];

    return (
        <div className="grid grid-cols-2 gap-4 max-h-[75vh] overflow-y-auto px-1">
            <div className="space-y-2 col-span-2">
                <Label>Flight Number</Label>
                <Input value={form.flight} onChange={e => setForm({...form, flight: e.target.value})} placeholder="BAV001" required />
            </div>

            <div className="space-y-2 col-span-2">
                <Label>Aircraft</Label>
                <Select 
                    value={form.aircraft} 
                    onValueChange={v => {
                        setForm({...form, aircraft: v, seating_class_prices: {}});
                    }}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select aircraft" />
                    </SelectTrigger>
                    <SelectContent>
                        {planes.map((p: string) => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {classes.length > 0 && (
                <div className="col-span-2 p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/10 space-y-3">
                    <Label className="text-emerald-700 font-semibold">Class Pricing (VND)</Label>
                    <div className="grid grid-cols-2 gap-3">
                        {classes.map((cls) => (
                            <div key={cls} className="space-y-1.5">
                                <Label className="text-[10px] uppercase text-muted-foreground">{cls}</Label>
                                <Input 
                                    type="number" 
                                    value={form.seating_class_prices?.[cls] || ""} 
                                    onChange={e => setForm({
                                        ...form, 
                                        seating_class_prices: {
                                            ...form.seating_class_prices,
                                            [cls]: parseInt(e.target.value) || 0
                                        }
                                    })} 
                                    placeholder={`${cls} price`}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="space-y-2 col-span-2 pb-2">
                <Label>Miles Reward</Label>
                <Input 
                    type="number" 
                    value={form.flight_miles_reward} 
                    onChange={e => setForm({...form, flight_miles_reward: parseInt(e.target.value) || 0})} 
                    placeholder="Miles awarded on completion" 
                />
            </div>
            
            <div className="space-y-2">
                <Label>Departure ICAO</Label>
                <Input value={form.departure_icao} onChange={e => setForm({...form, departure_icao: e.target.value})} placeholder="HAN" required />
            </div>
            <div className="space-y-2">
                <Label>Departure In-Game ICAO</Label>
                <Input value={form.departure_ingame_icao} onChange={e => setForm({...form, departure_ingame_icao: e.target.value})} placeholder="VVNB" required />
            </div>
            
            <div className="space-y-2 col-span-2">
                <Label>Departure Name</Label>
                <Input value={form.departure_name} onChange={e => setForm({...form, departure_name: e.target.value})} placeholder="Hanoi" required />
            </div>

            <div className="space-y-2">
                <Label>Departure Date</Label>
                <Input type="date" value={form.departure_date} onChange={e => setForm({...form, departure_date: e.target.value})} required />
            </div>
            <div className="space-y-2">
                <Label>Departure Time</Label>
                <Input type="time" value={form.departure_time} onChange={e => setForm({...form, departure_time: e.target.value})} required />
            </div>
            
            <div className="space-y-2">
                <Label>Arrival ICAO</Label>
                <Input value={form.arrival_icao} onChange={e => setForm({...form, arrival_icao: e.target.value})} placeholder="DAD" required />
            </div>
            <div className="space-y-2">
                <Label>Arrival In-Game ICAO</Label>
                <Input value={form.arrival_ingame_icao} onChange={e => setForm({...form, arrival_ingame_icao: e.target.value})} placeholder="VVDN" required />
            </div>

            <div className="space-y-2 col-span-2">
                <Label>Arrival Name</Label>
                <Input value={form.arrival_name} onChange={e => setForm({...form, arrival_name: e.target.value})} placeholder="Da Nang" required />
            </div>

            <div className="space-y-2">
                <Label>Arrival Date</Label>
                <Input type="date" value={form.arrival_date} onChange={e => setForm({...form, arrival_date: e.target.value})} required />
            </div>
            <div className="space-y-2">
                <Label>Arrival Time</Label>
                <Input type="time" value={form.arrival_time} onChange={e => setForm({...form, arrival_time: e.target.value})} required />
            </div>

            <div className="space-y-2 col-span-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="checking in">Checking In</SelectItem>
                        <SelectItem value="boarding">Boarding</SelectItem>
                        <SelectItem value="departed">Departed</SelectItem>
                        <SelectItem value="landed">Landed</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
