'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Package, Edit2, Check, X, PlusCircle, Trash2 } from 'lucide-react';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

interface ProductItem {
  id: string;
  name: string;
  sku: string;
  productLine: string;
  buyPrice?: number;
  sellPrice: number;
  unit: string;
  tiers: { id: string; label: string; minQty: number; maxQty: number | null; unitPrice: number }[];
}

export default function ProductsPricing() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ buyPrice: 0, sellPrice: 0 });
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', sku: '', productLine: '', buyPrice: 0, sellPrice: 0, unit: 'each' });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => fetch('/api/products').then((r) => r.json()) as Promise<ProductItem[]>,
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { buyPrice?: number; sellPrice?: number } }) => {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update product');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setEditingId(null);
    },
  });

  const createProduct = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProduct),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create product');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setAddDialogOpen(false);
      setNewProduct({ name: '', sku: '', productLine: '', buyPrice: 0, sellPrice: 0, unit: 'each' });
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete product');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setDeleteConfirmId(null);
    },
  });

  const startEdit = (product: { id: string; buyPrice?: number; sellPrice: number }) => {
    setEditingId(product.id);
    setEditValues({ buyPrice: product.buyPrice ?? 0, sellPrice: product.sellPrice });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-gray-300 border-t-[#052093] rounded-full" /></div>;
  }

  // Group products by line
  const productLines = (products ?? []).reduce((acc: Record<string, ProductItem[]>, product: ProductItem) => {
    if (!acc[product.productLine]) acc[product.productLine] = [];
    acc[product.productLine].push(product);
    return acc;
  }, {} as Record<string, ProductItem[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#052093]">Products & Pricing</h2>
        {isAdmin && (
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger render={<Button className="bg-[#052093] hover:bg-[#041a7a] text-white h-8" />}>
              <PlusCircle className="h-4 w-4 mr-1" /> Add Product
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Add New Product</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label className="text-sm">Name</Label><Input value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="Product name" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-sm">SKU</Label><Input value={newProduct.sku} onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })} placeholder="NRO4-STM-07" /></div>
                  <div><Label className="text-sm">Product Line</Label><Input value={newProduct.productLine} onChange={(e) => setNewProduct({ ...newProduct, productLine: e.target.value })} placeholder="MiniStim PNS" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-sm">Sell Price ($)</Label><Input type="number" value={newProduct.sellPrice || ''} onChange={(e) => setNewProduct({ ...newProduct, sellPrice: parseFloat(e.target.value) || 0 })} /></div>
                  <div><Label className="text-sm">Buy Price ($)</Label><Input type="number" value={newProduct.buyPrice || ''} onChange={(e) => setNewProduct({ ...newProduct, buyPrice: parseFloat(e.target.value) || 0 })} /></div>
                </div>
                <div><Label className="text-sm">Unit</Label><Input value={newProduct.unit} onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })} placeholder="each" /></div>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                  <Button onClick={() => createProduct.mutate()} disabled={!newProduct.name || !newProduct.sku || createProduct.isPending} className="bg-[#052093] hover:bg-[#041a7a] text-white">
                    Add Product
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Products grouped by Product Line */}
      {Object.entries(productLines).map(([lineName, lineProducts]) => (
        <Card key={lineName} className="border border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-[#052093] flex items-center gap-2">
              <div className="h-1 w-4 bg-[#FF9700] rounded-full" />
              {lineName}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Sell Price</TableHead>
                    {isAdmin && <TableHead className="text-emerald-600">Buy Price</TableHead>}
                    {isAdmin && <TableHead className="text-emerald-600">Margin</TableHead>}
                    {isAdmin && <TableHead className="text-emerald-600">Margin %</TableHead>}
                    {isAdmin && <TableHead className="w-24"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineProducts.map((product) => {
                    const buyPrice = product.buyPrice ?? 0;
                    const margin = product.sellPrice - buyPrice;
                    const marginPct = product.sellPrice > 0 ? (margin / product.sellPrice) * 100 : 0;
                    const isEditing = editingId === product.id;

                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-[#656565] shrink-0" />
                            <div>
                              <p className="font-medium text-[#111827]">{product.name}</p>
                              <p className="text-xs text-[#656565]">per {product.unit}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{product.sku}</Badge></TableCell>
                        <TableCell>
                          {isEditing && isAdmin ? (
                            <Input type="number" value={editValues.sellPrice} onChange={(e) => setEditValues({ ...editValues, sellPrice: parseFloat(e.target.value) || 0 })} className="w-24 h-8" />
                          ) : formatCurrency(product.sellPrice)}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-emerald-600">
                            {isEditing ? (
                              <Input type="number" value={editValues.buyPrice} onChange={(e) => setEditValues({ ...editValues, buyPrice: parseFloat(e.target.value) || 0 })} className="w-24 h-8" />
                            ) : formatCurrency(buyPrice)}
                          </TableCell>
                        )}
                        {isAdmin && <TableCell className="text-emerald-600">{isEditing ? formatCurrency(editValues.sellPrice - editValues.buyPrice) : formatCurrency(margin)}</TableCell>}
                        {isAdmin && <TableCell className="text-emerald-600">{isEditing ? `${((editValues.sellPrice - editValues.buyPrice) / editValues.sellPrice * 100).toFixed(1)}%` : `${marginPct.toFixed(1)}%`}</TableCell>}
                        {isAdmin && (
                          <TableCell>
                            <div className="flex gap-1">
                              {isEditing ? (
                                <>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" onClick={() => updateProduct.mutate({ id: product.id, data: editValues })}><Check className="h-4 w-4" /></Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={cancelEdit}><X className="h-4 w-4" /></Button>
                                </>
                              ) : (
                                <>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(product)}><Edit2 className="h-3.5 w-3.5" /></Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-[#656565] hover:text-red-600" onClick={() => setDeleteConfirmId(product.id)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Product?</DialogTitle></DialogHeader>
          <p className="text-sm text-[#656565]">This action cannot be undone. The product will be permanently removed.</p>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button variant="destructive" onClick={() => deleteConfirmId && deleteProduct.mutate(deleteConfirmId)} disabled={deleteProduct.isPending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tier Pricing - visible to all but margin only for admin */}
      <Card className="border border-gray-200">
        <CardHeader className="pb-3"><CardTitle className="text-base text-[#052093]">Volume / Tier Pricing</CardTitle></CardHeader>
        <CardContent>
          {(products ?? []).filter((p: { tiers: { length: number } }) => p.tiers?.length > 0).map((product: {
            id: string; name: string; sku: string; buyPrice?: number; tiers: { id: string; label: string; minQty: number; maxQty: number | null; unitPrice: number }[];
          }) => (
            <div key={product.id} className="mb-6 last:mb-0">
              <h3 className="font-medium text-[#111827] mb-2 text-sm">
                {product.name} <span className="text-[#656565]">({product.sku})</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {product.tiers.map((tier) => {
                  const buyPrice = product.buyPrice ?? 0;
                  const tierMargin = tier.unitPrice - buyPrice;
                  const tierMarginPct = tier.unitPrice > 0 ? (tierMargin / tier.unitPrice) * 100 : 0;
                  return (
                    <div key={tier.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                      <p className="text-xs text-[#656565]">{tier.label}</p>
                      <p className="text-lg font-bold text-[#052093]">{formatCurrency(tier.unitPrice)}</p>
                      <p className="text-xs text-[#656565]">per unit</p>
                      {isAdmin && <p className="text-xs text-emerald-600 mt-1">Margin: {formatCurrency(tierMargin)} ({tierMarginPct.toFixed(1)}%)</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {(products ?? []).filter((p: { tiers: { length: number } }) => p.tiers?.length > 0).length === 0 && (
            <p className="text-center text-[#656565] py-4">No tier pricing configured</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
