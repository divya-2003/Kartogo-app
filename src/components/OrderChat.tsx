import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { X, Send, Phone } from "lucide-react";
import { sendMessageFn, listMessagesFn, initiateMaskedCallFn } from "@/lib/chat.functions";

type Message = {
  id: string;
  order_id: string;
  sender_role: "customer" | "driver" | "admin";
  sender_id: string;
  body: string;
  created_at: string;
};

type Props = {
  token: string;
  orderId: string;
  myRole: "customer" | "driver";
  peerLabel: string; // e.g. "Delivery partner" or "Customer"
  onClose: () => void;
};

export function OrderChat({ token, orderId, myRole, peerLabel, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const rows = await listMessagesFn({ data: { token, orderId } });
      setMessages(rows as unknown as Message[]);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, [token, orderId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => { void load(); }, 5000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      const row = await sendMessageFn({ data: { token, orderId, body } });
      setMessages(m => [...m, row as unknown as Message]);
      setText("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setSending(false); }
  };

  const call = async () => {
    try {
      const res = await initiateMaskedCallFn({ data: { token, orderId } });
      toast.success(res.message);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="flex h-[80vh] w-full max-w-md flex-col rounded-t-2xl bg-card shadow-pop sm:h-[600px] sm:rounded-2xl">
        <header className="flex items-center gap-2 border-b border-border p-3">
          <div>
            <div className="font-display text-base font-bold">Chat · {orderId}</div>
            <div className="text-xs text-muted-foreground">{peerLabel} — numbers are private</div>
          </div>
          <button
            onClick={call}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
            aria-label="Call via masked line"
          >
            <Phone className="h-3.5 w-3.5" /> Call
          </button>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-secondary" aria-label="Close chat">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto p-3">
          {messages.length === 0 ? (
            <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
              Say hello — messages are only visible to you, the {peerLabel.toLowerCase()}, and support.
            </div>
          ) : (
            messages.map(m => {
              const mine = m.sender_role === myRole;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                    <div>{m.body}</div>
                    <div className={`mt-0.5 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {new Date(m.created_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form
          onSubmit={e => { e.preventDefault(); void send(); }}
          className="flex items-center gap-2 border-t border-border p-3"
        >
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Type a message…"
            maxLength={2000}
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            <Send className="h-4 w-4" /> Send
          </button>
        </form>
      </div>
    </div>
  );
}
