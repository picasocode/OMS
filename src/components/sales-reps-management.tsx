'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Users, ShoppingCart, MapPin, PlusCircle, Edit2, Trash2 } from 'lucide-react';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export default function SalesRepsManagement() {
  const { setSelectedRepFilter } = useAppStore();
  const queryClient = useQueryClient();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [newRep, setNewRep] = useState({ name: '', email: '', phone: '', territory: '', password: '' });
  const [editRep, setEditRep] = useState<{ id: string; name: string; email: string; phone: string; territory: string; password: string } | null>(null);

  const { data: reps, isLoading } = useQuery({
    queryKey: ['sales-reps'],
    queryFn: () => fetch('/api/sales-reps').then((r) => r.json()),
  });

  const createRep = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/sales-reps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRep),
      });
      if (!res.ok) throw new Error('Failed to create sales rep');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-reps'] });
      setAddDialogOpen(false);
      setNewRep({ name: '', email: '', phone: '', territory: '', password: '' });
    },
  });

  const updateRep = useMutation({
    mutationFn: async () => {
      if (!editRep) return;
      const res = await fetch(`/api/sales-reps/${editRep.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editRep.name,
          email: editRep.email,
          phone: editRep.phone,
          territory: editRep.territory,
          ...(editRep.password ? { password: editRep.password } : {}),
        }),
      });
      if (!res.ok) throw new Error('Failed to update sales rep');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-reps'] });
      setEditDialogOpen(false);
      setEditRep(null);
    },
  });

  const deleteRep = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/sales-reps/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete sales rep');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-reps'] });
      setDeleteConfirmId(null);
    },
  });

  const openEdit = (rep: { id: string; name: string; email: string; phone: string | null; territory: string | null }) => {
    setEditRep({
      id: rep.id,
      name: rep.name,
      email: rep.email,
      phone: rep.phone || '',
      territory: rep.territory || '',
      password: '',
    });
    setEditDialogOpen(true);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-gray-300 border-t-[#052093] rounded-full" /></div>;
  }

  const totalRevenue = (reps ?? []).reduce((sum: number, r: { totalRevenue: number }) => sum + r.totalRevenue, 0);
  const totalMargin = (reps ?? []).reduce((sum: number, r: { totalMargin: number }) => sum + r.totalMargin, 0);
  const totalOrders = (reps ?? []).reduce((sum: number, r: { _count: { orders: number } }) => sum + r._count.orders, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#052093]">Sales Representatives</h2>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger render={<Button className="bg-[#052093] hover:bg-[#041a7a] text-white h-8" />}>
            <PlusCircle className="h-4 w-4 mr-1" /> Add Sales Rep
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add New Sales Rep</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-sm">Name</Label><Input value={newRep.name} onChange={(e) => setNewRep({ ...newRep, name: e.target.value })} placeholder="John Smith" /></div>
              <div><Label className="text-sm">Email</Label><Input value={newRep.email} onChange={(e) => setNewRep({ ...newRep, email: e.target.value })} placeholder="john@biomedic.com" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-sm">Phone</Label><Input value={newRep.phone} onChange={(e) => setNewRep({ ...newRep, phone: e.target.value })} placeholder="(555) 555-0100" /></div>
                <div><Label className="text-sm">Territory</Label><Input value={newRep.territory} onChange={(e) => setNewRep({ ...newRep, territory: e.target.value })} placeholder="Southwest" /></div>
              </div>
              <div><Label className="text-sm">Password</Label><Input type="password" value={newRep.password} onChange={(e) => setNewRep({ ...newRep, password: e.target.value })} placeholder="Set login password" /></div>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                <Button onClick={() => createRep.mutate()} disabled={!newRep.name || !newRep.email || !newRep.password || createRep.isPending} className="bg-[#052093] hover:bg-[#041a7a] text-white">
                  Add Rep
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-gray-200">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-[#656565]">Total Revenue</p>
            <p className="text-2xl font-bold text-[#111827]">{formatCurrency(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card className="border border-gray-200">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-[#656565]">Total Margin</p>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalMargin)}</p>
          </CardContent>
        </Card>
        <Card className="border border-gray-200">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-[#656565]">Total Orders</p>
            <p className="text-2xl font-bold text-[#111827]">{totalOrders}</p>
          </CardContent>
        </Card>
      </div>

      {/* Rep Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {(reps ?? []).map((rep: {
          id: string; name: string; email: string; phone: string | null; territory: string | null;
          totalRevenue: number; totalMargin: number; _count: { physicians: number; orders: number };
        }) => {
          const marginPct = rep.totalRevenue > 0 ? (rep.totalMargin / rep.totalRevenue) * 100 : 0;
          return (
            <Card key={rep.id} className="border border-gray-200 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedRepFilter(rep.id)}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-[#052093]/10 flex items-center justify-center text-[#052093] font-bold text-sm">
                      {rep.name.split(' ').map((n: string) => n[0]).join('')}
                    </div>
                    <div>
                      <CardTitle className="text-base">{rep.name}</CardTitle>
                      <p className="text-xs text-[#656565]">{rep.email}</p>
                    </div>
                  </div>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(rep)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-[#656565] hover:text-red-600" onClick={() => setDeleteConfirmId(rep.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-[#656565]">
                  <MapPin className="h-4 w-4" />
                  <span>{rep.territory ?? 'No territory'}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center gap-1 text-[#656565] text-xs font-medium mb-1">
                      <Users className="h-3 w-3" /> Physicians
                    </div>
                    <p className="text-lg font-bold text-[#111827]">{rep._count?.physicians ?? 0}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex items-center gap-1 text-[#656565] text-xs font-medium mb-1">
                      <ShoppingCart className="h-3 w-3" /> Orders
                    </div>
                    <p className="text-lg font-bold text-[#111827]">{rep._count?.orders ?? 0}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                  <div>
                    <p className="text-xs text-[#656565]">Revenue</p>
                    <p className="text-sm font-bold text-[#111827]">{formatCurrency(rep.totalRevenue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#656565]">Margin</p>
                    <p className="text-sm font-bold text-emerald-600">{formatCurrency(rep.totalMargin)}</p>
                    <p className="text-xs text-emerald-600">{marginPct.toFixed(1)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Sales Rep</DialogTitle></DialogHeader>
          {editRep && (
            <div className="space-y-3">
              <div><Label className="text-sm">Name</Label><Input value={editRep.name} onChange={(e) => setEditRep({ ...editRep, name: e.target.value })} /></div>
              <div><Label className="text-sm">Email</Label><Input value={editRep.email} onChange={(e) => setEditRep({ ...editRep, email: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-sm">Phone</Label><Input value={editRep.phone} onChange={(e) => setEditRep({ ...editRep, phone: e.target.value })} /></div>
                <div><Label className="text-sm">Territory</Label><Input value={editRep.territory} onChange={(e) => setEditRep({ ...editRep, territory: e.target.value })} /></div>
              </div>
              <div><Label className="text-sm">New Password</Label><Input type="password" value={editRep.password} onChange={(e) => setEditRep({ ...editRep, password: e.target.value })} placeholder="Leave empty to keep current" /></div>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                <Button onClick={() => updateRep.mutate()} disabled={updateRep.isPending} className="bg-[#052093] hover:bg-[#041a7a] text-white">
                  Save Changes
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Sales Rep?</DialogTitle></DialogHeader>
          <p className="text-sm text-[#656565]">If this rep has orders, they will be deactivated instead of deleted.</p>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button variant="destructive" onClick={() => deleteConfirmId && deleteRep.mutate(deleteConfirmId)} disabled={deleteRep.isPending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
