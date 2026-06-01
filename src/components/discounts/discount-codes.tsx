'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Tag, ToggleLeft, ToggleRight } from 'lucide-react';

export default function DiscountCodes() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newCode, setNewCode] = useState({
    code: '', description: '', type: 'percentage', value: 0, productLine: '', expiresAt: '', maxUses: '', stackable: false,
  });

  const { data: codes, isLoading } = useQuery({
    queryKey: ['discount-codes'],
    queryFn: () => fetch('/api/discount-codes').then((r) => r.json()),
  });

  const createCode = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        code: newCode.code.toUpperCase(),
        description: newCode.description || null,
        type: newCode.type,
        value: newCode.value,
        productLine: newCode.productLine && newCode.productLine !== 'all' ? newCode.productLine : null,
        expiresAt: newCode.expiresAt || null,
        maxUses: newCode.maxUses ? parseInt(newCode.maxUses) : null,
        stackable: newCode.stackable,
        createdBy: 'admin',
      };
      const res = await fetch('/api/discount-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to create discount code');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount-codes'] });
      setDialogOpen(false);
      setNewCode({ code: '', description: '', type: 'percentage', value: 0, productLine: '', expiresAt: '', maxUses: '', stackable: false });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const res = await fetch(`/api/discount-codes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error('Failed to toggle code');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount-codes'] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#052093]">Discount Codes</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button className="bg-[#052093] hover:bg-[#041a7a] text-white h-8" />}>
            <PlusCircle className="h-4 w-4 mr-1" /> New Code
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Discount Code</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-sm">Code</Label><Input value={newCode.code} onChange={(e) => setNewCode({ ...newCode, code: e.target.value.toUpperCase() })} placeholder="e.g. SAVE10" /></div>
                <div><Label className="text-sm">Type</Label>
                  <Select value={newCode.type} onValueChange={(v) => setNewCode({ ...newCode, type: v ?? 'percentage' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="percentage">Percentage</SelectItem><SelectItem value="fixed">Fixed Amount</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-sm">Value</Label><Input type="number" value={newCode.value} onChange={(e) => setNewCode({ ...newCode, value: parseFloat(e.target.value) || 0 })} /></div>
                <div><Label className="text-sm">Product Line</Label>
                  <Select value={newCode.productLine} onValueChange={(v) => setNewCode({ ...newCode, productLine: v ?? '' })}>
                    <SelectTrigger><SelectValue placeholder="All products" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Products</SelectItem>
                      <SelectItem value="MiniStim PNS">MiniStim PNS</SelectItem>
                      <SelectItem value="StimuCath">StimuCath</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label className="text-sm">Description</Label><Input value={newCode.description} onChange={(e) => setNewCode({ ...newCode, description: e.target.value })} placeholder="Code description..." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-sm">Expires</Label><Input type="date" value={newCode.expiresAt} onChange={(e) => setNewCode({ ...newCode, expiresAt: e.target.value })} /></div>
                <div><Label className="text-sm">Max Uses</Label><Input type="number" value={newCode.maxUses} onChange={(e) => setNewCode({ ...newCode, maxUses: e.target.value })} placeholder="Unlimited" /></div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="stackable" checked={newCode.stackable} onChange={(e) => setNewCode({ ...newCode, stackable: e.target.checked })} className="rounded" />
                <Label htmlFor="stackable" className="text-sm">Stackable with other codes</Label>
              </div>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                <Button onClick={() => createCode.mutate()} disabled={!newCode.code || newCode.value <= 0} className="bg-[#052093] hover:bg-[#041a7a] text-white">
                  Create Code
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
                <TableHead>Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Product Line</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-[#656565]">Loading...</TableCell></TableRow>
              ) : (codes ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-[#656565]">No discount codes</TableCell></TableRow>
              ) : (
                (codes ?? []).map((code: {
                  id: string; code: string; description: string | null; type: string; value: number; productLine: string | null;
                  expiresAt: string | null; maxUses: number | null; currentUses: number; stackable: boolean; active: boolean; isMarkup: boolean;
                }) => {
                  const isExpired = code.expiresAt ? new Date(code.expiresAt) < new Date() : false;
                  return (
                    <TableRow key={code.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-[#656565]" />
                          <span className="font-mono font-bold text-[#111827]">{code.code}</span>
                          {code.isMarkup && <Badge variant="destructive" className="text-xs">Markup</Badge>}
                          {code.stackable && <Badge variant="secondary" className="text-xs">Stackable</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-[#656565] max-w-[200px] truncate">{code.description ?? '—'}</TableCell>
                      <TableCell className="capitalize text-[#656565]">{code.type}</TableCell>
                      <TableCell className="font-medium">{code.type === 'percentage' ? `${code.value}%` : `$${code.value}`}</TableCell>
                      <TableCell className="text-[#656565]">{code.productLine ?? 'All'}</TableCell>
                      <TableCell className="text-[#656565]">{code.currentUses}{code.maxUses ? `/${code.maxUses}` : ''}</TableCell>
                      <TableCell className="text-[#656565]">{code.expiresAt ? new Date(code.expiresAt).toLocaleDateString() : 'Never'}</TableCell>
                      <TableCell>
                        {code.active && !isExpired ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-0">Active</Badge>
                        ) : isExpired ? (
                          <Badge className="bg-red-100 text-red-700 border-0">Expired</Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-[#656565] border-0">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => toggleActive.mutate({ id: code.id, active: !code.active })}
                          title={code.active ? 'Deactivate' : 'Activate'}
                        >
                          {code.active ? <ToggleRight className="h-5 w-5 text-emerald-500" /> : <ToggleLeft className="h-5 w-5 text-[#656565]" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
