import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Clean existing data
  await prisma.auditLog.deleteMany();
  await prisma.orderDiscount.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.tier.deleteMany();
  await prisma.discountCode.deleteMany();
  await prisma.product.deleteMany();
  await prisma.physician.deleteMany();
  await prisma.salesRep.deleteMany();

  // Sales Reps
  const reps = await Promise.all([
    prisma.salesRep.create({ data: { name: "Sarah Johnson", email: "sarah@biomedic.com", password: "rep1234", phone: "(602) 555-0101", territory: "Southwest" } }),
    prisma.salesRep.create({ data: { name: "Mike Chen", email: "mike@biomedic.com", password: "rep1234", phone: "(212) 555-0102", territory: "Northeast" } }),
    prisma.salesRep.create({ data: { name: "Emily Rodriguez", email: "emily@biomedic.com", password: "rep1234", phone: "(305) 555-0103", territory: "Southeast" } }),
  ]);

  // Admin sales rep for login
  await prisma.salesRep.create({ data: { name: "Admin", email: "admin@biomedic.com", password: "BioMedic2024!", phone: "(480) 209-0307", territory: "All" } });

  // Physicians
  const physicians = await Promise.all([
    prisma.physician.create({ data: { name: "Dr. James Wilson", practiceName: "Pacific Spine Center", email: "wilson@pacificspine.com", phone: "(602) 555-1001", street: "1234 Desert Ridge Dr", city: "Phoenix", state: "AZ", zip: "85054", salesRepId: reps[0].id } }),
    prisma.physician.create({ data: { name: "Dr. Maria Santos", practiceName: "City Medical Group", email: "santos@citymed.com", phone: "(602) 555-1002", street: "5678 Central Ave", city: "Tucson", state: "AZ", zip: "85701", salesRepId: reps[0].id } }),
    prisma.physician.create({ data: { name: "Dr. Robert Chang", practiceName: "Northeast Pain Clinic", email: "chang@nepain.com", phone: "(212) 555-2001", street: "345 Park Avenue", city: "New York", state: "NY", zip: "10154", salesRepId: reps[1].id } }),
    prisma.physician.create({ data: { name: "Dr. Carlos Rivera", practiceName: "Miami Orthopedic Center", email: "rivera@miamiortho.com", phone: "(305) 555-3001", street: "1295 Brickell Ave", city: "Miami", state: "FL", zip: "33131", salesRepId: reps[2].id } }),
  ]);

  // Products - MiniStim PNS
  const pns7 = await prisma.product.create({ data: { name: "pIPG Single System Kit (7cm)", sku: "NRO4-STM-07", productLine: "MiniStim PNS", buyPrice: 5500, sellPrice: 7500, unit: "kit" } });
  const pns12 = await prisma.product.create({ data: { name: "pIPG Single System Kit (12cm)", sku: "NRO4-STM-12", productLine: "MiniStim PNS", buyPrice: 5500, sellPrice: 7500, unit: "kit" } });
  const pns20 = await prisma.product.create({ data: { name: "pIPG Single System Kit (20cm)", sku: "NRO4-STM-20", productLine: "MiniStim PNS", buyPrice: 5500, sellPrice: 7500, unit: "kit" } });
  const etx = await prisma.product.create({ data: { name: "ETx Transmitter Kit", sku: "MNRO-915-1k", productLine: "MiniStim PNS", buyPrice: 2800, sellPrice: 4000, unit: "kit" } });

  // Products - StimuCath
  const nerveStim = await prisma.product.create({ data: { name: "Nerve Stimulator", sku: "B170450+NMS450X", productLine: "StimuCath", buyPrice: 1400, sellPrice: 2050, unit: "each" } });
  const cable = await prisma.product.create({ data: { name: "Stimpod Nerve Mapping/Locating Cable", sku: "B170461", productLine: "StimuCath", buyPrice: 170, sellPrice: 250, unit: "each" } });
  const cathSet = await prisma.product.create({ data: { name: "Teleflex Stimulating Catheter Set", sku: "AB-05060-PK", productLine: "StimuCath", buyPrice: 650, sellPrice: 970, unit: "box of 5" } });

  // Tier pricing for MiniStim PNS Kits
  for (const pnsKit of [pns7, pns12, pns20]) {
    await Promise.all([
      prisma.tier.create({ data: { productId: pnsKit.id, minQty: 1, maxQty: 12, unitPrice: 7500, label: "1-12 units" } }),
      prisma.tier.create({ data: { productId: pnsKit.id, minQty: 13, maxQty: 29, unitPrice: 7000, label: "13-29 units" } }),
      prisma.tier.create({ data: { productId: pnsKit.id, minQty: 30, maxQty: null, unitPrice: 6500, label: "30+ units" } }),
    ]);
  }

  // Discount Codes
  await Promise.all([
    prisma.discountCode.create({ data: { code: "WELCOME10", description: "10% off for new customers", type: "percentage", value: 10, productLine: null, expiresAt: new Date("2026-12-31"), maxUses: 50, currentUses: 0, stackable: false, isMarkup: false } }),
    prisma.discountCode.create({ data: { code: "MINISTIM5", description: "5% off MiniStim products", type: "percentage", value: 5, productLine: "MiniStim PNS", expiresAt: new Date("2026-09-30"), maxUses: 100, currentUses: 0, stackable: false, isMarkup: false } }),
    prisma.discountCode.create({ data: { code: "BULK300", description: "$300 off bulk orders", type: "fixed", value: 300, productLine: null, expiresAt: null, maxUses: 200, currentUses: 0, stackable: true, isMarkup: false } }),
  ]);

  // Sample Orders
  const orderData = [
    { physicianId: physicians[0].id, salesRepId: reps[0].id, status: "shipped", items: [{ productId: pns7.id, qty: 2, sell: 7500, buy: 5500, tier: "1-12 units" }], discountCode: "WELCOME10", discountVal: 1500, daysAgo: 45 },
    { physicianId: physicians[2].id, salesRepId: reps[1].id, status: "paid", items: [{ productId: etx.id, qty: 1, sell: 4000, buy: 2800, tier: null }, { productId: nerveStim.id, qty: 5, sell: 2050, buy: 1400, tier: null }], discountCode: null, discountVal: 0, daysAgo: 12 },
    { physicianId: physicians[3].id, salesRepId: reps[2].id, status: "order_approved", items: [{ productId: pns12.id, qty: 15, sell: 7000, buy: 5500, tier: "13-29 units" }], discountCode: null, discountVal: 0, daysAgo: 3 },
    { physicianId: physicians[1].id, salesRepId: reps[0].id, status: "order_placed", items: [{ productId: cathSet.id, qty: 3, sell: 970, buy: 650, tier: null }, { productId: cable.id, qty: 2, sell: 250, buy: 170, tier: null }], discountCode: null, discountVal: 0, daysAgo: 1 },
  ];

  let orderCounter = 1001;
  for (const od of orderData) {
    const items = od.items.map(i => ({
      subtotal: i.sell * i.qty,
      buyTotal: i.buy * i.qty,
      margin: (i.sell - i.buy) * i.qty,
    }));
    const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
    const buyTotal = items.reduce((s, i) => s + i.buyTotal, 0);
    const marginTotal = items.reduce((s, i) => s + i.margin, 0);
    const total = subtotal - od.discountVal;

    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - od.daysAgo);

    const order = await prisma.order.create({
      data: {
        orderNumber: `BIO-${orderCounter}`,
        physicianId: od.physicianId,
        salesRepId: od.salesRepId,
        status: od.status,
        subtotal,
        discountTotal: od.discountVal,
        shippingCost: 0,
        total,
        buyTotal,
        marginTotal: marginTotal - od.discountVal,
        createdAt,
        approvedAt: ["order_approved", "paid", "shipped"].includes(od.status) ? new Date(createdAt.getTime() + 86400000) : null,
        paidAt: ["paid", "shipped"].includes(od.status) ? new Date(createdAt.getTime() + 86400000 * 3) : null,
        shippedAt: od.status === "shipped" ? new Date(createdAt.getTime() + 86400000 * 5) : null,
        items: {
          create: od.items.map(i => ({
            productId: i.productId,
            quantity: i.qty,
            buyPrice: i.buy,
            sellPrice: i.sell,
            margin: i.sell - i.buy,
            tierLabel: i.tier,
          })),
        },
      },
    });

    if (od.discountCode) {
      const dc = await prisma.discountCode.findUnique({ where: { code: od.discountCode } });
      if (dc) {
        await prisma.orderDiscount.create({
          data: { orderId: order.id, discountCodeId: dc.id, appliedValue: od.discountVal },
        });
      }
    }

    orderCounter++;
  }

  console.log("Seed completed successfully!");
  console.log(`Created: ${reps.length + 1} reps (incl. admin), ${physicians.length} physicians, 7 products, 3 discount codes, ${orderData.length} orders`);
  console.log("Admin login: admin@biomedic.com / BioMedic2024!");
  console.log("Rep login: sarah@biomedic.com / rep1234");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
