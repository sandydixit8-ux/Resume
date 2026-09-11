import type { Metadata } from "next";
import { listCustomerOptions } from "@/lib/data/sales";
import { listProductOptions } from "@/lib/data/products";
import { listWarehouses } from "@/lib/data/inventory";
import { getAssignableUsers } from "@/lib/data/leads";
import { OrderForm } from "@/components/sales/order-form";

export const metadata: Metadata = { title: "New order" };
export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const [customers, products, warehouses, salespeople] = await Promise.all([
    listCustomerOptions(),
    listProductOptions(),
    listWarehouses(),
    getAssignableUsers(),
  ]);
  return <OrderForm customers={customers} products={products} warehouses={warehouses} salespeople={salespeople} />;
}