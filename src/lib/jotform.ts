/**
 * JotForm Backend Client — Single Source of Truth
 * Uses JotForm submissions as a NoSQL data store.
 * Each submission stores a JSON blob in field 7 (q7_textbox5).
 * The _submissionId is the JotForm submission ID used for updates/deletes.
 * The id field is our own stable app-level ID stored inside the JSON.
 */

const API_KEY = process.env.JOTFORM_API_KEY!;
const BASE_URL = 'https://api.jotform.com';
const DATA_FIELD = '7';

export const FORM_IDS = {
  orders:     process.env.JOTFORM_ORDERS_FORM_ID!,
  physicians: process.env.JOTFORM_PHYSICIANS_FORM_ID!,
  salesReps:  process.env.JOTFORM_SALES_REPS_FORM_ID!,
  products:   process.env.JOTFORM_PRODUCTS_FORM_ID!,
  discounts:  process.env.JOTFORM_DISCOUNTS_FORM_ID!,
};

// ─── Core helpers ─────────────────────────────────────────────────────────────

async function jfGet(path: string) {
  const res = await fetch(`${BASE_URL}${path}?apiKey=${API_KEY}&limit=1000`, {
    next: { revalidate: 0 },
  });
  const json = await res.json();
  if (json.responseCode !== 200) throw new Error(json.message || 'JotForm GET failed');
  return json.content;
}

async function jfPost(path: string, body: string) {
  const res = await fetch(`${BASE_URL}${path}?apiKey=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json();
  if (json.responseCode !== 200 && json.responseCode !== 201) {
    throw new Error(json.message || 'JotForm POST failed');
  }
  return json.content;
}

function encodeData(data: Record<string, unknown>): string {
  return `submission[${DATA_FIELD}]=${encodeURIComponent(JSON.stringify(data))}`;
}

interface JotFormSubmission {
  id: string;
  status: string;
  answers?: Record<string, { answer?: string }>;
}

function parseSubmission(sub: JotFormSubmission): Record<string, unknown> | null {
  try {
    const raw = sub.answers?.[DATA_FIELD]?.answer;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { ...parsed, _submissionId: sub.id };
  } catch {
    return null;
  }
}

// ─── Generic CRUD ─────────────────────────────────────────────────────────────

export async function jfList(formId: string): Promise<Record<string, unknown>[]> {
  const subs: JotFormSubmission[] = await jfGet(`/form/${formId}/submissions`);
  return subs
    .filter((s) => s.status === 'ACTIVE')
    .map(parseSubmission)
    .filter(Boolean) as Record<string, unknown>[];
}

export async function jfCreate(formId: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const result = await jfPost(`/form/${formId}/submissions`, encodeData(data));
  return { ...data, _submissionId: result.submissionID };
}

export async function jfUpdate(submissionId: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  await jfPost(`/submission/${submissionId}`, encodeData(data));
  return { ...data, _submissionId: submissionId };
}

export async function jfDelete(submissionId: string): Promise<void> {
  await fetch(`${BASE_URL}/submission/${submissionId}?apiKey=${API_KEY}`, { method: 'DELETE' });
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type JFSalesRep = {
  id: string;
  _submissionId: string;
  name: string;
  email: string;
  password: string;
  phone: string | null;
  territory: string | null;
  active: boolean;
  createdAt: string;
};

export type JFPhysician = {
  id: string;
  _submissionId: string;
  name: string;
  practiceName: string;
  email: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  salesRepId: string;
  salesRep?: { id: string; name: string; email: string } | null;
  active: boolean;
  createdAt: string;
  _count?: { orders: number };
};

export type JFTier = {
  id: string;
  minQty: number;
  maxQty: number | null;
  unitPrice: number;
  label: string;
};

export type JFProduct = {
  id: string;
  _submissionId: string;
  name: string;
  sku: string;
  productLine: string;
  buyPrice: number;
  sellPrice: number;
  unit: string;
  active: boolean;
  tiers: JFTier[];
  createdAt: string;
};

export type JFDiscountCode = {
  id: string;
  _submissionId: string;
  code: string;
  description: string | null;
  type: string;
  value: number;
  productLine: string | null;
  expiresAt: string | null;
  maxUses: number | null;
  currentUses: number;
  stackable: boolean;
  active: boolean;
  isMarkup: boolean;
  createdBy: string | null;
  createdAt: string;
};

export type JFOrderItem = {
  productId: string;
  quantity: number;
  buyPrice: number;
  sellPrice: number;
  margin: number;
  tierLabel: string | null;
  product?: JFProduct | null;
};

export type JFOrderDiscount = {
  discountCodeId: string;
  appliedValue: number;
  discountCode?: JFDiscountCode | null;
};

export type JFOrder = {
  id: string;
  _submissionId: string;
  orderNumber: string;
  physicianId: string;
  salesRepId: string;
  status: string;
  subtotal: number;
  discountTotal: number;
  shippingCost: number;
  total: number;
  buyTotal: number;
  marginTotal: number;
  deliveryDate: string | null;
  notes: string | null;
  items: JFOrderItem[];
  discounts: JFOrderDiscount[];
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  paidAt: string | null;
  shippedAt: string | null;
  physician?: JFPhysician | null;
  salesRep?: Omit<JFSalesRep, 'password'> | null;
};

// ─── Sales Reps ───────────────────────────────────────────────────────────────

export async function getSalesReps(): Promise<JFSalesRep[]> {
  const recs = await jfList(FORM_IDS.salesReps);
  return (recs as unknown as JFSalesRep[]).filter((r) => r.active !== false);
}

export async function getSalesRepById(id: string): Promise<JFSalesRep | null> {
  const reps = await getSalesReps();
  return reps.find((r) => r.id === id) ?? null;
}

export async function getSalesRepByEmail(email: string): Promise<JFSalesRep | null> {
  const recs = await jfList(FORM_IDS.salesReps);
  const all = recs as unknown as JFSalesRep[];
  return all.find((r) => r.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function createSalesRep(
  data: Omit<JFSalesRep, 'id' | '_submissionId' | 'createdAt'>
): Promise<JFSalesRep> {
  const id = genId('rep');
  const record = { ...data, id, createdAt: new Date().toISOString() };
  const result = await jfCreate(FORM_IDS.salesReps, record as unknown as Record<string, unknown>);
  return result as unknown as JFSalesRep;
}

export async function updateSalesRep(id: string, data: Partial<JFSalesRep>): Promise<JFSalesRep> {
  // Must fetch from all (including inactive) to find submission
  const recs = await jfList(FORM_IDS.salesReps);
  const existing = (recs as unknown as JFSalesRep[]).find((r) => r.id === id);
  if (!existing) throw new Error('Sales rep not found');
  const updated = { ...existing, ...data, id };
  await jfUpdate(existing._submissionId, updated as unknown as Record<string, unknown>);
  return updated as JFSalesRep;
}

// ─── Physicians ───────────────────────────────────────────────────────────────

export async function getPhysicians(salesRepId?: string): Promise<JFPhysician[]> {
  const recs = await jfList(FORM_IDS.physicians);
  const all = (recs as unknown as JFPhysician[]).filter((p) => p.active !== false);
  if (salesRepId) return all.filter((p) => p.salesRepId === salesRepId);
  return all;
}

export async function getPhysicianById(id: string): Promise<JFPhysician | null> {
  const recs = await jfList(FORM_IDS.physicians);
  return (recs as unknown as JFPhysician[]).find((p) => p.id === id) ?? null;
}

export async function createPhysician(
  data: Omit<JFPhysician, 'id' | '_submissionId' | 'createdAt' | 'salesRep' | '_count'>
): Promise<JFPhysician> {
  const id = genId('phy');
  const record = { ...data, id, active: true, createdAt: new Date().toISOString() };
  const result = await jfCreate(FORM_IDS.physicians, record as unknown as Record<string, unknown>);
  return result as unknown as JFPhysician;
}

export async function updatePhysician(id: string, data: Partial<JFPhysician>): Promise<JFPhysician> {
  const recs = await jfList(FORM_IDS.physicians);
  const existing = (recs as unknown as JFPhysician[]).find((p) => p.id === id);
  if (!existing) throw new Error('Physician not found');
  const cleanData = { ...data };
  delete cleanData.salesRep;
  delete cleanData._count;
  const updated = { ...existing, ...cleanData, id };
  await jfUpdate(existing._submissionId, updated as unknown as Record<string, unknown>);
  return updated as JFPhysician;
}

export async function softDeletePhysician(id: string): Promise<void> {
  const recs = await jfList(FORM_IDS.physicians);
  const existing = (recs as unknown as JFPhysician[]).find((p) => p.id === id);
  if (!existing) throw new Error('Physician not found');
  await jfUpdate(existing._submissionId, { ...existing, active: false } as unknown as Record<string, unknown>);
}

// ─── Products ─────────────────────────────────────────────────────────────────

export async function getProducts(): Promise<JFProduct[]> {
  const recs = await jfList(FORM_IDS.products);
  return (recs as unknown as JFProduct[]).filter((p) => p.active !== false);
}

export async function getProductById(id: string): Promise<JFProduct | null> {
  const products = await getProducts();
  return products.find((p) => p.id === id) ?? null;
}

export async function getProductsByIds(ids: string[]): Promise<JFProduct[]> {
  const products = await getProducts();
  return products.filter((p) => ids.includes(p.id));
}

export async function createProduct(
  data: Omit<JFProduct, 'id' | '_submissionId' | 'createdAt'>
): Promise<JFProduct> {
  const id = genId('prod');
  const record = { ...data, id, active: true, createdAt: new Date().toISOString() };
  const result = await jfCreate(FORM_IDS.products, record as unknown as Record<string, unknown>);
  return result as unknown as JFProduct;
}

export async function updateProduct(id: string, data: Partial<JFProduct>): Promise<JFProduct> {
  const recs = await jfList(FORM_IDS.products);
  const existing = (recs as unknown as JFProduct[]).find((p) => p.id === id);
  if (!existing) throw new Error('Product not found');
  const updated = { ...existing, ...data, id };
  await jfUpdate(existing._submissionId, updated as unknown as Record<string, unknown>);
  return updated as JFProduct;
}

// ─── Discount Codes ───────────────────────────────────────────────────────────

export async function getDiscountCodes(): Promise<JFDiscountCode[]> {
  const recs = await jfList(FORM_IDS.discounts);
  return recs as unknown as JFDiscountCode[];
}

export async function getDiscountCodeByCode(code: string): Promise<JFDiscountCode | null> {
  const codes = await getDiscountCodes();
  return codes.find((c) => c.code?.toUpperCase() === code.toUpperCase()) ?? null;
}

export async function getDiscountCodeById(id: string): Promise<JFDiscountCode | null> {
  const codes = await getDiscountCodes();
  return codes.find((c) => c.id === id) ?? null;
}

export async function createDiscountCode(
  data: Omit<JFDiscountCode, 'id' | '_submissionId' | 'createdAt'>
): Promise<JFDiscountCode> {
  const id = genId('disc');
  const record = { ...data, id, createdAt: new Date().toISOString() };
  const result = await jfCreate(FORM_IDS.discounts, record as unknown as Record<string, unknown>);
  return result as unknown as JFDiscountCode;
}

export async function updateDiscountCode(id: string, data: Partial<JFDiscountCode>): Promise<JFDiscountCode> {
  const codes = await getDiscountCodes();
  const existing = codes.find((c) => c.id === id);
  if (!existing) throw new Error('Discount code not found');
  const updated = { ...existing, ...data, id };
  await jfUpdate(existing._submissionId, updated as unknown as Record<string, unknown>);
  return updated as JFDiscountCode;
}

export async function incrementDiscountUsage(id: string): Promise<void> {
  const codes = await getDiscountCodes();
  const existing = codes.find((c) => c.id === id);
  if (!existing) return;
  const updated = { ...existing, currentUses: (existing.currentUses || 0) + 1 };
  await jfUpdate(existing._submissionId, updated as unknown as Record<string, unknown>);
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export async function getOrders(filters?: {
  salesRepId?: string;
  status?: string;
  search?: string;
}): Promise<JFOrder[]> {
  const recs = await jfList(FORM_IDS.orders);
  let orders = recs as unknown as JFOrder[];

  if (filters?.salesRepId) {
    orders = orders.filter((o) => o.salesRepId === filters.salesRepId);
  }
  if (filters?.status) {
    orders = orders.filter((o) => o.status === filters.status);
  }
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    orders = orders.filter((o) => o.orderNumber?.toLowerCase().includes(s));
  }

  return orders.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getOrderById(id: string): Promise<JFOrder | null> {
  const orders = await getOrders();
  return orders.find((o) => o.id === id) ?? null;
}

export async function getLastOrderNumber(): Promise<number> {
  const orders = await getOrders();
  if (orders.length === 0) return 1000;
  const nums = orders
    .map((o) => parseInt(o.orderNumber?.replace('BIO-', '') ?? '0'))
    .filter((n) => !isNaN(n));
  return Math.max(...nums, 1000);
}

export async function createOrder(
  data: Omit<JFOrder, 'id' | '_submissionId' | 'createdAt' | 'updatedAt' | 'physician' | 'salesRep'>
): Promise<JFOrder> {
  const id = genId('ord');
  const now = new Date().toISOString();
  const record = { ...data, id, createdAt: now, updatedAt: now };
  const result = await jfCreate(FORM_IDS.orders, record as unknown as Record<string, unknown>);
  return result as unknown as JFOrder;
}

export async function updateOrder(id: string, data: Partial<JFOrder>): Promise<JFOrder> {
  const orders = await getOrders();
  const existing = orders.find((o) => o.id === id);
  if (!existing) throw new Error('Order not found');
  const cleanData = { ...data };
  delete cleanData.physician;
  delete cleanData.salesRep;
  const updated = { ...existing, ...cleanData, id, updatedAt: new Date().toISOString() };
  await jfUpdate(existing._submissionId, updated as unknown as Record<string, unknown>);
  return updated as JFOrder;
}

// ─── Enrichment helpers ───────────────────────────────────────────────────────

/** Attach physician and salesRep objects to an order */
export async function enrichOrder(order: JFOrder): Promise<JFOrder> {
  const [physician, salesRep, products, discountCodes] = await Promise.all([
    getPhysicianById(order.physicianId),
    getSalesRepById(order.salesRepId),
    getProducts(),
    getDiscountCodes(),
  ]);

  // Enrich physician with its salesRep
  let enrichedPhysician: JFPhysician | null = null;
  if (physician) {
    const phyRep = await getSalesRepById(physician.salesRepId);
    enrichedPhysician = {
      ...physician,
      salesRep: phyRep ? { id: phyRep.id, name: phyRep.name, email: phyRep.email } : null,
    };
  }

  // Enrich items with product data
  const enrichedItems = order.items.map((item) => ({
    ...item,
    product: products.find((p) => p.id === item.productId) ?? null,
  }));

  // Enrich discounts with discount code data
  const enrichedDiscounts = order.discounts.map((d) => ({
    ...d,
    discountCode: discountCodes.find((c) => c.id === d.discountCodeId) ?? null,
  }));

  const safeRep: Partial<JFSalesRep> | null = salesRep ? { ...salesRep } : null;
  if (safeRep) delete safeRep.password;

  return {
    ...order,
    physician: enrichedPhysician,
    salesRep: safeRep as Omit<JFSalesRep, 'password'> | null,
    items: enrichedItems,
    discounts: enrichedDiscounts,
  };
}

/** Attach physician and salesRep to multiple orders */
export async function enrichOrders(orders: JFOrder[]): Promise<JFOrder[]> {
  const [physicians, salesReps, products, discountCodes] = await Promise.all([
    jfList(FORM_IDS.physicians).then((r) => r as unknown as JFPhysician[]),
    getSalesReps(),
    getProducts(),
    getDiscountCodes(),
  ]);

  return orders.map((order) => {
    const physician = physicians.find((p) => p.id === order.physicianId) ?? null;
    const salesRep = salesReps.find((r) => r.id === order.salesRepId) ?? null;

    let enrichedPhysician: JFPhysician | null = null;
    if (physician) {
      const phyRep = salesReps.find((r) => r.id === physician.salesRepId);
      enrichedPhysician = {
        ...physician,
        salesRep: phyRep ? { id: phyRep.id, name: phyRep.name, email: phyRep.email } : null,
      };
    }

    const enrichedItems = order.items.map((item) => ({
      ...item,
      product: products.find((p) => p.id === item.productId) ?? null,
    }));

    const enrichedDiscounts = order.discounts.map((d) => ({
      ...d,
      discountCode: discountCodes.find((c) => c.id === d.discountCodeId) ?? null,
    }));

    const safeRep: Partial<JFSalesRep> | null = salesRep ? { ...salesRep } : null;
    if (safeRep) delete safeRep.password;

    return {
      ...order,
      physician: enrichedPhysician,
      salesRep: safeRep as Omit<JFSalesRep, 'password'> | null,
      items: enrichedItems,
      discounts: enrichedDiscounts,
    };
  });
}
