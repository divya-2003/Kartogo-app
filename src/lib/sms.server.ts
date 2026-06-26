// Server-only SMS delivery via the Twilio connector gateway.
const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

export async function sendSms(to: string, body: string): Promise<void> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const twilioKey = process.env.TWILIO_API_KEY;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const from = process.env.TWILIO_FROM_NUMBER;

  // Prefer a Messaging Service SID; fall back to a raw From number if set.
  if (!lovableKey || !twilioKey || (!messagingServiceSid && !from)) {
    throw new Error("SMS sending is not configured");
  }

  // Twilio expects form-encoded bodies, not JSON.
  const params = new URLSearchParams({ To: to, Body: body });
  if (messagingServiceSid) {
    params.set("MessagingServiceSid", messagingServiceSid);
  } else if (from) {
    params.set("From", from);
  }

  const res = await fetch(`${GATEWAY_URL}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": twilioKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("Twilio send failed", res.status, detail);
    throw new Error("Could not send the verification code. Please try again.");
  }
}
