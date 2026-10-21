import { useState } from "react";
import { Check, Copy, MessageCircle, Send, Smartphone, Share2, Facebook, Twitter } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { productShareUrl, shareTargetUrl, type ShareTarget } from "@/lib/share-link";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  priceLabel?: string;
  image?: string | null;
};

const TARGETS: { key: ShareTarget; label: string; icon: typeof Send }[] = [
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { key: "telegram", label: "Telegram", icon: Send },
  { key: "sms", label: "Message", icon: Smartphone },
  { key: "facebook", label: "Facebook", icon: Facebook },
  { key: "x", label: "X", icon: Twitter },
];

/** Share window: a ready-made product link plus one-tap apps to send it. */
export function ProductShareDialog({ open, onOpenChange, productId, productName, priceLabel, image }: Props) {
  const [copied, setCopied] = useState(false);
  const url = productShareUrl(productId);
  const text = priceLabel ? `${productName} for ${priceLabel} on Kartogo` : `${productName} on Kartogo`;
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Product link copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — press and hold the link to copy it");
    }
  };

  const nativeShare = async () => {
    try { await navigator.share({ title: productName, text, url }); onOpenChange(false); }
    catch { /* cancelled */ }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="font-display">Share this product</DialogTitle>
          <DialogDescription>Send the link to anyone — it opens this product directly.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/40 p-3">
          {image ? (
            <img src={image} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
          ) : (
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-card"><Share2 className="h-5 w-5 text-muted-foreground" /></div>
          )}
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">{productName}</div>
            {priceLabel && <div className="text-xs text-muted-foreground">{priceLabel}</div>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            readOnly
            value={url}
            aria-label="Product share link"
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-xl border border-input bg-card px-3 py-2 text-xs"
          />
          <button
            type="button"
            onClick={() => void copy()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {TARGETS.map((t) => (
            <a
              key={t.key}
              href={shareTargetUrl(t.key, url, text)}
              target="_blank"
              rel="noreferrer"
              className="flex flex-col items-center gap-1 rounded-xl p-2 text-[11px] font-semibold hover:bg-secondary"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full border border-border bg-card"><t.icon className="h-4 w-4" /></span>
              {t.label}
            </a>
          ))}
        </div>

        {canNativeShare && (
          <button
            type="button"
            onClick={() => void nativeShare()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-bold hover:bg-secondary"
          >
            <Share2 className="h-4 w-4" /> More apps
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
