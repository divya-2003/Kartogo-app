import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/store";
import { Switch } from "@/components/ui/switch";
import { Clock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  listDeliverySlotsFn,
  saveDeliverySlotFn,
  deleteDeliverySlotFn,
  type DeliverySlot,
} from "@/lib/slots.functions";

export const Route = createFileRoute("/admin/slots")({ component: SlotsAdmin });

const hhmm = (t: string) => t.slice(0, 5);

function SlotsAdmin() {
  const { adminToken } = useAuth();
  const [slots, setSlots] = useState<DeliverySlot[]>([]);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ label: "", start: "08:00", end: "11:00" });

  const load = useCallback(async () => {
    if (!adminToken) return;
    const rows = await listDeliverySlotsFn({ data: { adminToken, includeInactive: true } });
    setSlots(rows);
  }, [adminToken]);

  useEffect(() => { void load(); }, [load]);

  const save = async (patch: Parameters<typeof saveDeliverySlotFn>[0]["data"]) => {
    setBusy(true);
    try {
      await saveDeliverySlotFn({ data: { ...patch, adminToken: adminToken ?? "" } });
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!draft.label.trim()) { toast.error("Give the slot a name, e.g. Evening"); return; }
    await save({
      label: draft.label.trim(),
      startTime: draft.start,
      endTime: draft.end,
      isActive: true,
      sortOrder: slots.length,
    });
    setDraft({ label: "", start: "08:00", end: "11:00" });
    toast.success("Time slot added");
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await deleteDeliverySlotFn({ data: { adminToken: adminToken ?? "", id } });
      await load();
      toast.success("Time slot removed");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Delivery time slots</h1>
        <p className="text-sm text-muted-foreground">
          Windows customers can book for standard deliveries.
        </p>
      </div>

      {/* Add a slot */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 font-display text-lg font-bold">Add a slot</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[10rem] flex-1">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Name</span>
            <input
              value={draft.label}
              onChange={e => setDraft(d => ({ ...d, label: e.target.value }))}
              placeholder="Evening"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">From</span>
            <input
              type="time"
              value={draft.start}
              onChange={e => setDraft(d => ({ ...d, start: e.target.value }))}
              className="rounded-xl border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label>
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">To</span>
            <input
              type="time"
              value={draft.end}
              onChange={e => setDraft(d => ({ ...d, end: e.target.value }))}
              className="rounded-xl border border-input bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <button
            onClick={add}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" /> Add slot
          </button>
        </div>
      </section>

      {/* Existing slots */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 font-display text-lg font-bold">Current slots</h2>
        {slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">No slots yet — add one above.</p>
        ) : (
          <ul className="space-y-3">
            {slots.map(s => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
                <Clock className="h-4 w-4 shrink-0 text-primary" />
                <input
                  defaultValue={s.label}
                  onBlur={e => { if (e.target.value.trim() !== s.label) void save({ id: s.id, label: e.target.value, startTime: s.start_time, endTime: s.end_time, isActive: s.is_active, sortOrder: s.sort_order }); }}
                  className="min-w-[8rem] flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  type="time"
                  defaultValue={hhmm(s.start_time)}
                  onBlur={e => void save({ id: s.id, label: s.label, startTime: e.target.value, endTime: s.end_time, isActive: s.is_active, sortOrder: s.sort_order })}
                  className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <input
                  type="time"
                  defaultValue={hhmm(s.end_time)}
                  onBlur={e => void save({ id: s.id, label: s.label, startTime: s.start_time, endTime: e.target.value, isActive: s.is_active, sortOrder: s.sort_order })}
                  className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="flex items-center gap-2">
                  <Switch
                    checked={s.is_active}
                    onCheckedChange={(v) => void save({ id: s.id, label: s.label, startTime: s.start_time, endTime: s.end_time, isActive: v, sortOrder: s.sort_order })}
                  />
                  <span className="text-xs font-semibold text-muted-foreground">
                    {s.is_active ? "Shown to customers" : "Hidden"}
                  </span>
                </div>
                <button
                  onClick={() => void remove(s.id)}
                  aria-label="Remove slot"
                  className="rounded-lg border border-border p-2 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
