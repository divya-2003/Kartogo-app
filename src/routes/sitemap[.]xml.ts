import { createFileRoute } from "@tanstack/react-router";
import { CATEGORIES, PRODUCTS } from "@/lib/data";

const BASE_URL = "https://quick-niche-delight.lovable.app";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => {
        const paths: string[] = [
          "/",
          "/categories",
          "/search",
          "/print",
          "/support",
          "/refund-returns",
          ...CATEGORIES.map((c) => `/category/${c.slug}`),
          ...PRODUCTS.map((p) => `/product/${p.id}`),
        ];

        const urls = paths
          .map(
            (p) =>
              `  <url>\n    <loc>${BASE_URL}${p}</loc>\n    <changefreq>weekly</changefreq>\n  </url>`,
          )
          .join("\n");

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
