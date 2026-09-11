import type { SupabaseClient } from "@supabase/supabase-js";
import { computeLeadScore } from "@/lib/scoring";
import { computeLine, computeTotals } from "@/lib/tax";

/**
 * Realistic Indian SMB demo data ("Sharma Distributors" sample dataset).
 * Generates: warehouse, categories, 25 products, 30 customers, 50 leads,
 * 20 opportunities, 10 quotations, 20 orders, 15 invoices, 20 follow-ups,
 * activities and notifications — enough to make the dashboard look alive.
 */
export async function seedDemoData(orgId: string, userId: string, db: SupabaseClient) {
  const now = new Date();

  const branchRows = await db.from("branches").select("id").eq("organization_id", orgId);
  const branchId = branchRows.data?.[0]?.id ?? null;

  const warehouse = await db
    .from("warehouses")
    .insert({ organization_id: orgId, branch_id: branchId, name: "Central Warehouse" })
    .select()
    .single();

  const categoryNames = [
    "Pipes & Fittings",
    "Electrical",
    "Plumbing",
    "Hardware",
    "Industrial",
    "Building Materials",
  ];
  const categories: Record<string, string> = {};
  for (const c of categoryNames) {
    const { data } = await db
      .from("product_categories")
      .insert({ organization_id: orgId, name: c })
      .select()
      .single();
    if (data) categories[c] = data.id;
  }

  // ------------------------------------------------------------------ products
  const productDefs: Array<[string, string, string, string, number, number, number]> = [
    ["PPR-PIPE-20", "PPR Pipe 20mm", "Pipes & Fittings", "piece", 85, 120, 18],
    ["PVC-PIPE-15", "PVC Pipe 1/2 inch", "Pipes & Fittings", "piece", 45, 68, 18],
    ["HDPE-GRN-25", "HDPE Granules 25kg", "Industrial", "bag", 1400, 1750, 18],
    ["GI-WIRE-16", "GI Wire 16 Gauge", "Hardware", "kg", 95, 135, 18],
    ["MS-SHEET-3", "MS Sheet 3mm", "Building Materials", "sheet", 1850, 2350, 18],
    ["COP-WIRE-1P5", "Copper Wire 1.5 sq mm", "Electrical", "roll", 3200, 3990, 18],
    ["CABLE-4SQ", "Cable 4 sq mm 90m", "Electrical", "roll", 2850, 3590, 18],
    ["LED-BULB-9", "LED Bulb 9W", "Electrical", "piece", 95, 160, 18],
    ["CFAN-1200", "Ceiling Fan 1200mm", "Electrical", "piece", 1450, 2190, 18],
    ["W-PUMP-1HP", "Water Pump 1HP", "Industrial", "piece", 6500, 8990, 18],
    ["SUB-PUMP-2HP", "Submersible Pump 2HP", "Industrial", "piece", 12500, 16900, 18],
    ["TR-OIL-200L", "Transformer Oil 200L", "Industrial", "barrel", 22000, 28500, 18],
    ["INS-TAPE-20", "Insulation Tape (pack of 10)", "Electrical", "pack", 160, 260, 18],
    ["J-BOX-2W", "Junction Box 2 Way", "Electrical", "piece", 45, 80, 18],
    ["MCB-16A", "MCB 16A Single Pole", "Electrical", "piece", 240, 385, 18],
    ["DB-8WAY", "Distribution Board 8 Way", "Electrical", "piece", 1450, 2100, 18],
    ["COND-25", "Conduit Pipe 25mm", "Electrical", "piece", 38, 62, 18],
    ["SW-SOC-6A", "Switch Socket 6A", "Electrical", "piece", 110, 175, 18],
    ["EARTH-ROD", "Earthing Rod 1m", "Electrical", "piece", 380, 560, 18],
    ["SOLAR-330", "Solar Panel 330W", "Industrial", "piece", 15500, 19900, 18],
    ["ROLL-BEAR", "Roller Bearing 6205", "Industrial", "piece", 250, 390, 18],
    ["TEFLON-T", "Teflon Tape", "Plumbing", "piece", 12, 25, 18],
    ["TAP-15", "Bib Tap 15mm", "Plumbing", "piece", 95, 150, 18],
    ["SINK-MIX", "Kitchen Sink Mixer", "Plumbing", "piece", 1250, 1890, 18],
    ["CPVC-ELB", "CPVC Elbow 20mm", "Plumbing", "piece", 18, 32, 18],
  ];

  const productIds: string[] = [];
  for (const [sku, name, cat, unit, cost, price, tax] of productDefs) {
    const { data } = await db
      .from("products")
      .insert({
        organization_id: orgId,
        sku,
        name,
        category_id: categories[cat] ?? null,
        unit,
        hsn_sac: "3917",
        tax_rate: tax,
        purchase_price: cost,
        selling_price: price,
        discount: 0,
        min_stock: 25,
        description: `${name} — standard quality for electrical, plumbing and construction projects.`,
        created_by: userId,
      })
      .select()
      .single();
    if (data) productIds.push(data.id);
  }

  // opening stock ledger
  if (warehouse.data && productIds.length) {
    for (const pid of productIds) {
      const qty = 100 + Math.floor(Math.random() * 500);
      await db.from("inventory_transactions").insert({
        organization_id: orgId,
        warehouse_id: warehouse.data.id,
        product_id: pid,
        type: "PURCHASE",
        quantity: qty,
        note: "Opening stock (demo)",
        created_by: userId,
      });
    }
  }

  // ---------------------------------------------------------------- customers
  const customerNames = [
    "Gupta Traders", "Agarwal Enterprises", "Mehta Electricals", "Singh Builders",
    "Kulkarni Agencies", "Reddy Pumps", "Iyer Textiles", "Chopra Distributors",
    "Verma Hardware", "Bhatia Trading Co", "Joshi Constructions", "Patel Electricals",
    "Malhotra & Sons", "Khan Trading", "Nair Agencies", "Deshmukh Builders",
    "Kapoor Industries", "Banerjee Supplies", "Trivedi Hardware", "Menon Traders",
    "Saxena Electricals", "Pillai Projects", "Gill Distributors", "Das & Co",
    "Mishra Trading", "Shetty Agencies", "Saini Hardware", "Rana Builders",
    "Chauhan Electricals", "Agrawal Metals",
  ];
  const cities = ["Delhi", "Gurgaon", "Noida", "Faridabad", "Ghaziabad", "Sonipat"];
  const states = ["Delhi", "Haryana", "Uttar Pradesh", "Haryana", "Uttar Pradesh", "Haryana"];

  const customerIds: string[] = [];
  for (let i = 0; i < customerNames.length; i++) {
    const ci = i % cities.length;
    const mob = `9${String(100000000 + i * 7919).slice(1, 10)}`;
    const { data } = await db
      .from("customers")
      .insert({
        organization_id: orgId,
        branch_id: branchId,
        customer_no: `CUS-${1001 + i}`,
        name: customerNames[i],
        company: customerNames[i],
        mobile: mob,
        whatsapp_number: mob,
        email: `sales@${customerNames[i].toLowerCase().replace(/[^a-z0-9]/g, "")}.in`,
        city: cities[ci],
        state: states[ci],
        pincode: String(110000 + i * 100),
        opt_in_comms: true,
        assigned_to: userId,
        created_by: userId,
      })
      .select()
      .single();
    if (data) customerIds.push(data.id);
  }

  // ------------------------------------------------------------------- leads
  const leadNames = [
    "Arjun Mehta", "Rohit Kumar", "Priya Sharma", "Suresh Nair", "Amit Patel",
    "Neha Gupta", "Vikram Singh", "Kavita Reddy", "Rahul Verma", "Pooja Joshi",
    "Anil Kulkarni", "Sunita Iyer", "Rajesh Chopra", "Manish Bhatia", "Deepa Das",
    "Sanjay Deshmukh", "Anjali Menon", "Kunal Saxena", "Ritu Banerjee", "Harsh Gill",
    "Nikhil Trivedi", "Pankaj Khan", "Swati Pillai", "Varun Malhotra", "Geeta Rana",
    "Ravi Chauhan", "Shalini Agarwal", "Aakash Jain", "Ruchi Kapoor", "Tarun Shetty",
    "Mohan Iyer", "Divya Saxena", "Karthik Reddy", "Simran Kaur", "Alok Das",
    "Nisha Pillai", "Deepak Bhatt", "Rekha Nair", "Gaurav Gupta", "Lakshmi Menon",
    "Sandeep Rao", "Jyoti Singh", "Farhan Ahmed", "Bhavana Joshi", "Aditya Rana",
    "Maya Kulkarni", "Vivek Sharma", "Anita Desai", "Prashant Kumar", "Shruti Malhotra",
  ];
  const sources = ["WhatsApp", "IndiaMART", "Website", "Referral", "Phone", "Facebook", "Walk-in"];
  const statuses: Array<"NEW" | "CONTACTED" | "QUALIFIED" | "PROPOSAL" | "NEGOTIATION" | "WON" | "LOST" | "NURTURE"> = [
    "NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST", "NURTURE",
  ];
  const priorities = ["HOT", "WARM", "COLD"] as const;

  const leadIds: string[] = [];
  for (let i = 0; i < 50; i++) {
    const source = sources[i % sources.length];
    const status = statuses[i % statuses.length];
    const value = [25000, 85000, 150000, 450000, 1200000, 65000, 220000][i % 7];
    const priority = i % 3 === 0 ? "HOT" : i % 3 === 1 ? "WARM" : "COLD";
    const daysAgo = i % 35;
    const contactedAt = new Date(now.getTime() - daysAgo * 86400000).toISOString();
    const lastContacted = i % 4 === 0 ? null : contactedAt;

    const score = computeLeadScore({
      source,
      value,
      interactions: i % 8,
      lastContactedDaysAgo: lastContacted ? daysAgo : null,
      priority,
      hasNextFollowup: i % 3 !== 0,
    }).score;

    const mob = `9${String(200000000 + i * 6131).slice(1, 10)}`;
    const { data } = await db
      .from("leads")
      .insert({
        organization_id: orgId,
        branch_id: branchId,
        lead_no: `LD-${5001 + i}`,
        name: leadNames[i],
        company: `${leadNames[i].split(" ")[1] ?? "Associates"} & Co`,
        mobile: mob,
        whatsapp_number: mob,
        email: `${leadNames[i].toLowerCase().replace(/\s+/g, ".")}@gmail.com`,
        city: cities[i % cities.length],
        source,
        product_interest: productDefs[i % productDefs.length][1],
        value,
        score,
        priority,
        status,
        owner_id: userId,
        last_contacted_at: lastContacted,
        next_followup_at:
          status !== "WON" && status !== "LOST" && i % 3 !== 0
            ? new Date(now.getTime() + (i % 6) * 86400000).toISOString()
            : null,
        notes: "Prospect from demo dataset.",
        tags: [source.toLowerCase(), priority.toLowerCase()],
        created_by: userId,
        created_at: new Date(now.getTime() - (i % 60) * 86400000).toISOString(),
      })
      .select()
      .single();
    if (data) leadIds.push(data.id);
  }

  // ---------------------------------------------------------- opportunities
  const pipeline = await db
    .from("pipelines")
    .select("id")
    .eq("organization_id", orgId)
    .eq("is_default", true)
    .maybeSingle();
  const stages = await db
    .from("pipeline_stages")
    .select("id, probability, is_winning, is_losing")
    .eq("organization_id", orgId)
    .order("sort_order");

  const oppIds: string[] = [];
  if (pipeline.data && stages.data) {
    for (let i = 0; i < 20; i++) {
      const st = stages.data[i % stages.data.length];
      const stageId = st.id;
      const value = [50000, 120000, 350000, 750000, 1500000][i % 5];
      const closed = i % 5 === 4;
      const status = closed ? (i % 2 === 0 ? "WON" : "LOST") : "OPEN";
      const { data } = await db
        .from("opportunities")
        .insert({
          organization_id: orgId,
          branch_id: branchId,
          lead_id: leadIds[i % leadIds.length],
          customer_id: customerIds[i % customerIds.length],
          pipeline_id: pipeline.data.id,
          stage_id: stageId,
          name: `${customerNames[i % customerNames.length]} — ${productDefs[i % productDefs.length][1]}`,
          value,
          probability: st.probability,
          expected_close_date: new Date(now.getTime() + (i % 30 + 5) * 86400000).toISOString().slice(0, 10),
          owner_id: userId,
          next_action_at: status === "OPEN" ? new Date(now.getTime() + (i % 4) * 86400000).toISOString() : null,
          status,
          closed_at: closed ? now.toISOString() : null,
          lost_reason: status === "LOST" ? "Budget constraints" : null,
          created_by: userId,
        })
        .select()
        .single();
      if (data) oppIds.push(data.id);
    }
  }

  // ------------------------------------------------------------ quotations
  const quoteIds: string[] = [];
  for (let i = 0; i < 10; i++) {
    const items: Array<{ product_id: string; quantity: number; unit_price: number; tax_rate: number; subtotal: number; tax: number }> = [];
    for (let k = 0; k < 3; k++) {
      const pid = productIds[(i + k * 5) % productIds.length];
      const unit_price = productDefs[(i + k * 5) % productDefs.length][5];
      const tax_rate = 18;
      const quantity = 5 + (i % 6) * 5;
      const line = computeLine({ quantity, unitPrice: unit_price, discountPercent: 0, taxRate: tax_rate });
      items.push({ product_id: pid, quantity, unit_price, tax_rate, subtotal: line.subtotal, tax: line.tax });
    }
    const totals = computeTotals(items);
    const { data: quote } = await db
      .from("quotations")
      .insert({
        organization_id: orgId,
        branch_id: branchId,
        quote_no: `QT-${9001 + i}`,
        customer_id: customerIds[i % customerIds.length],
        lead_id: leadIds[i % leadIds.length],
        date: new Date(now.getTime() - (20 - i) * 86400000).toISOString().slice(0, 10),
        valid_until: new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10),
        salesperson_id: userId,
        status: ["DRAFT", "SENT", "ACCEPTED", "ACCEPTED", "REJECTED"][i % 5] as never,
        ...totals,
        created_by: userId,
      })
      .select()
      .single();
    if (quote) {
      quoteIds.push(quote.id);
      for (const it of items) {
        await db.from("quotation_items").insert({
          organization_id: orgId,
          quotation_id: quote.id,
          product_id: it.product_id,
          product_name: productDefs[productIds.indexOf(it.product_id) % productDefs.length][1],
          quantity: it.quantity,
          unit_price: it.unit_price,
          discount: 0,
          tax_rate: it.tax_rate,
          line_total: it.subtotal + it.tax,
        });
      }
    }
  }

  // ----------------------------------------------------------------- orders
  const orderStatuses = [
    "DRAFT", "CONFIRMED", "PROCESSING", "PACKED", "DISPATCHED",
    "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED",
  ] as const;
  for (let i = 0; i < 20; i++) {
    const items: Array<{ product_id: string; quantity: number; unit_price: number; tax_rate: number; subtotal: number; tax: number }> = [];
    for (let k = 0; k < 2; k++) {
      const idx = (i * 3 + k) % productIds.length;
      const unit_price = productDefs[idx][5];
      const quantity = 10 + (i % 8) * 5;
      const line = computeLine({ quantity, unitPrice: unit_price, discountPercent: 0, taxRate: 18 });
      items.push({ product_id: productIds[idx], quantity, unit_price, tax_rate: 18, subtotal: line.subtotal, tax: line.tax });
    }
    const totals = computeTotals(items);
    const status = orderStatuses[i % orderStatuses.length];
    await db.from("orders").insert({
      organization_id: orgId,
      branch_id: branchId,
      order_no: `ORD-${4001 + i}`,
      customer_id: customerIds[i % customerIds.length],
      salesperson_id: userId,
      warehouse_id: warehouse.data?.id ?? null,
      quote_id: i < quoteIds.length ? quoteIds[i] : null,
      status,
      payment_status: status === "DELIVERED" ? "PAID" : status === "CANCELLED" ? "PENDING" : ["PENDING", "PARTIAL", "PAID"][i % 3] as never,
      delivery_city: cities[i % cities.length],
      delivery_date: new Date(now.getTime() + (i % 10) * 86400000).toISOString().slice(0, 10),
      ...totals,
      created_by: userId,
      created_at: new Date(now.getTime() - (i % 40) * 86400000).toISOString(),
    });
  }

  // ---------------------------------------------------------------- invoices
  const invoiceStatuses = ["ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE", "ISSUED"] as const;
  for (let i = 0; i < 15; i++) {
    const lineAmount = 8000 + i * 2200;
    const tax = Math.round((lineAmount * 18) / 100);
    const total = lineAmount + tax;
    const status = invoiceStatuses[i % invoiceStatuses.length];
    const paid = status === "PAID" ? total : status === "PARTIALLY_PAID" ? Math.round(total / 2) : 0;
    await db.from("invoices").insert({
      organization_id: orgId,
      branch_id: branchId,
      invoice_no: `INV-${7001 + i}`,
      customer_id: customerIds[i % customerIds.length],
      order_id: null,
      date: new Date(now.getTime() - (i % 45) * 86400000).toISOString().slice(0, 10),
      due_date: new Date(now.getTime() - (i % 45) * 86400000 + 15 * 86400000).toISOString().slice(0, 10),
      status,
      subtotal: lineAmount,
      discount_amount: 0,
      tax_amount: tax,
      total,
      paid_amount: paid,
      gst_meta: { cgst: tax / 2, sgst: tax / 2 },
    });
    if (paid > 0) {
      await db.from("payments").insert({
        organization_id: orgId,
        amount: paid,
        method: ["UPI", "NEFT", "Cash"][i % 3],
        reference: `PAY-${1001 + i}`,
        status: "RECEIVED",
        paid_at: new Date(now.getTime() - (i % 40) * 86400000).toISOString(),
        created_by: userId,
      });
    }
  }

  // -------------------------------------------------------------- follow-ups
  const followupKinds = ["call", "whatsapp", "meeting", "visit", "email"] as const;
  for (let i = 0; i < 20; i++) {
    const pending = i % 4 !== 0;
    await db.from("followups").insert({
      organization_id: orgId,
      branch_id: branchId,
      entity_type: i % 3 === 0 ? "customer" : "lead",
      entity_id: i % 3 === 0 ? customerIds[i % customerIds.length] : leadIds[i % leadIds.length],
      kind: followupKinds[i % followupKinds.length],
      subject: `Follow-up with ${customerNames[i % customerNames.length]}`,
      due_at: new Date(
        now.getTime() + (pending ? (i % 5) * 86400000 : -(i % 8) * 86400000)
      ).toISOString(),
      status: pending ? "PENDING" : "DONE",
      completed_at: pending ? null : new Date(now.getTime() - (i % 8) * 86400000).toISOString(),
      created_by: userId,
    });
  }

  // ------------------------------------------------------------- activities
  const activitySummaries = [
    "WhatsApp message sent about product pricing",
    "Call completed — discussed requirements",
    "Quotation shared with customer",
    "Visit scheduled for next week",
    "Email sent with catalogue",
    "Customer followed up on order status",
  ];
  for (let i = 0; i < 24; i++) {
    await db.from("activities").insert({
      organization_id: orgId,
      branch_id: branchId,
      entity_type: i % 2 === 0 ? "lead" : "customer",
      entity_id: i % 2 === 0 ? leadIds[i % leadIds.length] : customerIds[i % customerIds.length],
      activity_type: ["call", "whatsapp", "email", "visit", "note", "meeting"][i % 6] as never,
      direction: "out",
      summary: activitySummaries[i % activitySummaries.length],
      performed_at: new Date(now.getTime() - (i % 15) * 86400000).toISOString(),
      created_by: userId,
    });
  }

  // ---------------------------------------------------------- notifications
  const notificationDefs = [
    ["Followup", "Follow-up due today", "You have follow-ups scheduled for today."],
    ["Lead", "New lead assigned", "New hot lead assigned to you."],
    ["Order", "Order confirmed", "An order was confirmed and needs processing."],
    ["Inventory", "Low stock alert", "Some products are below minimum stock."],
    ["Payment", "Payment received", "A payment was recorded for an invoice."],
  ];
  for (let i = 0; i < notificationDefs.length; i++) {
    await db.from("notifications").insert({
      organization_id: orgId,
      user_id: userId,
      category: notificationDefs[i][0],
      title: notificationDefs[i][1],
      body: notificationDefs[i][2],
      is_read: i !== 0,
      created_at: new Date(now.getTime() - i * 3600000).toISOString(),
    });
  }
}