// Client-safe supplier registry. A supplier owns a set of product categories
// and can only manage inventory / see orders that fall inside those categories.
// This single source of truth is imported by both client routes and server
// functions (it has no server-only or asset imports).
import { CATEGORIES } from "./data";

export type Supplier = {
  id: string;
  name: string;
  phone: string;
  /** Category slugs this supplier is responsible for. */
  categories: string[];
};

const PHARMACY_CATS = ["pharmacy"];
const PICKLE_SNACK_CATS = ["pickles", "local-snacks"];

// Everything that isn't pharmacy / pickles / local-snacks belongs to the
// general store supplier.
const GENERAL_CATS = CATEGORIES.map((c) => c.slug).filter(
  (slug) => ![...PHARMACY_CATS, ...PICKLE_SNACK_CATS].includes(slug),
);

export const SUPPLIERS: Supplier[] = [
  { id: "pharmacy", name: "Pharmacy Supplier", phone: "9999999999", categories: PHARMACY_CATS },
  { id: "pickles-snacks", name: "Pickles & Local Snacks Supplier", phone: "9999999998", categories: PICKLE_SNACK_CATS },
  { id: "general", name: "General Store Supplier", phone: "9999999997", categories: GENERAL_CATS },
];

export const findSupplierByPhone = (phone: string): Supplier | null =>
  SUPPLIERS.find((s) => s.phone === phone) ?? null;

export const findSupplierById = (id: string): Supplier | null =>
  SUPPLIERS.find((s) => s.id === id) ?? null;

export const isSupplierPhone = (phone: string): boolean => SUPPLIERS.some((s) => s.phone === phone);
