// Server-only SMS delivery via the Twilio connector gateway.
const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

export async function sendSms(to: string, body: string): Promise<void> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const twilioKey = process.env.TWILIO_API_KEY;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!lovableKey || !twilioKey || !from) {
    throw new Error("SMS sending is not configured");
  }

  // Twilio expects form-encoded bodies, not JSON.
  const res = await fetch(`${GATEWAY_URL}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": twilioKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("Twilio send failed", res.status, detail);
    throw new Error("Could not send the verification code. Please try again.");
  }
}
