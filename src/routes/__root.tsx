import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  Link,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { SplashScreen } from "@/components/SplashScreen";
import { PushBridge } from "@/components/PushBridge";
import { CartProvider, AuthProvider, CatalogProvider, OrdersProvider, LocationProvider, WalletProvider, WishlistProvider, DriversProvider } from "@/lib/store";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">Looks like that aisle is empty.</p>
        <Link to="/" className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Back to shop</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error: rawError, reset }: { error: unknown; reset: () => void }) {
  const error = rawError as Error;
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Try again</button>
          <a href="/" className="rounded-lg border border-input px-4 py-2 text-sm font-medium">Home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Kartogo — Groceries, Food & Essentials Delivered Fast in Ongole" },
      { name: "description", content: "Order groceries, snacks, homemade pickles, tiffin batter and daily essentials on Kartogo with 15-minute quick delivery or scheduled slots across Ongole, Andhra Pradesh." },
      { property: "og:title", content: "Kartogo — Groceries, Food & Essentials Delivered Fast in Ongole" },
      { property: "og:description", content: "Order groceries, snacks, homemade pickles, tiffin batter and daily essentials on Kartogo with 15-minute quick delivery or scheduled slots across Ongole, Andhra Pradesh." },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }, { rel: "icon", type: "image/png", href: "/favicon.png" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            name: "Kartogo",
            url: "https://quick-niche-delight.lovable.app",
            areaServed: "Ongole, Andhra Pradesh, India",
            contactPoint: { "@type": "ContactPoint", telephone: "+91-91103-10034", contactType: "customer service" },
          },
          {
            "@type": "WebSite",
            name: "Kartogo",
            url: "https://quick-niche-delight.lovable.app",
            potentialAction: {
              "@type": "SearchAction",
              target: "https://quick-niche-delight.lovable.app/search?q={search_term_string}",
              "query-input": "required name=search_term_string",
            },
          },
        ],
      }),
    }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RouteMemory() {
  const router = useRouter();
  useEffect(() => {
    // App reload that landed on "/" (e.g. Android app reopening its start URL):
    // go back to the page the customer was on.
    try {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      const last = sessionStorage.getItem("qk_last_path");
      if (nav?.type === "reload" && last && last !== "/" && window.location.pathname === "/") {
        void router.navigate({ to: last, replace: true });
      }
    } catch { /* noop */ }
    return router.subscribe("onResolved", ({ toLocation }) => {
      try { sessionStorage.setItem("qk_last_path", toLocation.href); } catch { /* noop */ }
    });
  }, [router]);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WalletProvider>
          <LocationProvider>
            <CatalogProvider>
              <OrdersProvider>
                <DriversProvider>
                  <CartProvider>
                    <WishlistProvider>
                      <Outlet />
                      <SplashScreen />
<RouteMemory />
                      <PushBridge />
                      <Toaster position="top-center" richColors />

                    </WishlistProvider>
                  </CartProvider>
                </DriversProvider>
              </OrdersProvider>
            </CatalogProvider>
          </LocationProvider>
        </WalletProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
