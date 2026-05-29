import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { useAuth } from "@/lib/store";
import { toast } from "sonner";
import { User2, Package, UserCog, LogOut, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/menu")({
  component: MenuPage,
  head: () => ({ meta: [{ title: "Account — QuickKart" }] }),
});

function MenuPage() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="font-display text-2xl font-bold">Please login</h1>
          <Link to="/login" className="mt-5 inline-flex rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground">Login with OTP</Link>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    toast.success("Signed out");
    nav({ to: "/login" });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-2xl px-4 py-8 md:px-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
            <User2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Account</h1>
            <p className="text-sm text-muted-foreground">Manage your orders and details</p>
          </div>
        </div>

        <div className="space-y-3">
          <Link to="/orders" className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 text-base font-semibold hover:bg-secondary">
            <Package className="h-5 w-5" /> My orders
            <ChevronRight className="ml-auto h-5 w-5 text-muted-foreground" />
          </Link>
          <Link to="/account" className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 text-base font-semibold hover:bg-secondary">
            <UserCog className="h-5 w-5" /> Account details
            <ChevronRight className="ml-auto h-5 w-5 text-muted-foreground" />
          </Link>
          <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 text-left text-base font-semibold text-destructive hover:bg-secondary">
            <LogOut className="h-5 w-5" /> Logout
          </button>
        </div>
      </div>
    </div>
  );
}
