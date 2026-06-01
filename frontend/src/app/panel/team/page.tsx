"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2, Star, Briefcase, Mail } from "lucide-react";
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

export default function PanelTeamPage() {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({
    id: "",
    nickname: "",
    group: ""
  });

  const { data: users = {}, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<Record<string, any>>("/users"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string, updates: any }) => api.patch(`/users/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Team member updated");
      setEditOpen(false);
    },
    onError: (err: any) => toast.error(err.message || "Failed to update member"),
  });

  const startEdit = (member: any) => {
    setForm({
      id: member.id,
      nickname: member.nickname || "",
      group: member.group || "user"
    });
    setEditOpen(true);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({ id: form.id, updates: { nickname: form.nickname, group: form.group } });
  };

  const teamList = Object.entries(users)
    .map(([id, data]) => ({ id, ...(data as any) }))
    .filter((u) => u.group && u.group !== "user");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Team Management</h1>
        <Button size="sm" className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white"
          onClick={() => toast.info("User group management is currently being disabled.")}>
          <Plus className="h-4 w-4 mr-2" /> Add Member
        </Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="text-center py-8 col-span-3 text-muted-foreground">Loading team...</div>
        ) : teamList.length === 0 ? (
          <div className="text-center py-8 col-span-3 text-muted-foreground">No team members found.</div>
        ) : teamList.map((member) => (
          <Card key={member.id} className="bg-card/50 border-emerald-500/10">
            <CardContent className="p-5 text-center">
              <div className="relative group mx-auto mb-3 w-14 h-14">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  {member.nickname?.slice(0, 2).toUpperCase()}
                </div>
                {member.group === 'director' && (
                  <div className="absolute -top-1 -right-1 bg-amber-500 rounded-full p-1 border-2 border-background">
                    <Star className="h-3 w-3 text-white fill-current" />
                  </div>
                )}
              </div>
              <h3 className="font-bold text-lg">{member.nickname}</h3>
              <p className="text-sm text-emerald-600 font-medium capitalize mb-2">{member.group}</p>

              <div className="flex flex-col items-center gap-1 mb-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {member.email || "No email"}</span>
                <span className="flex items-center gap-1 font-mono">ID: {member.id}</span>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 text-xs hover:bg-emerald-500/10" onClick={() => startEdit(member)}>
                  <Edit className="h-3 w-3 mr-1" /> Edit Role
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:bg-red-500/10"
                  onClick={() => {
                    if (confirm(`Demote ${member.nickname} to regular user?`)) {
                      updateMutation.mutate({ id: member.id, updates: { group: "user" } });
                    }
                  }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team Member Role</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Nickname</Label>
              <Input value={form.nickname} onChange={e => setForm({ ...form, nickname: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Group / Permissions</Label>
              <select
                className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm ring-offset-background focus:ring-2 focus:ring-emerald-500"
                value={form.group}
                onChange={e => setForm({ ...form, group: e.target.value })}
              >
                <option value="director">Director</option>
                <option value="staff">Staff</option>
                <option value="dev">Developer</option>
                <option value="user">Regular User (Remove from Team)</option>
              </select>
            </div>
            <DialogFooter className="pt-4">
              <Button type="submit" disabled={updateMutation.isPending} className="w-full bg-emerald-600 hover:bg-emerald-700">
                {updateMutation.isPending ? "Saving..." : "Update Member"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
