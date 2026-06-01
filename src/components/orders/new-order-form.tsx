'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Trash2, Tag, CheckCircle2, Plus } from 'lucide-react';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

interface OrderLineItem {
  productId: string;
  quantity: number;
  sellPrice: number;
  buyPrice: number;
  margin: number;
  tierLabel: string | null;
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

export default function NewOrderForm() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const { selectedRepFilter, setSelectedOrderId } = useAppStore();
  const queryClient = useQueryClient();

  const [salesRepId, setSalesRepId] = useState(user?.role === 'sales_rep' ? user.id : '');
  const [physicianId, setPhysicianId] = useState('');
  const [lineItems, setLineItems] = useState<OrderLineItem[]>([]);
  const [discountCodeInput, setDiscountCodeInput] = useState('');
  const [appliedDiscounts, setAppliedDiscounts] = useState<{ code: string; amount: number; isMarkup: boolean; discountCodeId: string }[]>([]);
  const [discountError, setDiscountError] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [orderSuccess, setOrderSuccess] = useState<{ orderNumber: string; orderId: string } | null>(null);

  const { data: salesReps } = useQuery({
    queryKey: ['sales-reps'],
    queryFn: () => fetch('/api/sales-reps').then((r) => r.json()),
    enabled: isAdmin,
  });

  const effectiveRepId = user?.role === 'sales_rep' ? user.id : salesRepId;
  const { data: physicians } = useQuery({
    queryKey: ['physicians', effectiveRepId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (effectiveRepId) params.set('salesRepId', effectiveRepId);
      return fetch(`/api/physicians?${params}`).then((r) => r.json());
    },
    enabled: !!effectiveRepId || isAdmin,
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => fetch('/api/products').then((r) => r.json()) as Promise<ProductItem[]>,
  });

  const selectedPhysician = physicians?.find((p: { id: string }) => p.id === physicianId);

  const handleRepChange = (repId: string) => {
    setSalesRepId(repId);
    setPhysicianId('');
  };

  const addProductToOrder = (productId: string) => {
    const product = products?.find((p: { id: string }) => p.id === productId);
    if (!product) return;

    // Check if already in order, increment quantity if so
    const existingIndex = lineItems.findIndex(item => item.productId === productId);
    if (existingIndex >= 0) {
      const updated = [...lineItems];
      const newQty = updated[existingIndex].quantity + 1;
      updated[existingIndex] = { ...updated[existingIndex], quantity: newQty };
      // Recalculate tier
      if (product.tiers?.length > 0) {
        const tier = product.tiers.find(
          (t: { minQty: number; maxQty: number | null }) => newQty >= t.minQty && (t.maxQty === null || newQty <= t.maxQty)
        );
        if (tier) {
          updated[existingIndex].sellPrice = tier.unitPrice;
          updated[existingIndex].margin = tier.unitPrice - (product.buyPrice ?? 0);
          updated[existingIndex].tierLabel = tier.label;
        }
      }
      setLineItems(updated);
      return;
    }

    const newItem: OrderLineItem = {
      productId: product.id,
      quantity: 1,
      sellPrice: product.sellPrice,
      buyPrice: product.buyPrice ?? 0,
      margin: product.sellPrice - (product.buyPrice ?? 0),
      tierLabel: null,
    };
    if (product.tiers?.length > 0) {
      const tier = product.tiers.find(
        (t: { minQty: number; maxQty: number | null }) => 1 >= t.minQty && (t.maxQty === null || 1 <= t.maxQty)
      );
      if (tier) {
        newItem.sellPrice = tier.unitPrice;
        newItem.margin = tier.unitPrice - (product.buyPrice ?? 0);
        newItem.tierLabel = tier.label;
      }
    }
    setLineItems([...lineItems, newItem]);
  };

  const updateLineItem = (index: number, field: string, value: string | number) => {
    const updated = [...lineItems];
    if (field === 'quantity') {
      const qty = Math.max(1, parseInt(String(value)) || 1);
      updated[index] = { ...updated[index], quantity: qty };
      const product = products?.find((p: { id: string }) => p.id === updated[index].productId);
      if (product) {
        let sellPrice = product.sellPrice;
        let tierLabel: string | null = null;
        if (product.tiers?.length > 0) {
          const tier = product.tiers.find(
            (t: { minQty: number; maxQty: number | null }) => qty >= t.minQty && (t.maxQty === null || qty <= t.maxQty)
          );
          if (tier) {
            sellPrice = tier.unitPrice;
            tierLabel = tier.label;
          }
        }
        updated[index].sellPrice = sellPrice;
        updated[index].margin = sellPrice - (product.buyPrice ?? 0);
        updated[index].tierLabel = tierLabel;
      }
    }
    setLineItems(updated);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const applyDiscountCode = async () => {
    setDiscountError('');
    if (!discountCodeInput.trim()) return;
    try {
      const subtotal = lineItems.reduce((sum, item) => sum + item.sellPrice * item.quantity, 0);
      const cartProductLines = lineItems.map((item) => {
        const product = products?.find((p: { id: string }) => p.id === item.productId);
        return product?.productLine ?? '';
      });

      const res = await fetch('/api/discount-codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: discountCodeInput, subtotal, productLines: cartProductLines }),
      });
      const data = await res.json();
      if (data.valid) {
        if (appliedDiscounts.some((d) => d.code === discountCodeInput.toUpperCase())) {
          setDiscountError('Code already applied');
          return;
        }
        if (!data.discountCode.stackable && appliedDiscounts.length > 0) {
          setDiscountError('This code cannot be stacked with other discounts');
          return;
        }
        setAppliedDiscounts([...appliedDiscounts, {
          code: discountCodeInput.toUpperCase(),
          amount: data.discountAmount,
          isMarkup: data.isMarkup,
          discountCodeId: data.discountCode.id,
        }]);
        setDiscountCodeInput('');
      } else {
        setDiscountError(data.error);
      }
    } catch {
      setDiscountError('Failed to validate code');
    }
  };

  const removeDiscount = (code: string) => {
    setAppliedDiscounts(appliedDiscounts.filter((d) => d.code !== code));
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.sellPrice * item.quantity, 0);
  const buyTotal = lineItems.reduce((sum, item) => sum + item.buyPrice * item.quantity, 0);
  const discountTotal = appliedDiscounts.reduce((sum, d) => sum + d.amount, 0);
  const total = subtotal - discountTotal;
  const marginTotal = total - buyTotal;
  const marginPct = total > 0 ? (marginTotal / total) * 100 : 0;

  const createOrder = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          physicianId,
          salesRepId: effectiveRepId || selectedRepFilter,
          items: lineItems.map((item) => ({ productId: item.productId, quantity: item.quantity })),
          discountCodes: appliedDiscounts.map((d) => d.code),
          deliveryDate,
          notes,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create order');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setOrderSuccess({ orderNumber: data.orderNumber, orderId: data.id });
    },
  });

  if (orderSuccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full border border-gray-200">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[#052093] mb-2">Order Created!</h2>
            <p className="text-lg font-medium text-[#111827] mb-4">{orderSuccess.orderNumber}</p>
            <p className="text-[#656565] mb-6">Your order has been submitted successfully.</p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => setSelectedOrderId(orderSuccess.orderId)} className="bg-[#052093] hover:bg-[#041a7a] text-white">
                View Order
              </Button>
              <Button variant="outline" onClick={() => {
                setOrderSuccess(null);
                setLineItems([]);
                setAppliedDiscounts([]);
                setPhysicianId('');
                setDeliveryDate('');
                setNotes('');
              }}>
                Create Another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Group products by product line
  const productLines = (products ?? []).reduce((acc: Record<string, ProductItem[]>, product: ProductItem) => {
    if (!acc[product.productLine]) acc[product.productLine] = [];
    acc[product.productLine].push(product);
    return acc;
  }, {} as Record<string, ProductItem[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#052093]">New Order</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form */}
        <div className="lg:col-span-2 space-y-5">
          {/* Sales Rep Selection (Admin only) */}
          {isAdmin && (
            <Card className="border border-gray-200">
              <CardHeader className="pb-3"><CardTitle className="text-base text-[#052093]">Sales Representative</CardTitle></CardHeader>
              <CardContent>
                <Label className="text-sm">Select Sales Rep</Label>
                <Select value={salesRepId} onValueChange={(v) => handleRepChange(v ?? '')}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Choose a sales rep..." /></SelectTrigger>
                  <SelectContent>
                    {(salesReps ?? []).map((rep: { id: string; name: string; territory: string | null }) => (
                      <SelectItem key={rep.id} value={rep.id}>{rep.name} — {rep.territory ?? 'No territory'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {/* Physician Selection */}
          <Card className="border border-gray-200">
            <CardHeader className="pb-3"><CardTitle className="text-base text-[#052093]">Physician Information</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm">Select Physician</Label>
                <Select value={physicianId} onValueChange={(v) => setPhysicianId(v ?? '')}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={
                    isAdmin && !salesRepId ? 'Select a sales rep first...' : 'Choose a physician...'
                  } /></SelectTrigger>
                  <SelectContent>
                    {(physicians ?? []).map((p: { id: string; name: string; practiceName: string }) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} — {p.practiceName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedPhysician && (
                <div className="text-sm text-[#656565] bg-gray-50 p-3 rounded-lg">
                  <p className="font-medium">{selectedPhysician.practiceName}</p>
                  {selectedPhysician.street && <p>{selectedPhysician.street}</p>}
                  {(selectedPhysician.city || selectedPhysician.state) && (
                    <p>{selectedPhysician.city}, {selectedPhysician.state} {selectedPhysician.zip}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Products - SKU Buttons grouped by Product Line */}
          <Card className="border border-gray-200">
            <CardHeader className="pb-3"><CardTitle className="text-base text-[#052093]">Select Products</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {Object.entries(productLines).map(([lineName, lineProducts]) => (
                <div key={lineName}>
                  <h3 className="text-sm font-semibold text-[#052093] mb-3 flex items-center gap-2">
                    <div className="h-1 w-4 bg-[#FF9700] rounded-full" />
                    {lineName}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {lineProducts.map((product) => {
                      const isInOrder = lineItems.some(item => item.productId === product.id);
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => addProductToOrder(product.id)}
                          className={`text-left p-4 rounded-lg border-2 transition-all ${
                            isInOrder
                              ? 'border-[#052093] bg-[#052093]/5'
                              : 'border-gray-200 bg-white hover:border-[#FF9700] hover:shadow-sm'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-[#111827] truncate">{product.name}</p>
                              <p className="text-xs text-[#656565] mt-0.5">{product.sku}</p>
                            </div>
                            {isInOrder && (
                              <Badge className="bg-[#052093] text-white text-xs shrink-0">Added</Badge>
                            )}
                          </div>
                          <div className="mt-2 flex items-end justify-between">
                            <div>
                              <p className="text-lg font-bold text-[#052093]">{formatCurrency(product.sellPrice)}</p>
                              {product.tiers?.length > 0 && (
                                <p className="text-xs text-[#656565]">Volume pricing available</p>
                              )}
                            </div>
                            <div className="h-7 w-7 rounded-full bg-[#FF9700]/10 text-[#FF9700] flex items-center justify-center">
                              <Plus className="h-4 w-4" />
                            </div>
                          </div>
                          {product.unit !== 'each' && product.unit !== 'kit' && (
                            <p className="text-xs text-[#656565] mt-1">per {product.unit}</p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Line Items */}
          {lineItems.length > 0 && (
            <Card className="border border-gray-200">
              <CardHeader className="pb-3"><CardTitle className="text-base text-[#052093]">Order Items</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {lineItems.map((item, index) => {
                  const product = products?.find((p: { id: string }) => p.id === item.productId);
                  return (
                    <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-[#111827]">{product?.name ?? 'Product'}</p>
                          <p className="text-xs text-[#656565]">{product?.sku}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeLineItem(index)} className="text-[#656565] hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-[#656565]">Qty:</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                            className="w-20 h-8 text-sm"
                          />
                        </div>
                        <div className="text-sm">
                          <span className="text-[#656565]">Unit Price: </span>
                          <span className="font-medium">{formatCurrency(item.sellPrice)}</span>
                          {item.tierLabel && (
                            <Badge variant="secondary" className="text-xs ml-2">{item.tierLabel}</Badge>
                          )}
                        </div>
                        <div className="text-sm font-medium text-[#111827] ml-auto">
                          Line Total: {formatCurrency(item.sellPrice * item.quantity)}
                        </div>
                      </div>
                      {/* Admin-only: internal pricing info */}
                      {isAdmin && (
                        <div className="flex gap-4 text-xs bg-emerald-50 p-2 rounded-md border border-emerald-100">
                          <span className="text-emerald-700 font-medium">Buy: {formatCurrency(item.buyPrice)}</span>
                          <span className="text-emerald-700 font-medium">Margin: {formatCurrency(item.margin)}/unit</span>
                          <Badge variant="outline" className="text-xs text-emerald-700 border-emerald-300">Internal Only</Badge>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Discount Code */}
          <Card className="border border-gray-200">
            <CardHeader className="pb-3"><CardTitle className="text-base text-[#052093]">Discount Codes</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter discount code..."
                  value={discountCodeInput}
                  onChange={(e) => { setDiscountCodeInput(e.target.value.toUpperCase()); setDiscountError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyDiscountCode())}
                />
                <Button onClick={applyDiscountCode} variant="outline" className="border-[#052093] text-[#052093]">
                  <Tag className="h-4 w-4 mr-1" /> Apply
                </Button>
              </div>
              {discountError && <p className="text-sm text-red-500">{discountError}</p>}
              {appliedDiscounts.map((d) => (
                <div key={d.code} className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                  <div className="flex items-center gap-2">
                    <Badge variant={d.isMarkup ? 'destructive' : 'default'} className={d.isMarkup ? '' : 'bg-[#052093]'}>{d.code}</Badge>
                    <span className="text-sm">{d.isMarkup ? '+' : '-'}{formatCurrency(Math.abs(d.amount))}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeDiscount(d.code)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Delivery & Notes */}
          <Card className="border border-gray-200">
            <CardHeader className="pb-3"><CardTitle className="text-base text-[#052093]">Additional Details</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm">Expected Delivery Date</Label>
                <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">Notes</Label>
                <textarea
                  className="w-full mt-1 p-2 border rounded-md text-sm min-h-[80px] resize-y bg-background"
                  placeholder="Order notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-20 border border-gray-200">
            <CardHeader className="pb-3"><CardTitle className="text-base text-[#052093]">Order Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {lineItems.length === 0 && (
                <p className="text-center text-[#656565] py-6 text-sm">Click products above to add them to your order</p>
              )}
              {lineItems.map((item, i) => {
                const product = products?.find((p: { id: string }) => p.id === item.productId);
                return (
                  <div key={i} className="text-sm">
                    <p className="font-medium text-[#111827]">{product?.name ?? 'Product'}</p>
                    <p className="text-[#656565]">{item.quantity} x {formatCurrency(item.sellPrice)} = {formatCurrency(item.sellPrice * item.quantity)}</p>
                    {item.tierLabel && (
                      <Badge variant="secondary" className="text-xs mt-0.5">{item.tierLabel}</Badge>
                    )}
                  </div>
                );
              })}
              {lineItems.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-[#656565]">Subtotal</span><span className="font-medium">{formatCurrency(subtotal)}</span></div>
                    {discountTotal > 0 && (
                      <div className="flex justify-between text-emerald-600"><span>Discounts</span><span>-{formatCurrency(discountTotal)}</span></div>
                    )}
                    {discountTotal < 0 && (
                      <div className="flex justify-between text-red-600"><span>Markup</span><span>+{formatCurrency(Math.abs(discountTotal))}</span></div>
                    )}
                    <Separator />
                    <div className="flex justify-between font-bold text-lg"><span>Total</span><span>{formatCurrency(total)}</span></div>
                  </div>
                </>
              )}
              {/* Admin-only margin info */}
              {isAdmin && lineItems.length > 0 && (
                <div className="text-xs text-emerald-700 bg-emerald-50 p-3 rounded-md border border-emerald-100">
                  <div className="flex items-center gap-1 font-medium mb-1">
                    <Badge variant="outline" className="text-xs text-emerald-700 border-emerald-300">Internal Only</Badge>
                  </div>
                  <div className="flex justify-between"><span>Buy Total:</span><span>{formatCurrency(buyTotal)}</span></div>
                  <div className="flex justify-between"><span>Margin:</span><span>{formatCurrency(marginTotal)}</span></div>
                  <div className="flex justify-between font-medium"><span>Margin %:</span><span>{marginPct.toFixed(1)}%</span></div>
                </div>
              )}
              <Button
                onClick={() => createOrder.mutate()}
                disabled={!physicianId || lineItems.length === 0 || createOrder.isPending || (isAdmin && !salesRepId)}
                className="w-full bg-[#FF9700] hover:bg-[#e88800] text-white font-semibold"
              >
                {createOrder.isPending ? 'Creating...' : 'Submit Order'}
              </Button>
              {createOrder.error && (
                <p className="text-sm text-red-500 text-center">{createOrder.error.message}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
