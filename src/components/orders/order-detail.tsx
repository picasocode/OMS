'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import { useAppStore } from '@/store/app-store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, FileText, CheckCircle, Truck, CircleDot, Download, DollarSign } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

const STATUS_LABELS: Record<string, string> = {
  order_placed: 'Order Placed',
  order_approved: 'Order Approved',
  paid: 'Paid',
  shipped: 'Shipped',
};

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    order_placed: 'bg-blue-100 text-blue-700',
    order_approved: 'bg-orange-100 text-orange-700',
    paid: 'bg-emerald-100 text-emerald-700',
    shipped: 'bg-purple-100 text-purple-700',
  };
  return (
    <Badge className={`${colors[status] ?? 'bg-gray-100 text-gray-700'} border-0`}>
      {STATUS_LABELS[status] ?? status.replace('_', ' ')}
    </Badge>
  );
}

const statusStages = ['order_placed', 'order_approved', 'paid', 'shipped'];

const stageIcons: Record<string, React.ReactNode> = {
  order_placed: <CircleDot className="h-5 w-5" />,
  order_approved: <CheckCircle className="h-5 w-5" />,
  paid: <DollarSign className="h-5 w-5" />,
  shipped: <Truck className="h-5 w-5" />,
};

const stageLabels: Record<string, string> = {
  order_placed: 'Order Placed',
  order_approved: 'Order Approved',
  paid: 'Paid',
  shipped: 'Shipped',
};

export default function OrderDetail() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const { selectedOrderId, setCurrentView } = useAppStore();
  const queryClient = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', selectedOrderId],
    queryFn: () => fetch(`/api/orders/${selectedOrderId}`).then((r) => r.json()),
    enabled: !!selectedOrderId,
  });

  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await fetch(`/api/orders/${selectedOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', selectedOrderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const generatePDF = (includeInternal: boolean) => {
    if (!order) return;

    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.setTextColor(5, 32, 147); // #052093
    doc.text('Biomedic Consulting', 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(101, 101, 101); // #656565
    doc.text('Order Management System', 14, 26);
    doc.text('Phone: (480) 209-0307 | Email: trevor@biomedicconsulting.com', 14, 31);

    // Order title
    doc.setFontSize(14);
    doc.setTextColor(5, 32, 147);
    doc.text(`Order ${order.orderNumber}`, 14, 42);

    // Divider
    doc.setDrawColor(200, 200, 200);
    doc.line(14, 45, 196, 45);

    // Order info
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    const orderDate = new Date(order.createdAt).toLocaleDateString();
    doc.text(`Order Date: ${orderDate}`, 14, 52);
    doc.text(`Status: ${STATUS_LABELS[order.status] ?? order.status.replace('_', ' ')}`, 14, 57);
    doc.text(`Sales Rep: ${order.salesRep?.name || ''}`, 14, 62);

    // Ship To
    doc.setFontSize(11);
    doc.setTextColor(5, 32, 147);
    doc.text('Ship To:', 120, 52);
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`${order.physician?.name}`, 120, 57);
    doc.text(`${order.physician?.practiceName}`, 120, 62);
    if (order.physician?.street) doc.text(`${order.physician.street}`, 120, 67);
    if (order.physician?.city || order.physician?.state) {
      doc.text(`${order.physician?.city || ''}, ${order.physician?.state || ''} ${order.physician?.zip || ''}`, 120, 72);
    }

    // Product table
    const tableY = 82;
    const columns = includeInternal
      ? [
          { header: 'Product', dataKey: 'product' },
          { header: 'Qty', dataKey: 'qty' },
          { header: 'Sell Price', dataKey: 'sellPrice' },
          { header: 'Buy Price', dataKey: 'buyPrice' },
          { header: 'Margin', dataKey: 'margin' },
          { header: 'Line Total', dataKey: 'lineTotal' },
        ]
      : [
          { header: 'Product', dataKey: 'product' },
          { header: 'Qty', dataKey: 'qty' },
          { header: 'Unit Price', dataKey: 'sellPrice' },
          { header: 'Line Total', dataKey: 'lineTotal' },
        ];

    const rows = (order.items ?? []).map((item: {
      product: { name: string }; quantity: number; sellPrice: number; buyPrice: number; margin: number; tierLabel: string | null;
    }) => {
      const base: Record<string, string> = {
        product: item.product?.name + (item.tierLabel ? ` (${item.tierLabel})` : ''),
        qty: String(item.quantity),
        sellPrice: formatCurrency(item.sellPrice),
        lineTotal: formatCurrency(item.sellPrice * item.quantity),
      };
      if (includeInternal) {
        base.buyPrice = formatCurrency(item.buyPrice);
        base.margin = formatCurrency(item.margin);
      }
      return base;
    });

    autoTable(doc, {
      columns,
      body: rows,
      startY: tableY,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [5, 32, 147], textColor: 255, fontStyle: 'bold' }, // #052093
      alternateRowStyles: { fillColor: [248, 248, 248] },
    });

    // Totals section
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? tableY + 40;
    let yPos = finalY + 10;

    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text('Subtotal:', 140, yPos);
    doc.setTextColor(5, 32, 147);
    doc.text(formatCurrency(order.subtotal), 170, yPos, { align: 'right' });

    if (order.discountTotal > 0) {
      yPos += 6;
      doc.setTextColor(34, 197, 94);
      doc.text('Discount:', 140, yPos);
      doc.text(`-${formatCurrency(order.discountTotal)}`, 170, yPos, { align: 'right' });
    }

    yPos += 6;
    doc.setTextColor(80, 80, 80);
    doc.text('Shipping:', 140, yPos);
    doc.text(formatCurrency(order.shippingCost), 170, yPos, { align: 'right' });

    yPos += 2;
    doc.setDrawColor(5, 32, 147);
    doc.setLineWidth(0.5);
    doc.line(140, yPos, 190, yPos);

    yPos += 7;
    doc.setFontSize(12);
    doc.setTextColor(5, 32, 147);
    doc.setFont('helvetica', 'bold');
    doc.text('Total:', 140, yPos);
    doc.text(formatCurrency(order.total), 170, yPos, { align: 'right' });
    doc.setFont('helvetica', 'normal');

    // Admin-only internal pricing section
    if (includeInternal) {
      yPos += 12;
      doc.setFillColor(240, 253, 244);
      doc.rect(14, yPos - 5, 182, 22, 'F');
      doc.setFontSize(9);
      doc.setTextColor(22, 163, 74);
      doc.setFont('helvetica', 'bold');
      doc.text('INTERNAL ONLY — Margin Breakdown', 18, yPos + 2);
      doc.setFont('helvetica', 'normal');
      doc.text(`Buy Total: ${formatCurrency(order.buyTotal)}`, 18, yPos + 8);
      const marginPct = order.total > 0 ? (order.marginTotal / order.total * 100).toFixed(1) : '0';
      doc.text(`Margin: ${formatCurrency(order.marginTotal)} (${marginPct}%)`, 100, yPos + 8);
    }

    // Notes
    if (order.notes) {
      yPos += (includeInternal ? 28 : 12);
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.text('Notes:', 14, yPos);
      doc.text(order.notes, 14, yPos + 5);
    }

    // Footer
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text('Biomedic Consulting — Order Management System', 14, pageHeight - 10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, pageHeight - 6);

    const filename = includeInternal
      ? `${order.orderNumber}_internal.pdf`
      : `${order.orderNumber}_physician.pdf`;

    doc.save(filename);
  };

  if (isLoading || !order) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-gray-300 border-t-[#052093] rounded-full" />
      </div>
    );
  }

  const currentStageIndex = statusStages.indexOf(order.status);

  const getNextStatus = () => {
    const idx = statusStages.indexOf(order.status);
    return idx < statusStages.length - 1 ? statusStages[idx + 1] : null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setCurrentView('orders')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold text-[#052093]">{order.orderNumber}</h2>
            <p className="text-[#656565] text-sm">{order.physician?.name} — {order.physician?.practiceName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={order.status} />
          {/* PDF downloads - Admin only */}
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={() => generatePDF(false)}>
                <Download className="h-4 w-4 mr-1" /> Physician Copy
              </Button>
              <Button variant="outline" size="sm" onClick={() => generatePDF(true)} className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                <FileText className="h-4 w-4 mr-1" /> Internal Copy
              </Button>
            </>
          )}
          {/* Status transition - Admin only (sales reps cannot approve/pay/ship) */}
          {getNextStatus() && isAdmin && (
            <Button
              size="sm"
              onClick={() => updateStatus.mutate(getNextStatus()!)}
              disabled={updateStatus.isPending}
              className="bg-[#052093] hover:bg-[#041a7a] text-white"
            >
              Mark as {stageLabels[getNextStatus()!]}
            </Button>
          )}
        </div>
      </div>

      {/* Status Timeline */}
      <Card className="border border-gray-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between relative">
            <div className="absolute top-5 left-[10%] right-[10%] h-1 bg-gray-200 rounded-full" />
            <div
              className="absolute top-5 left-[10%] h-1 bg-[#052093] rounded-full transition-all duration-500"
              style={{ width: `${currentStageIndex / (statusStages.length - 1) * 80}%` }}
            />
            {statusStages.map((stage, index) => (
              <div key={stage} className="flex flex-col items-center z-10 flex-1">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                  index <= currentStageIndex
                    ? 'bg-[#052093] border-[#052093] text-white'
                    : 'bg-white border-gray-200 text-gray-400'
                }`}>
                  {stageIcons[stage]}
                </div>
                <span className={`text-xs mt-2 font-medium ${
                  index <= currentStageIndex ? 'text-[#052093]' : 'text-gray-400'
                }`}>
                  {stageLabels[stage]}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Items */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border border-gray-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-[#052093]">Order Items</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Unit Price</TableHead>
                      {isAdmin && <TableHead className="text-emerald-600">Buy Price</TableHead>}
                      {isAdmin && <TableHead className="text-emerald-600">Margin</TableHead>}
                      <TableHead>Tier</TableHead>
                      <TableHead>Line Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.items?.map((item: {
                      id: string; product: { name: string }; quantity: number; sellPrice: number;
                      buyPrice: number; margin: number; tierLabel: string | null;
                    }) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-[#111827]">{item.product?.name}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{formatCurrency(item.sellPrice)}</TableCell>
                        {isAdmin && <TableCell className="text-emerald-600">{formatCurrency(item.buyPrice)}</TableCell>}
                        {isAdmin && <TableCell className="text-emerald-600">{formatCurrency(item.margin)}</TableCell>}
                        <TableCell>{item.tierLabel ? <Badge variant="secondary" className="text-xs">{item.tierLabel}</Badge> : '—'}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(item.sellPrice * item.quantity)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Discounts Applied */}
          {order.discounts?.length > 0 && (
            <Card className="border border-gray-200">
              <CardHeader className="pb-3"><CardTitle className="text-base text-[#052093]">Applied Discounts</CardTitle></CardHeader>
              <CardContent>
                {order.discounts.map((d: {
                  id: string; discountCode: { code: string; type: string; value: number; isMarkup: boolean }; appliedValue: number;
                }) => (
                  <div key={d.id} className="flex justify-between items-center py-2 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{d.discountCode?.code}</Badge>
                      <span className="text-sm text-[#656565]">
                        {d.discountCode?.type === 'percentage' ? `${d.discountCode.value}% ${d.discountCode.isMarkup ? 'markup' : 'off'}` : `$${d.discountCode.value} off`}
                      </span>
                    </div>
                    <span className={d.discountCode?.isMarkup ? 'text-red-600 font-medium' : 'text-emerald-600 font-medium'}>
                      {d.discountCode?.isMarkup ? '+' : '-'}{formatCurrency(Math.abs(d.appliedValue))}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Order Summary */}
        <div className="space-y-5">
          <Card className="border border-gray-200">
            <CardHeader className="pb-3"><CardTitle className="text-base text-[#052093]">Order Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm"><span className="text-[#656565]">Subtotal</span><span>{formatCurrency(order.subtotal)}</span></div>
              {order.discountTotal > 0 && (
                <div className="flex justify-between text-sm text-emerald-600"><span>Discounts</span><span>-{formatCurrency(order.discountTotal)}</span></div>
              )}
              <div className="flex justify-between text-sm"><span className="text-[#656565]">Shipping</span><span>{formatCurrency(order.shippingCost)}</span></div>
              <Separator />
              <div className="flex justify-between font-bold text-lg"><span>Total</span><span>{formatCurrency(order.total)}</span></div>
              {/* Admin-only margin info */}
              {isAdmin && (
                <div className="bg-emerald-50 p-3 rounded-lg text-sm text-emerald-700 border border-emerald-100">
                  <p className="font-medium mb-1">Internal Only</p>
                  <div className="flex justify-between"><span>Buy Total:</span><span>{formatCurrency(order.buyTotal)}</span></div>
                  <div className="flex justify-between"><span>Margin:</span><span>{formatCurrency(order.marginTotal)}</span></div>
                  <div className="flex justify-between font-medium"><span>Margin %:</span><span>{order.total > 0 ? (order.marginTotal / order.total * 100).toFixed(1) : '0'}%</span></div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardHeader className="pb-3"><CardTitle className="text-base text-[#052093]">Shipping Info</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <p className="font-medium text-[#111827]">{order.physician?.name}</p>
              <p className="text-[#656565]">{order.physician?.practiceName}</p>
              {order.physician?.street && <p className="text-[#656565]">{order.physician.street}</p>}
              {(order.physician?.city || order.physician?.state) && (
                <p className="text-[#656565]">{order.physician?.city}, {order.physician?.state} {order.physician?.zip}</p>
              )}
              {order.deliveryDate && <p className="mt-2"><strong>Est. Delivery:</strong> {order.deliveryDate}</p>}
            </CardContent>
          </Card>

          <Card className="border border-gray-200">
            <CardHeader className="pb-3"><CardTitle className="text-base text-[#052093]">Sales Rep</CardTitle></CardHeader>
            <CardContent className="text-sm">
              <p className="font-medium text-[#111827]">{order.salesRep?.name}</p>
              <p className="text-[#656565]">{order.salesRep?.email}</p>
              {order.salesRep?.phone && <p className="text-[#656565]">{order.salesRep.phone}</p>}
            </CardContent>
          </Card>

          {order.notes && (
            <Card className="border border-gray-200">
              <CardHeader className="pb-3"><CardTitle className="text-base text-[#052093]">Notes</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-[#656565]">{order.notes}</p></CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
