import type { CategoryGroup, MpCategory, MpListing, MpPartner } from "./marketplace";

export type HomeSection = "shop" | "food" | "rides" | "beauty" | "home" | "events";

export function sectionGroup(section: HomeSection): CategoryGroup | null {
  if (section === "home") return "home_services";
  if (section === "food" || section === "rides") return null;
  return section;
}

export function sectionCategories(categories: MpCategory[], section: HomeSection): MpCategory[] {
  return categories.filter(c => c.group_key === sectionGroup(section));
}

export function listingInSection(listing: Pick<MpListing, "category_slug">, categories: MpCategory[], section: HomeSection): boolean {
  return sectionCategories(categories, section).some(c => c.slug === listing.category_slug);
}

export function partnerInSection(partner: Pick<MpPartner, "category_slugs">, categories: MpCategory[], section: HomeSection): boolean {
  return sectionCategories(categories, section).some(c => partner.category_slugs.includes(c.slug));
}

/** Catalog items are physical Shop products, never marketplace service categories. */
export function catalogProductInShop(product: { category: string }, categories: MpCategory[]): boolean {
  const category = categories.find(c => c.slug === product.category || c.legacy_categories?.includes(product.category));
  return !category || category.group_key === "shop";
}