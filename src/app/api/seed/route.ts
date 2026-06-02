import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  createSalesRep,
  createPhysician,
  getProducts, createProduct,
  createDiscountCode,
  createOrder,
  jfDelete, FORM_IDS,
} from '@/lib/jotform';

// Helper: wipe all submissions in a form
async function wipeForm(formId: string) {
  const API_KEY = process.env.JOTFORM_API_KEY!;
  const BASE_URL = 'https://api.jotform.com';
  const res = await fetch(`${BASE_URL}/form/${formId}/submissions?apiKey=${API_KEY}&limit=1000`, {
    next: { revalidate: 0 },
  });
  const json = await res.json();
  if (json.responseCode !== 200) return;
  const subs: { id: string; status: string }[] = json.content ?? [];
  await Promise.all(
    subs
      .filter((s) => s.status === 'ACTIVE')
      .map((s) => jfDelete(s.id))
  );
}

// GET — check if JotForm has data
export const GET = requireAuth(async () => {
  try {
    const products = await getProducts();
    return NextResponse.json({
      seeded: products.length > 0,
      message: products.length > 0
        ? `JotForm has data: ${products.length} products`
        : 'JotForm is empty — use POST to seed',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ seeded: false, error: 'Seed check failed', details: message }, { status: 500 });
  }
}, ['admin']);

// POST — wipe all JotForm data and seed fresh
export const POST = requireAuth(async () => {
  try {
    // 1. Wipe all forms
    await Promise.all([
      wipeForm(FORM_IDS.salesReps),
      wipeForm(FORM_IDS.physicians),
      wipeForm(FORM_IDS.products),
      wipeForm(FORM_IDS.discounts),
      wipeForm(FORM_IDS.orders),
    ]);

    // 2. Sales Reps
    const [sarah, mike, emily] = await Promise.all([
      createSalesRep({ name: 'Sarah Johnson', email: 'sarah@biomedic.com', password: 'rep1234', phone: '(602) 555-0101', territory: 'Southwest', active: true }),
      createSalesRep({ name: 'Mike Chen',     email: 'mike@biomedic.com',  password: 'rep1234', phone: '(212) 555-0102', territory: 'Northeast', active: true }),
      createSalesRep({ name: 'Emily Rodriguez', email: 'emily@biomedic.com', password: 'rep1234', phone: '(305) 555-0103', territory: 'Southeast', active: true }),
    ]);

    // 3. Physicians
    const [wilson, santos, chang, rivera] = await Promise.all([
      createPhysician({ name: 'Dr. James Wilson',  practiceName: 'Pacific Spine Center',     email: 'wilson@pacificspine.com', phone: '(602) 555-1001', street: '1234 Desert Ridge Dr', city: 'Phoenix',  state: 'AZ', zip: '85054', salesRepId: sarah.id, active: true }),
      createPhysician({ name: 'Dr. Maria Santos',  practiceName: 'City Medical Group',        email: 'santos@citymed.com',       phone: '(602) 555-1002', street: '5678 Central Ave',    city: 'Tucson',   state: 'AZ', zip: '85701', salesRepId: sarah.id, active: true }),
      createPhysician({ name: 'Dr. Robert Chang',  practiceName: 'Northeast Pain Clinic',     email: 'chang@nepain.com',         phone: '(212) 555-2001', street: '345 Park Avenue',     city: 'New York', state: 'NY', zip: '10154', salesRepId: mike.id,  active: true }),
      createPhysician({ name: 'Dr. Carlos Rivera', practiceName: 'Miami Orthopedic Center',   email: 'rivera@miamiortho.com',    phone: '(305) 555-3001', street: '1295 Brickell Ave',   city: 'Miami',    state: 'FL', zip: '33131', salesRepId: emily.id, active: true }),
    ]);

    // 4. Products (MiniStim PNS — with tier pricing)
    const tiersPNS = [
      { id: 't1', minQty: 1,  maxQty: 12,  unitPrice: 7500, label: '1-12 units'  },
      { id: 't2', minQty: 13, maxQty: 29,  unitPrice: 7000, label: '13-29 units' },
      { id: 't3', minQty: 30, maxQty: null, unitPrice: 6500, label: '30+ units'  },
    ];

    const [pns7, pns12, , etx, nerveStim, cable, cathSet] = await Promise.all([
      createProduct({ name: 'pIPG Single System Kit (7cm)',            sku: 'NRO4-STM-07',      productLine: 'MiniStim PNS', buyPrice: 5500, sellPrice: 7500, unit: 'kit',      active: true, tiers: tiersPNS }),
      createProduct({ name: 'pIPG Single System Kit (12cm)',           sku: 'NRO4-STM-12',      productLine: 'MiniStim PNS', buyPrice: 5500, sellPrice: 7500, unit: 'kit',      active: true, tiers: tiersPNS }),
      createProduct({ name: 'pIPG Single System Kit (20cm)',           sku: 'NRO4-STM-20',      productLine: 'MiniStim PNS', buyPrice: 5500, sellPrice: 7500, unit: 'kit',      active: true, tiers: tiersPNS }),
      createProduct({ name: 'ETx Transmitter Kit',                     sku: 'MNRO-915-1k',      productLine: 'MiniStim PNS', buyPrice: 2800, sellPrice: 4000, unit: 'kit',      active: true, tiers: [] }),
      createProduct({ name: 'Nerve Stimulator',                        sku: 'B170450+NMS450X',  productLine: 'StimuCath',    buyPrice: 1400, sellPrice: 2050, unit: 'each',     active: true, tiers: [] }),
      createProduct({ name: 'Stimpod Nerve Mapping/Locating Cable',    sku: 'B170461',           productLine: 'StimuCath',    buyPrice:  170, sellPrice:  250, unit: 'each',     active: true, tiers: [] }),
      createProduct({ name: 'Teleflex Stimulating Catheter Set',       sku: 'AB-05060-PK',       productLine: 'StimuCath',    buyPrice:  650, sellPrice:  970, unit: 'box of 5', active: true, tiers: [] }),
    ]);

    // 5. Discount Codes
    const [welcome] = await Promise.all([
      createDiscountCode({ code: 'WELCOME10', description: '10% off for new customers',    type: 'percentage', value: 10, productLine: null,          expiresAt: '2026-12-31T00:00:00.000Z', maxUses: 50,  currentUses: 0, stackable: false, active: true, isMarkup: false, createdBy: 'admin' }),
      createDiscountCode({ code: 'MINISTIM5', description: '5% off MiniStim products',     type: 'percentage', value:  5, productLine: 'MiniStim PNS', expiresAt: '2026-09-30T00:00:00.000Z', maxUses: 100, currentUses: 0, stackable: false, active: true, isMarkup: false, createdBy: 'admin' }),
      createDiscountCode({ code: 'BULK300',   description: '$300 off bulk orders',          type: 'fixed',      value: 300, productLine: null,         expiresAt: null,                        maxUses: 200, currentUses: 0, stackable: true,  active: true, isMarkup: false, createdBy: 'admin' }),
    ]);

    // 6. Sample Orders
    const now = Date.now();
    const daysMs = (d: number) => d * 24 * 60 * 60 * 1000;

    await Promise.all([
      // Order 1 — shipped, Sarah/Wilson, pns7 x2, WELCOME10 10% off
      createOrder({
        orderNumber: 'BIO-1001',
        physicianId: wilson.id,
        salesRepId: sarah.id,
        status: 'shipped',
        subtotal: 15000,
        discountTotal: 1500,
        shippingCost: 0,
        total: 13500,
        buyTotal: 11000,
        marginTotal: 2500,
        deliveryDate: null,
        notes: null,
        items: [{ productId: pns7.id, quantity: 2, buyPrice: 5500, sellPrice: 7500, margin: 2000, tierLabel: '1-12 units' }],
        discounts: [{ discountCodeId: welcome.id, appliedValue: 1500 }],
        approvedAt: new Date(now - daysMs(43)).toISOString(),
        paidAt:     new Date(now - daysMs(42)).toISOString(),
        shippedAt:  new Date(now - daysMs(40)).toISOString(),
      }),

      // Order 2 — paid, Mike/Chang, etx x1 + nerveStim x5
      createOrder({
        orderNumber: 'BIO-1002',
        physicianId: chang.id,
        salesRepId: mike.id,
        status: 'paid',
        subtotal: 14250,
        discountTotal: 0,
        shippingCost: 0,
        total: 14250,
        buyTotal: 9800,
        marginTotal: 4450,
        deliveryDate: null,
        notes: null,
        items: [
          { productId: etx.id,       quantity: 1, buyPrice: 2800, sellPrice: 4000, margin: 1200, tierLabel: null },
          { productId: nerveStim.id, quantity: 5, buyPrice: 1400, sellPrice: 2050, margin:  650, tierLabel: null },
        ],
        discounts: [],
        approvedAt: new Date(now - daysMs(10)).toISOString(),
        paidAt:     new Date(now - daysMs(9)).toISOString(),
        shippedAt: null,
      }),

      // Order 3 — order_approved, Emily/Rivera, pns12 x15
      createOrder({
        orderNumber: 'BIO-1003',
        physicianId: rivera.id,
        salesRepId: emily.id,
        status: 'order_approved',
        subtotal: 105000,
        discountTotal: 0,
        shippingCost: 0,
        total: 105000,
        buyTotal: 82500,
        marginTotal: 22500,
        deliveryDate: null,
        notes: null,
        items: [{ productId: pns12.id, quantity: 15, buyPrice: 5500, sellPrice: 7000, margin: 1500, tierLabel: '13-29 units' }],
        discounts: [],
        approvedAt: new Date(now - daysMs(2)).toISOString(),
        paidAt: null,
        shippedAt: null,
      }),

      // Order 4 — order_placed, Sarah/Santos, cathSet x3 + cable x2
      createOrder({
        orderNumber: 'BIO-1004',
        physicianId: santos.id,
        salesRepId: sarah.id,
        status: 'order_placed',
        subtotal: 3410,
        discountTotal: 0,
        shippingCost: 0,
        total: 3410,
        buyTotal: 2290,
        marginTotal: 1120,
        deliveryDate: null,
        notes: null,
        items: [
          { productId: cathSet.id, quantity: 3, buyPrice: 650, sellPrice: 970, margin: 320, tierLabel: null },
          { productId: cable.id,   quantity: 2, buyPrice: 170, sellPrice: 250, margin:  80, tierLabel: null },
        ],
        discounts: [],
        approvedAt: null,
        paidAt: null,
        shippedAt: null,
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: 'JotForm seeded successfully! Created: 3 sales reps, 4 physicians, 7 products, 3 discount codes, 4 orders',
      credentials: {
        admin: 'admin@biomedic.com / BioMedic2024!',
        reps: [
          `${sarah.email} / rep1234`,
          `${mike.email} / rep1234`,
          `${emily.email} / rep1234`,
        ],
      },
    });
  } catch (error) {
    console.error('Error seeding JotForm:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to seed JotForm', details: message }, { status: 500 });
  }
}, ['admin']);
