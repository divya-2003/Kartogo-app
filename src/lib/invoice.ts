import type { Order } from "./store";
import { paymentBreakdown, PAYMENT_LABELS } from "./payment";

const BRAND = "Kartigo";
const PRIMARY: [number, number, number] = [15, 107, 122]; // teal #0f6b7a
const MUTED: [number, number, number] = [110, 110, 110];

function inr(n: number) {
  // jsPDF core fonts don't include the ₹ glyph — use "Rs." for clean output.
  return `Rs. ${Math.round(n).toLocaleString("en-IN")}`;
}

function when(at?: number) {
  if (!at) return "—";
  return new Date(at).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Builds and downloads a PDF invoice/receipt for a single order. */
export async function downloadInvoice(o: Order) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  let y = 50;

  // Header band
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, W, 90, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text(BRAND, M, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Tax Invoice / Receipt", M, 70);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`Invoice ${o.id}`, W - M, 50, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Status: ${o.status.replace(/_/g, " ")}`, W - M, 68, { align: "right" });

  y = 120;
  doc.setTextColor(0, 0, 0);

  // Order + customer meta (two columns)
  const colR = W / 2 + 10;
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("BILLED TO", M, y);
  doc.text("ORDER DETAILS", colR, y);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  y += 16;
  doc.setFont("helvetica", "bold");
  doc.text(o.customerName || "Customer", M, y);
  doc.setFont("helvetica", "normal");
  doc.text(`Placed: ${when(o.createdAt)}`, colR, y);
  y += 14;
  doc.text(o.customerPhone || "", M, y);
  if (o.status === "delivered") doc.text(`Delivered: ${when(o.updatedAt)}`, colR, y);
  else if (o.updatedAt) doc.text(`Updated: ${when(o.updatedAt)}`, colR, y);
  y += 14;
  const addrLines = doc.splitTextToSize(o.address || "", W / 2 - M);
  doc.text(addrLines, M, y);
  if (o.promoCode) doc.text(`Coupon: ${o.promoCode}`, colR, y);
  y += addrLines.length * 12 + 10;

  // Items table header
  doc.setFillColor(244, 244, 244);
  doc.rect(M, y, W - M * 2, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("ITEM", M + 8, y + 15);
  doc.text("QTY", W - M - 170, y + 15, { align: "right" });
  doc.text("PRICE", W - M - 90, y + 15, { align: "right" });
  doc.text("AMOUNT", W - M - 8, y + 15, { align: "right" });
  y += 22;

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  o.items.forEach(i => {
    y += 20;
    const name = doc.splitTextToSize(i.name, W - M * 2 - 220)[0];
    doc.text(String(name), M + 8, y);
    doc.text(String(i.qty), W - M - 170, y, { align: "right" });
    doc.text(inr(i.price), W - M - 90, y, { align: "right" });
    doc.text(inr(i.price * i.qty), W - M - 8, y, { align: "right" });
    doc.setDrawColor(235, 235, 235);
    doc.line(M, y + 8, W - M, y + 8);
  });

  y += 28;

  // Bill summary (right aligned block)
  const labelX = W - M - 170;
  const valX = W - M - 8;
  const sumRow = (label: string, value: string, opts?: { bold?: boolean; color?: [number, number, number] }) => {
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.setTextColor(...(opts?.color ?? [0, 0, 0]));
    doc.setFontSize(opts?.bold ? 11 : 10);
    doc.text(label, labelX, y);
    doc.text(value, valX, y, { align: "right" });
    y += 18;
  };

  sumRow("Item Total", inr(o.subtotal));
  sumRow("Delivery Fee", o.deliveryFee > 0 ? inr(o.deliveryFee) : "FREE");
  if (o.discount > 0) sumRow(`Discount${o.promoCode ? ` (${o.promoCode})` : ""}`, `- ${inr(o.discount)}`, { color: PRIMARY });
  doc.setDrawColor(180, 180, 180);
  doc.line(labelX - 10, y - 8, valX, y - 8);
  sumRow("Total", inr(o.total), { bold: true });

  y += 8;

  // Payment breakdown
  const b = paymentBreakdown(o);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text("Payment", M, y);
  y += 18;
  const payRow = (label: string, value: string, color?: [number, number, number]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...(color ?? [0, 0, 0]));
    doc.text(label, M, y);
    doc.text(value, valX, y, { align: "right" });
    y += 16;
  };
  payRow("Method", PAYMENT_LABELS[o.paymentMethod]);
  if (b.walletUsed > 0) payRow("Kartigo Cash used", inr(b.walletUsed), PRIMARY);
  if (b.otherUsed > 0) payRow(b.otherLabel, inr(b.otherUsed));
  payRow("Total paid", inr(o.total));

  if (o.refunded) {
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PRIMARY);
    doc.text(`Refunded ${inr(o.total)}${o.refundedAt ? ` on ${when(o.refundedAt)}` : ""}`, M, y);
    y += 16;
  }
  if (o.status === "cancelled" && o.cancelReason) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(`Cancellation reason: ${o.cancelReason}`, M, y);
    y += 16;
  }

  // Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const fy = doc.internal.pageSize.getHeight() - 40;
  doc.text(`Thank you for shopping with ${BRAND}.`, M, fy);
  doc.text(`Generated ${when(Date.now())}`, W - M, fy, { align: "right" });

  doc.save(`Kartigo-Invoice-${o.id}.pdf`);
}
