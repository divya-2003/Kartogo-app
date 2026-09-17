import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut, Phone, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/printer/account")({ component: PrinterAccount });

function PrinterAccount() {
  const nav = useNavigate();

  const logout = () => {
    try {
      localStorage.removeItem("qk_printer_token");
      localStorage.removeItem("qk_printer");
    } catch { /* noop */ }
    nav({ to: "/login", replace: true });
  };

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-bold">Account</h1>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Printer className="h-6 w-6" /></div>
          <div>
            <div className="font-display text-lg font-bold">Kartogo Printer Service</div>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground"><Phone className="h-3.5 w-3.5" /> 9999999996</div>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          This portal handles every customer print order — download the file, print it, then mark it ready so the delivery partner can pick it up.
        </p>
      </div>

      <Button variant="destructive" onClick={logout}><LogOut /> Log out</Button>
    </div>
  );
}
