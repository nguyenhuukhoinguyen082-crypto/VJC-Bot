"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Sparkles,
  Coffee,
  Check,
  X,
  Shield,
  Layers,
  CheckCircle,
  AlertTriangle
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { AIRLINE_NAME } from "@/lib/branding";

interface MenuItem {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  image_url?: string;
  available: boolean;
}

const CATEGORIES = ["All", "Main Course", "Snacks", "Drinks", "Desserts"];

export default function MenuPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  
  // Admin states
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "Main Course",
    price: 0,
    image_url: "",
    available: true,
  });

  const isOperator =
    user?.group === "dev" || user?.group === "director" || user?.group === "staff";

  // Fetch menu query
  const { data: menuItems = [], isLoading } = useQuery<MenuItem[]>({
    queryKey: ["menu"],
    queryFn: () => api.get<MenuItem[]>("/menu"),
  });

  // Create menu item mutation
  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => api.post("/menu", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu"] });
      toast.success("Menu item added successfully");
      setIsFormOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Failed to add menu item");
    },
  });

  // Update menu item mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof formData }) =>
      api.put(`/menu/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu"] });
      toast.success("Menu item updated successfully");
      setIsFormOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Failed to update menu item");
    },
  });

  // Delete menu item mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/menu/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu"] });
      toast.success("Menu item deleted successfully");
      setIsDeleteConfirmOpen(false);
      setItemToDelete(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Failed to delete menu item");
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      category: "Main Course",
      price: 0,
      image_url: "",
      available: true,
    });
    setEditingItem(null);
  };

  const handleOpenAddForm = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description,
      category: item.category,
      price: item.price,
      image_url: item.image_url || "",
      available: item.available,
    });
    setIsFormOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.description.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDeleteConfirm = () => {
    if (itemToDelete) {
      deleteMutation.mutate(itemToDelete);
    }
  };

  // Filter menu items
  const filteredItems = menuItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "All" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(price);
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-7xl">
      {/* Hero Header */}
      <div className="text-center max-w-2xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-500 text-xs font-semibold mb-3">
          <Coffee className="h-3.5 w-3.5" />
          <span>In-Flight Culinary Experience</span>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent sm:text-5xl">
          {AIRLINE_NAME} Culinary Menu
        </h1>
        <p className="mt-4 text-muted-foreground text-sm leading-relaxed">
          Savor premium Vietnamese cuisine and refreshing beverages high above the clouds. Our menus are carefully curated using fresh, high-quality ingredients to elevate your journey.
        </p>
      </div>

      {/* Operator Admin Control Center Banner */}
      {isOperator && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-4 bg-gradient-to-r from-emerald-950/20 to-teal-950/20 rounded-xl border border-emerald-500/20 backdrop-blur-md flex flex-col md:flex-row md:items-center md:justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                Menu Management Console
                <Badge variant="outline" className="text-[10px] text-emerald-500 border-emerald-500/20 bg-emerald-500/5 uppercase font-mono">
                  {user?.group}
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground">Authorized staff mode: Add, update, or remove dishes from the digital catalog.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 self-end md:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAdminMode(!isAdminMode)}
              className={`border-emerald-500/20 hover:bg-emerald-500/5 transition-all text-xs font-semibold ${
                isAdminMode ? "bg-emerald-500/10 text-emerald-400" : "text-foreground"
              }`}
            >
              {isAdminMode ? "Exit Admin Mode" : "Activate Edit Tools"}
            </Button>
            <Button
              size="sm"
              onClick={handleOpenAddForm}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-semibold shadow-lg shadow-emerald-500/10"
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add New Dish
            </Button>
          </div>
        </motion.div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
        {/* Categories */}
        <div className="flex flex-wrap gap-1 bg-muted/40 p-1.5 rounded-lg border border-border/40 w-full md:w-auto">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat}
              variant="ghost"
              size="sm"
              onClick={() => setSelectedCategory(cat)}
              className={`text-xs font-semibold transition-all px-4 py-1.5 rounded-md ${
                selectedCategory === cat
                  ? "bg-emerald-500/10 text-emerald-500 shadow-sm border border-emerald-500/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              {cat}
            </Button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search delicious dishes..."
            className="pl-9 bg-card/40 border-border/50 focus-visible:ring-emerald-500"
          />
        </div>
      </div>

      {/* Menu Grid */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          <span className="text-sm font-medium">Preparing culinary display...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border/60 rounded-2xl bg-card/10">
          <Coffee className="mx-auto h-10 w-10 text-muted-foreground mb-3 opacity-40" />
          <p className="text-base font-bold text-foreground">No dishes found</p>
          <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters or search keywords.</p>
        </div>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
        >
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="group h-full"
              >
                <Card className="overflow-hidden border border-border/50 bg-card/40 hover:bg-card/60 backdrop-blur-sm transition-all duration-300 hover:border-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/5 flex flex-col h-full relative group">
                  
                  {/* Food Image */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                    <img
                      src={
                        item.image_url ||
                        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80"
                      }
                      alt={item.name}
                      className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500 ease-out"
                    />
                    
                    {/* Category Overlay */}
                    <div className="absolute top-3 left-3">
                      <Badge className="bg-background/80 hover:bg-background/90 text-foreground text-[10px] font-semibold tracking-wide border border-border/60 uppercase font-mono px-2 py-0.5 backdrop-blur-sm shadow-sm">
                        {item.category}
                      </Badge>
                    </div>

                    {/* Stock Alert Badge */}
                    {!item.available && (
                      <div className="absolute inset-0 bg-background/80 backdrop-blur-[2px] flex items-center justify-center">
                        <Badge variant="secondary" className="bg-destructive/10 text-destructive border-destructive/20 text-xs font-semibold px-3 py-1 font-mono uppercase tracking-wider animate-pulse">
                          Sold Out
                        </Badge>
                      </div>
                    )}

                    {/* Admin Action Overlay */}
                    {isOperator && isAdminMode && (
                      <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3">
                        <Button
                          variant="secondary"
                          size="icon"
                          onClick={() => handleOpenEditForm(item)}
                          className="h-9 w-9 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-md transition-transform active:scale-95"
                          title="Edit Item"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => {
                            setItemToDelete(item.id);
                            setIsDeleteConfirmOpen(true);
                          }}
                          className="h-9 w-9 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-md transition-transform active:scale-95"
                          title="Delete Item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Card Info */}
                  <CardContent className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-foreground group-hover:text-emerald-500 transition-colors text-base line-clamp-1">
                        {item.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-3 leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-4 border-t border-border/30 flex items-center justify-between">
                      <span className="font-bold text-sm text-emerald-500 font-mono">
                        {formatPrice(item.price)}
                      </span>
                      {item.available ? (
                        <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" /> Available
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Unavailable
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Add / Edit Dialog Form */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleFormSubmit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-500" />
                {editingItem ? "Update Dish Details" : "Add Culinary Selection"}
              </DialogTitle>
              <DialogDescription>
                Fill out the specifications below to configure this food item in the in-flight menu.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs text-muted-foreground font-mono uppercase">
                  Dish Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Traditional Beef Phở"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="category" className="text-xs text-muted-foreground font-mono uppercase">
                    Category <span className="text-destructive">*</span>
                  </Label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="Main Course">Main Course</option>
                    <option value="Snacks">Snacks</option>
                    <option value="Drinks">Drinks</option>
                    <option value="Desserts">Desserts</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="price" className="text-xs text-muted-foreground font-mono uppercase">
                    Price (VND) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="price"
                    type="number"
                    value={formData.price || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, price: parseInt(e.target.value) || 0 })
                    }
                    placeholder="e.g. 85000"
                    required
                    min={0}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="image_url" className="text-xs text-muted-foreground font-mono uppercase">
                  Image URL (Optional)
                </Label>
                <Input
                  id="image_url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="e.g. https://images.unsplash.com/... (Unsplash links)"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description" className="text-xs text-muted-foreground font-mono uppercase">
                  Description <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe taste profile, ingredients, and allergen notices..."
                  required
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/40">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, available: !formData.available })}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    formData.available ? "bg-emerald-500" : "bg-muted"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      formData.available ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
                <div>
                  <Label htmlFor="available" className="text-xs font-semibold cursor-pointer">
                    Available for In-Flight Ordering
                  </Label>
                  <p className="text-[10px] text-muted-foreground">Toggle to hide this dish from order pipelines if ingredients are out of stock.</p>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} size="sm">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold shadow-lg shadow-emerald-500/10"
                size="sm"
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                )}
                {editingItem ? "Save Changes" : "Create Selection"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-red-500 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Remove Dish?
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this menu item? This action is permanent and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => setIsDeleteConfirmOpen(false)}
              size="sm"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              size="sm"
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {deleteMutation.isPending && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
