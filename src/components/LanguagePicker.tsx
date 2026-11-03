import { useEffect, useState } from "react";
import { Check, Languages, X } from "lucide-react";
import { toast } from "sonner";
import { LANGUAGES, LANGUAGE_EVENT, getLanguage, languageLabel, setLanguage } from "@/lib/i18n";

/** Full-screen-on-phone sheet listing every language, alphabetically. */
export function LanguageSheet({ value, onPick, onClose }: { value: string; onPick: (code: string) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 md:items-center" onClick={onClose}>
      <div role="dialog" aria-label="Select language" data-no-translate className="flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-3xl bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:rounded-3xl" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-extrabold">Select Language</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        <div className="-mx-1 space-y-2 overflow-y-auto px-1">
          {LANGUAGES.map(l => (
            <button key={l.code} onClick={() => onPick(l.code)} className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left ${value === l.code ? "border-primary bg-primary/5" : "border-border"}`}>
              <span><span className="font-semibold">{l.label}</span> <span className="text-sm text-muted-foreground">{l.native}</span></span>
              {value === l.code && <Check className="h-5 w-5 text-primary" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function useAppLanguage() {
  const [lang, setLang] = useState("en");
  useEffect(() => {
    setLang(getLanguage());
    const on = () => setLang(getLanguage());
    window.addEventListener(LANGUAGE_EVENT, on);
    return () => window.removeEventListener(LANGUAGE_EVENT, on);
  }, []);
  const pick = (code: string) => {
    setLanguage(code);
    setLang(code);
    toast.success(code === "en" ? "Language set to English" : `Language set to ${languageLabel(code)} — translating the app…`);
  };
  return { lang, pick };
}

/** "Language" row for seller, rider and printer profile pages. */
export function LanguageRow({ className = "" }: { className?: string }) {
  const { lang, pick } = useAppLanguage();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-pop hover:bg-secondary ${className}`}>
        <Languages className="h-5 w-5 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Language</span>
          <span className="block text-sm text-muted-foreground" data-no-translate>{languageLabel(lang)}</span>
        </span>
        <span aria-hidden className="text-muted-foreground">›</span>
      </button>
      {open && <LanguageSheet value={lang} onPick={code => { pick(code); setOpen(false); }} onClose={() => setOpen(false)} />}
    </>
  );
}
