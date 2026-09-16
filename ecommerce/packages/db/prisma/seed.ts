import { Prisma, PrismaClient, UserStatus } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PERMISSION_GROUPS = {
  catalog: ["create", "edit", "delete", "view"],
  category: ["create", "edit", "delete", "move"],
  brand: ["create", "edit", "delete", "view"],
  attribute: ["create", "edit", "delete", "view"],
  collection: ["create", "edit", "delete", "view"],
  price: ["view", "update", "tiers", "promotions"],
  order: ["view", "cancel", "update_status"],
  return: ["view", "approve", "reject"],
  refund: ["approve", "view"],
  inventory: ["view", "adjust", "transfer"],
  warehouse: ["create", "edit", "delete", "view"],
  customer: ["view", "edit", "block"],
  coupon: ["create", "edit", "delete", "view", "assign"],
  campaign: ["create", "edit", "delete", "view"],
  banner: ["create", "edit", "delete", "view"],
  content: ["create", "edit", "delete", "view"],
  user: ["create", "edit", "delete", "view"],
  role: ["create", "edit", "delete", "assign", "view"],
  setting: ["edit", "view"],
  report: ["view"],
  review: ["view", "moderate", "delete"],
  notification: ["send", "view"],
  import: ["run"],
  export: ["run"],
  seller: ["view", "approve", "suspend"],
  support: ["view", "reply", "assign"],
};

function permissionCodes(): { code: string; resource: string; action: string }[] {
  const out: { code: string; resource: string; action: string }[] = [];
  for (const [resource, actions] of Object.entries(PERMISSION_GROUPS)) {
    for (const action of actions) {
      out.push({ code: `${resource}.${action}`, resource, action });
    }
  }
  return out;
}

const ROLE_DEFINITIONS: { code: string; name: string; isSystem: boolean; description: string }[] = [
  { code: "SUPER_ADMIN", name: "Super Admin", isSystem: true, description: "Full platform access" },
  { code: "ADMIN", name: "Admin", isSystem: true, description: "Broad platform access" },
  {
    code: "CATALOG_MANAGER",
    name: "Catalog Manager",
    isSystem: true,
    description: "Catalog, categories, brands, attributes, imports",
  },
  {
    code: "ORDER_MANAGER",
    name: "Order Manager",
    isSystem: true,
    description: "Orders, returns, refund approvals",
  },
  {
    code: "INVENTORY_MANAGER",
    name: "Inventory Manager",
    isSystem: true,
    description: "Stock, warehouses, movements",
  },
  {
    code: "MARKETING_MANAGER",
    name: "Marketing Manager",
    isSystem: true,
    description: "Coupons, campaigns, banners, content",
  },
  {
    code: "FINANCE_MANAGER",
    name: "Finance Manager",
    isSystem: true,
    description: "Refunds, settlements, reports",
  },
  {
    code: "CUSTOMER_SUPPORT",
    name: "Customer Support",
    isSystem: true,
    description: "Tickets, order assistance",
  },
  {
    code: "OPERATIONS_MANAGER",
    name: "Operations Manager",
    isSystem: true,
    description: "Inventory and fulfillment operations",
  },
  { code: "CUSTOMER", name: "Customer", isSystem: true, description: "Registered customer" },
  { code: "SELLER", name: "Seller", isSystem: true, description: "Marketplace seller" },
];

const ALL_CODES = new Set(permissionCodes().map((p) => p.code));

function adminPermissions(): string[] {
  return [...ALL_CODES];
}

function catalogManagerPermissions(): string[] {
  return [
    ...moduleCodes("catalog"),
    ...moduleCodes("category"),
    ...moduleCodes("brand"),
    ...moduleCodes("attribute"),
    ...moduleCodes("collection"),
    ...moduleCodes("price"),
    ...moduleCodes("import"),
    ...moduleCodes("export"),
  ];
}

function orderManagerPermissions(): string[] {
  return [
    ...moduleCodes("order"),
    ...moduleCodes("return"),
    ...moduleCodes("refund"),
    ...moduleCodes("support"),
    ...moduleCodes("export"),
  ];
}

function inventoryManagerPermissions(): string[] {
  return [
    ...moduleCodes("inventory"),
    ...moduleCodes("warehouse"),
    ...moduleCodes("export"),
  ];
}

function operationsManagerPermissions(): string[] {
  return [
    ...moduleCodes("order"),
    ...moduleCodes("return"),
    ...moduleCodes("inventory"),
    ...moduleCodes("warehouse"),
    ...moduleCodes("report"),
    ...moduleCodes("export"),
  ];
}

function marketingManagerPermissions(): string[] {
  return [
    ...moduleCodes("coupon"),
    ...moduleCodes("campaign"),
    ...moduleCodes("banner"),
    ...moduleCodes("content"),
    ...moduleCodes("notification"),
    ...moduleCodes("report"),
    ...moduleCodes("export"),
  ];
}

function financeManagerPermissions(): string[] {
  return [
    ...moduleCodes("refund"),
    ...moduleCodes("report"),
    ...moduleCodes("order"),
    ...moduleCodes("export"),
  ];
}

function customerSupportPermissions(): string[] {
  return [...moduleCodes("order"), ...moduleCodes("support")];
}

function moduleCodes(resource: string): string[] {
  return permissionCodes()
    .filter((p) => p.resource === resource)
    .map((p) => p.code);
}

const ROLE_PERMISSIONS: Record<string, (() => string[]) | string[]> = {
  SUPER_ADMIN: adminPermissions,
  ADMIN: adminPermissions,
  CATALOG_MANAGER: catalogManagerPermissions,
  ORDER_MANAGER: orderManagerPermissions,
  INVENTORY_MANAGER: inventoryManagerPermissions,
  MARKETING_MANAGER: marketingManagerPermissions,
  FINANCE_MANAGER: financeManagerPermissions,
  CUSTOMER_SUPPORT: customerSupportPermissions,
  OPERATIONS_MANAGER: operationsManagerPermissions,
  CUSTOMER: [],
  SELLER: ["seller.view", "catalog.view", "catalog.create", "catalog.edit"],
};

async function main() {
  const codes = permissionCodes();
  for (const p of codes) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: { resource: p.resource, action: p.action },
      create: p,
    });
  }

  for (const def of ROLE_DEFINITIONS) {
    const role = await prisma.role.upsert({
      where: { code: def.code },
      update: { name: def.name, description: def.description },
      create: def,
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });

    if (def.code === "CUSTOMER") continue;

    const conf = ROLE_PERMISSIONS[def.code] ?? [];
    const wanted = typeof conf === "function" ? conf() : conf;
    const perms = await prisma.permission.findMany({ where: { code: { in: wanted } } });
    for (const perm of perms) {
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });
    }
  }

  const email = process.env.FIRST_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.FIRST_ADMIN_PASSWORD;
  if (email && password) {
    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        name: process.env.FIRST_ADMIN_NAME ?? "Platform Admin",
        passwordHash,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });
    const superRole = await prisma.role.findUnique({ where: { code: "SUPER_ADMIN" } });
    if (superRole) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: admin.id, roleId: superRole.id } },
        update: {},
        create: { userId: admin.id, roleId: superRole.id },
      });
    }
  }

  const warehouse = await prisma.warehouse.upsert({
    where: { code: "MUM1" },
    update: {},
    create: {
      name: "Mumbai Fulfillment Hub",
      code: "MUM1",
      city: "Mumbai",
      state: "MH",
      pincode: "400001",
      priority: 1,
      isActive: true,
    },
  });

  const demoVariants = await prisma.productVariant.findMany({
    where: { product: { slug: { in: ["nexus-air-5g", "nexus-cable-1m", "soundcore-pro-buds"] } } },
    include: { product: { select: { slug: true } } },
  });

  const demoStock: Record<string, number> = {
    "nexus-air-5g": 12,
    "nexus-cable-1m": 8,
    "soundcore-pro-buds": 6,
  };

  let stocked = 0;
  for (const variant of demoVariants) {
    const qty = demoStock[variant.product.slug];
    if (!qty) continue;
    await prisma.inventory.upsert({
      where: { warehouseId_productVariantId: { warehouseId: warehouse.id, productVariantId: variant.id } },
      update: { quantity: qty, reorderPoint: 5, reorderQuantity: 20 },
      create: {
        warehouseId: warehouse.id,
        productVariantId: variant.id,
        quantity: qty,
        lowStockThreshold: 5,
        reorderPoint: 5,
        reorderQuantity: 20,
      },
    });
    stocked++;
  }

  console.log(`Seed complete: permissions, roles, admin, demo inventory (${stocked} stock rows, ${warehouse.code}).`);

  const air64 = demoVariants.find(
    (v) => v.product.slug === "nexus-air-5g" && v.sku === "NM-09111752-BLK64",
  );
  const cable = demoVariants.find(
    (v) => v.product.slug === "nexus-cable-1m" && v.sku === "NM-CHEAP-299-BLK",
  );

  let tiers = 0;
  if (air64) {
    tierSeed(air64.id, 2, "21999.00");
    tierSeed(air64.id, 3, "20999.00");
  }
  if (cable) {
    tierSeed(cable.id, 5, "249.00");
  }

  const airProduct = demoVariants.find((v) => v.product.slug === "nexus-air-5g")?.productId
    ? await prisma.product.findUnique({ where: { slug: "nexus-air-5g" } })
    : null;

  const today = new Date();
  const past = new Date(today.getTime() - 86400000);
  const future = new Date(today.getTime() + 86400000 * 6);

  let promotions = 0;
  const season = await prisma.promotion.findFirst({ where: { name: "Season Sale — 10% off sitewide" } });
  if (!season) {
    await prisma.promotion.create({
      data: {
        name: "Season Sale — 10% off sitewide",
        type: "PERCENTAGE_OFF",
        scope: "ALL",
        config: { value: 10, minQuantity: 1 },
        startAt: past,
        endAt: future,
        priority: 10,
        isActive: true,
      },
    });
    promotions++;
  }
  const launch = await prisma.promotion.findFirst({ where: { name: "Air 5G Launch Offer" } });
  if (!launch && airProduct) {
    const created = await prisma.promotion.create({
      data: {
        name: "Air 5G Launch Offer",
        type: "FLAT_OFF",
        scope: "PRODUCT",
        config: { value: 500, minQuantity: 1 },
        startAt: past,
        endAt: future,
        priority: 20,
        isActive: true,
      },
    });
    await prisma.promotionItem.create({ data: { promotionId: created.id, productId: airProduct.id } });
    promotions++;
  }

  console.log(`Pricing seed: ${tiers} tiers, ${promotions} promotions.`);

  async function tierSeed(variantId: string, minQuantity: number, price: string) {
    await prisma.priceTier.upsert({
      where: { productVariantId_minQuantity: { productVariantId: variantId, minQuantity } },
      update: { price: new Prisma.Decimal(price) },
      create: { productVariantId: variantId, minQuantity, price: new Prisma.Decimal(price) },
    });
    tiers++;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());