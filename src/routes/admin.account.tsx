import { createFileRoute } from "@tanstack/react-router";
import { LogOut, ShieldCheck } from "lucide-react";
import { StaffAccountCard } from "@/components/StaffAccountCard";
import { useAuth } from "@/lib/store";

export const Route = createFileRoute("/admin/account")({
  component: AdminAccount,
  head: () => ({
    meta: [
      { title: "Admin account — Kartogo" },
      { name: "description", content: "Manage your Kartogo admin identity and login mobile number." },
      { property: "og:title", content: "Admin account — Kartogo" },
      { property: "og:description", content: "Manage your Kartogo admin identity and login mobile number." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});


function AdminAccount() {
  const { logout } = useAuth();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold">Account</h1>
        <p className="text-sm text-muted-foreground">Your permanent admin identity and login number.</p>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="text-sm">
          <p className="font-semibold">Kartogo admin</p>
          <p className="text-muted-foreground">Changing your mobile number keeps all history tied to the same account ID.</p>
        </div>
      </div>

      <StaffAccountCard role="admin" />

      <button
        onClick={logout}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/5 py-3 text-sm font-bold text-destructive hover:bg-destructive/10"
      >
        <LogOut className="h-4 w-4" /> Log out
      </button>
    </div>
  );
}
