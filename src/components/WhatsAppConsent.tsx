import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MessageCircle, Loader2 } from "lucide-react";
import { readWhatsAppConsentFn, saveWhatsAppConsentFn } from "@/lib/whatsapp-promo.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

export function WhatsAppConsent({ token }: { token: string }) {
  const read = useServerFn(readWhatsAppConsentFn);
  const save = useServerFn(saveWhatsAppConsentFn);
  const [value, setValue] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true); setError("");
    try { const result = await read({ data: { token } }); setValue(result.optedIn); }
    catch { setError("Could not load WhatsApp consent."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [token]);
  const change = async (optedIn: boolean) => {
    setBusy(true); setError("");
    try { const result = await save({ data: { token, optedIn } }); setValue(result.optedIn); toast.success(result.optedIn ? "WhatsApp offers enabled" : "WhatsApp consent withdrawn"); }
    catch { setError("Could not save WhatsApp consent. Please try again."); }
    finally { setBusy(false); }
  };
  return <section className="mt-6 border-t border-border pt-5" aria-labelledby="whatsapp-consent-title">
    <div className="flex items-start gap-3">
      <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <h2 id="whatsapp-consent-title" className="font-semibold">WhatsApp marketing</h2>
        <label className="mt-3 flex cursor-pointer items-start gap-3">
          <Checkbox aria-label="Get product recommendations and offers on WhatsApp" checked={value} disabled={loading || busy || Boolean(error)} onCheckedChange={v => void change(v === true)} />
          <span className="text-sm">Get product recommendations and offers on WhatsApp</span>
        </label>
        <p className="mt-2 text-xs text-muted-foreground">Optional. You can withdraw consent here at any time. This is separate from push notifications.</p>
        {(loading || busy) && <span className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />{busy ? "Saving…" : "Loading…"}</span>}
        {error && <div className="mt-2 flex items-center gap-2"><p role="alert" className="text-sm text-destructive">{error}</p><Button size="sm" variant="outline" onClick={() => void load()}>Retry</Button></div>}
      </div>
    </div>
  </section>;
}