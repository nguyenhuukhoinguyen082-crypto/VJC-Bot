"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2, Plane } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function PanelFleetPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  
  const [form, setForm] = useState({
    id: "",
    config: ""
  });

  const { data: seatmaps = {}, isLoading } = useQuery({
    queryKey: ["seatmap"],
    queryFn: () => api.get<Record<string, any>>("/seatmap"),
  });

  const updateMutation = useMutation({
    mutationFn: ({id, updates}: {id: string, updates: any}) => api.patch(`/seatmap/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seatmap"] });
      toast.success("Aircraft configuration updated");
      setOpen(false);
      setEditOpen(false);
    },
    onError: (err: any) => toast.error(err.message || "Failed to update configuration"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/seatmap/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seatmap"] });
      toast.success("Aircraft removed from fleet");
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete aircraft"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
        const configObj = JSON.parse(form.config);
        updateMutation.mutate({ id: form.id, updates: configObj });
    } catch (err) {
        toast.error("Invalid JSON configuration");
    }
  };

  const startEdit = (id: string, data: any) => {
    setForm({
        id,
        config: JSON.stringify(data, null, 4)
    });
    setEditOpen(true);
  };

  const fleetList = Object.entries(seatmaps).map(([id, data]: [string, any]) => ({
    id,
    type: id,
    capacity: Object.values(data).reduce((acc: number, val: any) => {
        const letters = val.letter?.length || 0;
        const rows = (val.row?.[1] - val.row?.[0] + 1) || (val.number?.[1] - val.number?.[0] + 1) || 0;
        return acc + (letters * rows);
    }, 0),
    status: "Active",
    data
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Fleet Management</h1>
        <Dialog 
            open={open} 
            onOpenChange={(isOpen) => {
                setOpen(isOpen);
                if(isOpen) setForm({id: "", config: "{}"});
            }}
        >
            <DialogTrigger render={<Button size="sm" className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white" />}>
                <Plus className="h-4 w-4 mr-2" /> Add Aircraft
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Add New Aircraft Type</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label>Aircraft ID/Model (e.g. A321NEO)</Label>
                        <Input value={form.id} onChange={e => setForm({...form, id: e.target.value})} placeholder="A321NEO" required />
                    </div>
                    <div className="space-y-2">
                        <Label>Seatmap Configuration (JSON)</Label>
                        <Textarea 
                            value={form.config} 
                            onChange={e => setForm({...form, config: e.target.value})} 
                            placeholder='{"Economy": {"letter": ["A","B","C","D","E","F"], "row": [1, 30]}}'
                            className="font-mono h-64 text-xs"
                            required
                        />
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={updateMutation.isPending} className="w-full">
                            {updateMutation.isPending ? "Saving..." : "Save Aircraft"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="text-center py-8 col-span-3 text-muted-foreground">Loading fleet...</div>
        ) : fleetList.length === 0 ? (
          <div className="text-center py-8 col-span-3 text-muted-foreground">No active fleet defined.</div>
        ) : fleetList.map((aircraft) => (
          <Card key={aircraft.id} className="bg-card/50 border-emerald-500/10">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <Plane className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-bold">{aircraft.type}</h3>
                    <p className="text-xs text-muted-foreground">Configuration</p>
                  </div>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-600">{aircraft.status}</Badge>
              </div>
              
              <div className="bg-muted/30 rounded-lg p-3 mb-4 space-y-2">
                {Object.entries(aircraft.data).map(([cabin, config]: [string, any]) => (
                  <div key={cabin} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{cabin}:</span>
                    <span>{config.letter?.length} columns</span>
                  </div>
                ))}
                <div className="border-t border-border/50 pt-2 flex justify-between text-xs font-bold">
                  <span>Total Capacity:</span>
                  <span className="text-emerald-600">{aircraft.capacity} Seats</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 text-xs hover:bg-emerald-500/10" onClick={() => startEdit(aircraft.id, aircraft.data)}>
                  <Edit className="h-3 w-3 mr-1" /> Edit
                </Button>
                <Button variant="outline" size="sm" className="text-xs text-destructive hover:bg-red-500/10"
                    onClick={() => {
                        if(confirm(`Remove ${aircraft.id} and its configuration?`)){
                            deleteMutation.mutate(aircraft.id);
                        }
                    }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog (reuse form state) */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>Edit {form.id} Configuration</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                    <Label>Seatmap Configuration (JSON)</Label>
                    <Textarea 
                        value={form.config} 
                        onChange={e => setForm({...form, config: e.target.value})} 
                        className="font-mono h-96 text-xs"
                        required
                    />
                </div>
                <DialogFooter>
                    <Button type="submit" disabled={updateMutation.isPending} className="w-full bg-emerald-600 hover:bg-emerald-700">
                        {updateMutation.isPending ? "Updating..." : "Update Configuration"}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
