"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Eye, Wallet, Ban, CheckCircle2, XCircle } from "lucide-react";
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

export default function PanelUsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [walletOpen, setWalletOpen] = useState(false);
  const [banOpen, setBanOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  const [walletForm, setWalletForm] = useState({
    money: 0,
    miles: 0,
    action: "set" // "add", "set"
  });

  const { data: users = {}, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<Record<string, any>>("/users"),
  });

  const updateMutation = useMutation({
    mutationFn: ({id, updates}: {id: string, updates: any}) => api.patch(`/users/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User updated successfully");
      setWalletOpen(false);
      setBanOpen(false);
    },
    onError: (err: any) => toast.error(err.message || "Failed to update user"),
  });

  const handleWalletSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    
    let newMoney = walletForm.money;
    let newMiles = walletForm.miles;
    
    if (walletForm.action === "add") {
        newMoney = (selectedUser.money || 0) + walletForm.money;
        newMiles = (selectedUser.miles || selectedUser.flightmiles || 0) + walletForm.miles;
    }
    
    updateMutation.mutate({ 
        id: selectedUser.id, 
        updates: { money: newMoney, miles: newMiles } 
    });
  };

  const toggleBan = (user: any) => {
    if (confirm(`Are you sure you want to ${user.banned ? 'unban' : 'ban'} ${user.nickname}?`)) {
        updateMutation.mutate({ id: user.id, updates: { banned: !user.banned } });
    }
  };

  const rawUsersList = Object.entries(users).map(([id, data]) => ({ id, ...(data as any) }));

  // Map of ip_address -> count of users sharing this IP
  const ipCounts: Record<string, number> = {};
  rawUsersList.forEach((u: any) => {
    if (u.ip_address) {
      ipCounts[u.ip_address] = (ipCounts[u.ip_address] || 0) + 1;
    }
  });

  const usersList = rawUsersList.filter(u => 
        u.nickname?.toLowerCase().includes(search.toLowerCase()) || 
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.id.includes(search)
  );

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">User Management</h1>

      <Card className="bg-card/50 mb-6">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Search by name, email, or ID..." 
                className="pl-9" 
                value={search}
                onChange={e => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Nickname</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Miles</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Loading users...</TableCell>
              </TableRow>
            ) : usersList.length === 0 ? (
               <TableRow>
                <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No users found.</TableCell>
              </TableRow>
            ) : usersList.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">{u.id}</TableCell>
                <TableCell className="font-medium">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span>{u.nickname}</span>
                            {u.ip_address && ipCounts[u.ip_address] > 1 && (
                                <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[9px] font-mono px-1.5 py-0">
                                    ⚠️ Alt Match
                                </Badge>
                            )}
                        </div>
                        <span className="text-[10px] text-muted-foreground">{u.email}</span>
                        {u.ip_address && (
                            <span className={`text-[9px] font-mono mt-0.5 ${ipCounts[u.ip_address] > 1 ? "text-amber-500 font-semibold" : "text-muted-foreground/60"}`}>
                                IP: {u.ip_address} {ipCounts[u.ip_address] > 1 && `(shared by ${ipCounts[u.ip_address]})`}
                            </span>
                        )}
                    </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">{u.group || 'user'}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{(u.money || 0).toLocaleString()} VND</TableCell>
                <TableCell className="font-mono text-xs">{u.miles || u.flightmiles || 0}</TableCell>
                <TableCell>
                  {u.banned ? (
                    <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Banned</Badge>
                  ) : u.verified ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Verified</Badge>
                  ) : (
                    <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Pending</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-emerald-600" 
                    onClick={() => {
                        setSelectedUser(u);
                        setWalletForm({ money: 0, miles: 0, action: "add" });
                        setWalletOpen(true);
                    }}>
                    <Wallet className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className={`h-8 w-8 ${u.banned ? 'text-emerald-600' : 'text-destructive'}`}
                    onClick={() => toggleBan(u)}>
                    {u.banned ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Wallet Dialog */}
      <Dialog open={walletOpen} onOpenChange={setWalletOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Adjust Wallet: {selectedUser?.nickname}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleWalletSubmit} className="space-y-4 pt-4">
                  <div className="flex gap-4 mb-4">
                      <Button 
                        type="button" 
                        variant={walletForm.action === 'add' ? 'default' : 'outline'}
                        className="flex-1"
                        onClick={() => setWalletForm({...walletForm, action: 'add'})}
                      >Add to Existing</Button>
                      <Button 
                        type="button" 
                        variant={walletForm.action === 'set' ? 'default' : 'outline'}
                        className="flex-1"
                        onClick={() => setWalletForm({...walletForm, action: 'set'})}
                      >Set Exact Amount</Button>
                  </div>
                  <div className="space-y-2">
                      <Label>Money (VND)</Label>
                      <Input 
                        type="number" 
                        value={walletForm.money} 
                        onChange={e => setWalletForm({...walletForm, money: parseInt(e.target.value) || 0})} 
                      />
                  </div>
                  <div className="space-y-2">
                      <Label>Flight Miles</Label>
                      <Input 
                        type="number" 
                        value={walletForm.miles} 
                        onChange={e => setWalletForm({...walletForm, miles: parseInt(e.target.value) || 0})} 
                      />
                  </div>
                  <div className="pt-4 flex justify-between gap-4 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
                      <div className="flex flex-col">
                          <span>Current Balance</span>
                          <span className="font-bold text-foreground">{(selectedUser?.money || 0).toLocaleString()} VND</span>
                      </div>
                      <div className="flex flex-col text-right">
                          <span>New Balance</span>
                          <span className="font-bold text-emerald-600">
                              {(walletForm.action === 'add' ? (selectedUser?.money || 0) + walletForm.money : walletForm.money).toLocaleString()} VND
                          </span>
                      </div>
                  </div>
                  <DialogFooter className="pt-4">
                      <Button type="submit" disabled={updateMutation.isPending} className="w-full bg-emerald-600 hover:bg-emerald-700">
                          {updateMutation.isPending ? "Updating..." : "Confirm Adjustments"}
                      </Button>
                  </DialogFooter>
              </form>
          </DialogContent>
      </Dialog>
    </div>
  );
}
