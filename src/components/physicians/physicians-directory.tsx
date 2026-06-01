'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, UserCircle, Edit2, Trash2 } from 'lucide-react';

export default function PhysiciansDirectory() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const { selectedRepFilter } = useAppStore();
  const queryClient = useQueryClient();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [newPhysician, setNewPhysician] = useState({ name: '', practiceName: '', email: '', phone: '', street: '', city: '', state: '', zip: '' });
  const [selectedSalesRepId, setSelectedSalesRepId] = useState('');
  const [editPhysician, setEditPhysician] = useState<{ id: string; name: string; practiceName: string; email: string; phone: string; street: string; city: string; state: string; zip: string; salesRepId: string } | null>(null);
  const [editRepId, setEditRepId] = useState('');

  const effectiveRepId = user?.role === 'sales_rep' ? user.id : selectedRepFilter;

  const { data: physicians, isLoading } = useQuery({
    queryKey: ['physicians', effectiveRepId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (effectiveRepId) params.set('salesRepId', effectiveRepId);
      return fetch(`/api/physicians?${params}`).then((r) => r.json());
    },
  });

  const { data: salesReps } = useQuery({
    queryKey: ['sales-reps'],
    queryFn: () => fetch('/api/sales-reps').then((r) => r.json()),
    enabled: isAdmin,
  });

  const createPhysician = useMutation({
    mutationFn: async () => {
      const repId = user?.role === 'sales_rep' ? user.id : selectedSalesRepId;
      const res = await fetch('/api/physicians', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newPhysician, salesRepId: repId }),
      });
      if (!res.ok) throw new Error('Failed to create physician');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['physicians'] });
      setAddDialogOpen(false);
      setNewPhysician({ name: '', practiceName: '', email: '', phone: '', street: '', city: '', state: '', zip: '' });
      setSelectedSalesRepId('');
    },
  });

  const updatePhysician = useMutation({
    mutationFn: async () => {
      if (!editPhysician) return;
      const res = await fetch(`/api/physicians/${editPhysician.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editPhysician.name,
          practiceName: editPhysician.practiceName,
          email: editPhysician.email,
          phone: editPhysician.phone,
          street: editPhysician.street,
          city: editPhysician.city,
          state: editPhysician.state,
          zip: editPhysician.zip,
          ...(isAdmin && editRepId ? { salesRepId: editRepId } : {}),
        }),
      });
      if (!res.ok) throw new Error('Failed to update physician');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['physicians'] });
      setEditDialogOpen(false);
      setEditPhysician(null);
    },
  });

  const deletePhysician = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/physicians/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete physician');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['physicians'] });
      setDeleteConfirmId(null);
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openEdit = (p: any) => {
    setEditPhysician({
      id: p.id,
      name: p.name,
      practiceName: p.practiceName,
      email: p.email || '',
      phone: p.phone || '',
      street: p.street || '',
      city: p.city || '',
      state: p.state || '',
      zip: p.zip || '',
      salesRepId: p.salesRepId,
    });
    setEditRepId(p.salesRepId);
    setEditDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#052093]">Physicians</h2>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger render={<Button className="bg-[#052093] hover:bg-[#041a7a] text-white h-8" />}>
            <PlusCircle className="h-4 w-4 mr-1" /> Add Physician
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add New Physician</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-sm">Name</Label><Input value={newPhysician.name} onChange={(e) => setNewPhysician({ ...newPhysician, name: e.target.value })} placeholder="Dr. Jane Smith" /></div>
                <div><Label className="text-sm">Practice Name</Label><Input value={newPhysician.practiceName} onChange={(e) => setNewPhysician({ ...newPhysician, practiceName: e.target.value })} placeholder="Medical Center" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-sm">Email</Label><Input value={newPhysician.email} onChange={(e) => setNewPhysician({ ...newPhysician, email: e.target.value })} placeholder="email@example.com" /></div>
                <div><Label className="text-sm">Phone</Label><Input value={newPhysician.phone} onChange={(e) => setNewPhysician({ ...newPhysician, phone: e.target.value })} placeholder="(555) 555-0100" /></div>
              </div>
              <div><Label className="text-sm">Street</Label><Input value={newPhysician.street} onChange={(e) => setNewPhysician({ ...newPhysician, street: e.target.value })} placeholder="123 Main St" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-sm">City</Label><Input value={newPhysician.city} onChange={(e) => setNewPhysician({ ...newPhysician, city: e.target.value })} placeholder="Phoenix" /></div>
                <div><Label className="text-sm">State</Label><Input value={newPhysician.state} onChange={(e) => setNewPhysician({ ...newPhysician, state: e.target.value })} placeholder="AZ" /></div>
                <div><Label className="text-sm">ZIP</Label><Input value={newPhysician.zip} onChange={(e) => setNewPhysician({ ...newPhysician, zip: e.target.value })} placeholder="85054" /></div>
              </div>
              {isAdmin && (
                <div>
                  <Label className="text-sm">Assign to Sales Rep</Label>
                  <Select value={selectedSalesRepId} onValueChange={(v) => setSelectedSalesRepId(v ?? '')}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select a sales rep..." /></SelectTrigger>
                    <SelectContent>
                      {(salesReps ?? []).map((rep: { id: string; name: string }) => (
                        <SelectItem key={rep.id} value={rep.id}>{rep.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                <Button
                  onClick={() => createPhysician.mutate()}
                  disabled={!newPhysician.name || !newPhysician.practiceName || (isAdmin && !selectedSalesRepId)}
                  className="bg-[#052093] hover:bg-[#041a7a] text-white"
                >
                  Add Physician
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border border-gray-200">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Practice</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Location</TableHead>
                {isAdmin && <TableHead>Sales Rep</TableHead>}
                <TableHead>Orders</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-[#656565]">Loading...</TableCell></TableRow>
              ) : (physicians ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-[#656565]">No physicians found</TableCell></TableRow>
              ) : (
                (physicians ?? []).map((p: {
                  id: string; name: string; practiceName: string; email: string | null; phone: string | null;
                  city: string | null; state: string | null; salesRep?: { name: string }; salesRepId: string; _count: { orders: number };
                }) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserCircle className="h-5 w-5 text-[#656565]" />
                        <span className="font-medium text-[#111827]">{p.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[#656565]">{p.practiceName}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {p.email && <p className="text-[#656565]">{p.email}</p>}
                        {p.phone && <p className="text-[#656565]">{p.phone}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-[#656565]">{p.city && p.state ? `${p.city}, ${p.state}` : '—'}</TableCell>
                    {isAdmin && <TableCell className="text-[#656565]">{p.salesRep?.name ?? '—'}</TableCell>}
                    <TableCell><Badge variant="secondary" className="text-xs">{p._count?.orders ?? 0}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-[#656565] hover:text-red-600" onClick={() => setDeleteConfirmId(p.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Physician</DialogTitle></DialogHeader>
          {editPhysician && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-sm">Name</Label><Input value={editPhysician.name} onChange={(e) => setEditPhysician({ ...editPhysician, name: e.target.value })} /></div>
                <div><Label className="text-sm">Practice Name</Label><Input value={editPhysician.practiceName} onChange={(e) => setEditPhysician({ ...editPhysician, practiceName: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-sm">Email</Label><Input value={editPhysician.email} onChange={(e) => setEditPhysician({ ...editPhysician, email: e.target.value })} /></div>
                <div><Label className="text-sm">Phone</Label><Input value={editPhysician.phone} onChange={(e) => setEditPhysician({ ...editPhysician, phone: e.target.value })} /></div>
              </div>
              <div><Label className="text-sm">Street</Label><Input value={editPhysician.street} onChange={(e) => setEditPhysician({ ...editPhysician, street: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-sm">City</Label><Input value={editPhysician.city} onChange={(e) => setEditPhysician({ ...editPhysician, city: e.target.value })} /></div>
                <div><Label className="text-sm">State</Label><Input value={editPhysician.state} onChange={(e) => setEditPhysician({ ...editPhysician, state: e.target.value })} /></div>
                <div><Label className="text-sm">ZIP</Label><Input value={editPhysician.zip} onChange={(e) => setEditPhysician({ ...editPhysician, zip: e.target.value })} /></div>
              </div>
              {isAdmin && (
                <div>
                  <Label className="text-sm">Assign to Sales Rep</Label>
                  <Select value={editRepId} onValueChange={(v) => setEditRepId(v ?? '')}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(salesReps ?? []).map((rep: { id: string; name: string }) => (
                        <SelectItem key={rep.id} value={rep.id}>{rep.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                <Button onClick={() => updatePhysician.mutate()} disabled={updatePhysician.isPending} className="bg-[#052093] hover:bg-[#041a7a] text-white">
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
          <DialogHeader><DialogTitle>Delete Physician?</DialogTitle></DialogHeader>
          <p className="text-sm text-[#656565]">If this physician has orders, they will be deactivated instead of deleted.</p>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button variant="destructive" onClick={() => deleteConfirmId && deletePhysician.mutate(deleteConfirmId)} disabled={deletePhysician.isPending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
