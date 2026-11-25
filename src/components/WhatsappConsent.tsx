import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { getWhatsappConsentFn, saveWhatsappConsentFn } from "@/lib/whatsapp-promo.functions";

export function WhatsappConsent({ token }: { token: string }) {
  const getConsent = useServerFn(getWhatsappConsentFn);
  const saveConsent = useServerFn(saveWhatsappConsentFn);
  const [optIn, setOptIn] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoaded(false);
    setError("");
    getConsent({ data: { token } }).then(r => {
      if (active) { setOptIn(r.optIn); setLoaded(true); }
    }).catch(() => { if (active) setError("Could not load your WhatsApp preference."); });
    return () => { active = false; };
  }, [token, retry, getConsent]);
  async function save(next: boolean) {
    setBusy(true);
    try {
      const r = await saveConsent({ data: { token, optIn: next } });
      setOptIn(r.optIn);
      toast.success(next ? "WhatsApp offers enabled" : "WhatsApp offers turned off");
    } catch { toast.error("Could not save your WhatsApp preference. Please try again."); }
    finally { setBusy(false); }
  }
  return <section className="mt-6 border-t border-border pt-5">
    <h2 className="mb-3 font-semibold">WhatsApp offers</h2>
    <label className="flex items-start gap-3">
      <Checkbox id="whatsapp-consent" checked={optIn} disabled={!loaded || busy} onCheckedChange={value => void save(value === true)} className="mt-1" />
      <span><span className="block font-medium">Send me product offers on WhatsApp</span>
        <span className="block text-sm text-muted-foreground">Optional. Kartogo may send product recommendations to your registered number. You can turn this off at any time.</span>
      </span>
    </label>
    {!loaded && !error && <p className="mt-2 text-sm text-muted-foreground" role="status">Loading your preference…</p>}
    {busy && <p className="mt-2 text-sm text-muted-foreground" role="status">Saving…</p>}
    {error && <div className="mt-2 flex flex-wrap items-center gap-2"><p role="alert" className="text-sm text-destructive">{error}</p><Button size="sm" variant="outline" onClick={() => setRetry(n => n + 1)}>Try again</Button></div>}
  </section>;
}