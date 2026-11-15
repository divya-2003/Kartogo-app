import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { studioMeFn } from "@/lib/studio.functions";
import type { BookingMode, StudioKind } from "@/lib/studio";

export type StudioMe = {
  partners: { id: string; name: string; kind: StudioKind; icon: string }[];
  partner: {
    id: string; slug: string; name: string; kind: StudioKind; icon: string; partner_type: string;
    description: string | null; address: string | null; service_area: string | null; photos: string[];
    logo_url: string | null; business_phone: string | null; lat: number | null; lng: number | null;
    opens_at: string | null; closes_at: string | null; weekly_off: number[]; closed_dates: string[];
    verification_status: "PENDING" | "VERIFIED" | "REJECTED"; account_status: "ACTIVE" | "SUSPENDED"; is_active: boolean;
    category_slugs: string[]; categories: { slug: string; name: string }[];
  };
  bookingMode: BookingMode; appointmentTypes: string[]; unread: number; phone: string | null;
};

type Ctx = { token: string; partnerId: string | null; setPartnerId: (id: string) => void; me: StudioMe | undefined; loading: boolean; error: string | null; refresh: () => void };
const StudioCtx = createContext<Ctx | null>(null);

export function readSellerToken(): string {
  try { return JSON.parse(localStorage.getItem("qk_supplier_token") || "null") ?? ""; } catch { return ""; }
}

/** Unwraps a Studio server result so React Query sees failures as errors. */
export async function unwrap<T>(p: Promise<{ ok: true; data: T } | { ok: false; error: string }>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

export function StudioProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState("");
  const [partnerId, setPid] = useState<string | null>(null);
  const qc = useQueryClient();
  useEffect(() => {
    setToken(readSellerToken());
    try { setPid(localStorage.getItem("qk_studio_partner")); } catch { /* unavailable */ }
  }, []);
  const q = useQuery({
    queryKey: ["studio-me", partnerId],
    queryFn: () => unwrap(studioMeFn({ data: { token, partnerId } })) as Promise<StudioMe>,
    enabled: !!token, staleTime: 30_000, retry: 1,
  });
  // A remembered business that no longer belongs to this seller falls back to the first one.
  useEffect(() => { if (q.error && partnerId) { setPid(null); try { localStorage.removeItem("qk_studio_partner"); } catch { /* noop */ } } }, [q.error, partnerId]);
  const setPartnerId = (id: string) => {
    setPid(id);
    try { localStorage.setItem("qk_studio_partner", id); } catch { /* unavailable */ }
    qc.removeQueries({ predicate: (x) => String(x.queryKey[0]).startsWith("studio-") && x.queryKey[0] !== "studio-me" });
  };
  return (
    <StudioCtx.Provider value={{ token, partnerId: q.data?.partner.id ?? partnerId, setPartnerId, me: q.data, loading: !token || q.isLoading, error: q.error ? (q.error as Error).message : null, refresh: () => q.refetch() }}>
      {children}
    </StudioCtx.Provider>
  );
}

export function useStudio() {
  const c = useContext(StudioCtx);
  if (!c) throw new Error("useStudio outside StudioProvider");
  return c;
}

/** Query helper scoped to the current business. */
export function useStudioQuery<T>(key: string, fn: (args: { token: string; partnerId: string | null }) => Promise<{ ok: true; data: T } | { ok: false; error: string }>, extra: unknown[] = [], opts: { refetchInterval?: number } = {}) {
  const { token, partnerId, me } = useStudio();
  return useQuery({
    queryKey: [`studio-${key}`, partnerId, ...extra],
    queryFn: () => unwrap(fn({ token, partnerId })),
    enabled: !!token && !!me, staleTime: 15_000, refetchInterval: opts.refetchInterval,
  });
}
