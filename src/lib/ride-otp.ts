// Ride start code rules, shared by the server (verification) and tests.

/** Wrong tries allowed before the ride can no longer be started with a code. */
export const MAX_RIDE_OTP_ATTEMPTS = 5;

export type RideOtpCheck =
  | { ok: true }
  | { ok: false; reason: "missing" | "locked" | "wrong"; attemptsLeft: number };

/** Checks the 4-digit code the customer reads out at pickup. */
export function checkRideOtp(stored: string | null | undefined, given: string | null | undefined, attempts: number): RideOtpCheck {
  if (attempts >= MAX_RIDE_OTP_ATTEMPTS) return { ok: false, reason: "locked", attemptsLeft: 0 };
  const code = String(given ?? "").replace(/\D/g, "");
  if (code.length !== 4) return { ok: false, reason: "missing", attemptsLeft: MAX_RIDE_OTP_ATTEMPTS - attempts };
  // Rides booked before codes existed have no code; those can start without one.
  if (!stored) return { ok: true };
  if (code === stored) return { ok: true };
  return { ok: false, reason: "wrong", attemptsLeft: Math.max(0, MAX_RIDE_OTP_ATTEMPTS - attempts - 1) };
}

/** Status that comes after `status` for a delivery partner job. */
export const NEXT_STATUS: Record<string, Record<string, string>> = {
  FOOD: { ACCEPTED: "PICKED_UP", PICKED_UP: "DELIVERED" },
  // ARRIVED -> IN_TRIP needs the customer's start code.
  // AT_DROP = reached the destination, collecting the fare.
  RIDE: { ACCEPTED: "ARRIVED", ARRIVED: "IN_TRIP", IN_TRIP: "AT_DROP", AT_DROP: "COMPLETED" },
};
