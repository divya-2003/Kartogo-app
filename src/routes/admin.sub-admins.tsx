import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { UserPlus, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { PhoneNumberInput } from "@/components/PhoneNumberInput";
import { usePhoneCountryDetection } from "@/hooks/use-phone-country";
import { toE164, validatePhoneNumber } from "@/lib/phone";
import { ADMIN_FEATURES, type AdminPermission } from "@/lib/admin-access.shared";
import { createSubAdminFn, listSubAdminsFn, updateSubAdminFn, type SubAdmin } from "@/lib/admin-access.functions";

export const Route = createFileRoute("/admin/sub-admins")({
  component: SubAdminsPage,
  head: () => ({ meta: [
    { title: "Sub-admins — Kartogo" },
    { name: "description", content: "Manage Kartogo sub-admin accounts and feature access." },
    { property: "og:title", content: "Sub-admins — Kartogo" },
    { property: "og:description", content: "Manage Kartogo sub-admin accounts and feature access." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
});

function adminToken() {
  try { return JSON.parse(localStorage.getItem("qk_admin_token") || "null") as string | null; }
  catch { return null; }
}

function SubAdminsPage() {
  const { country, setCountry } = usePhoneCountryDetection();
  const [admins, setAdmins] = useState<SubAdmin[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [permissions, setPermissions] = useState<AdminPermission[]>(["dashboard", "orders"]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const token = adminToken();
    if (!token) return;
    setLoading(true);
    try { setAdmins((await listSubAdminsFn({ data: { token } })).admins); }
    catch (error) { toast.error((error as Error).message); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const togglePermission = (key: AdminPermission) => {
    setPermissions((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  };

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    const token = adminToken();
    const normalized = toE164(phone, country);
    if (!token) return;
    if (!name.trim()) return toast.error("Enter the sub-admin's name");
    if (!normalized || !validatePhoneNumber(phone, country)) return toast.error("Enter a valid mobile number");
    if (permissions.length === 0) return toast.error("Select at least one feature");
    setSaving(true);
    try {
      await createSubAdminFn({ data: { token, fullName: name.trim(), phone: normalized, permissions } });
      setName("");
      setPhone("");
      setPermissions(["dashboard", "orders"]);
      toast.success("Sub-admin added");
      await load();
    } catch (error) { toast.error((error as Error).message); }
    finally { setSaving(false); }
  };

  const saveAdmin = async (admin: SubAdmin, patch: Partial<Pick<SubAdmin, "status" | "permissions">>) => {
    const token = adminToken();
    if (!token) return;
    const next = { ...admin, ...patch };
    setAdmins((current) => current.map((item) => item.userId === admin.userId ? next : item));
    try {
      await updateSubAdminFn({ data: { token, userId: admin.userId, status: next.status, permissions: next.permissions } });
      toast.success("Access updated");
    } catch (error) {
      setAdmins((current) => current.map((item) => item.userId === admin.userId ? admin : item));
      toast.error((error as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">Sub-admins</h1>
        <p className="text-sm text-muted-foreground">Add team members and choose exactly what each person can access.</p>
      </div>

      <form onSubmit={create} className="space-y-4 rounded-lg border border-border bg-card p-4 md:p-5">
        <div className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">Add sub-admin</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm font-semibold">
            <span>Full name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} className="h-11 w-full rounded-lg border border-input bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring" placeholder="Enter full name" />
          </label>
          <label className="space-y-1 text-sm font-semibold">
            <span>Login mobile number</span>
            <PhoneNumberInput country={country} onCountryChange={setCountry} value={phone} onValueChange={setPhone} />
          </label>
        </div>
        <FeaturePicker selected={permissions} onToggle={togglePermission} />
        <Button type="submit" disabled={saving}>{saving ? "Adding…" : "Add sub-admin"}</Button>
      </form>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <UsersRound className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">Team access</h2>
        </div>
        {loading ? <p className="text-sm text-muted-foreground">Loading sub-admins…</p> : admins.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No sub-admins added yet.</div>
        ) : admins.map((admin) => (
          <AdminRow
            key={admin.userId}
            admin={admin}
            onSave={saveAdmin}
          />
        ))}

      </section>
    </div>
  );
}

function FeaturePicker({ selected, onToggle }: { selected: AdminPermission[]; onToggle: (key: AdminPermission) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">Features shown to this sub-admin</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ADMIN_FEATURES.filter((feature) => feature.key !== "sub_admins").map((feature) => (
          <label key={feature.key} className="flex min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
            <Checkbox checked={selected.includes(feature.key)} onCheckedChange={() => onToggle(feature.key)} />
            <span className="min-w-0">{feature.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}