import { describe, expect, it } from "vitest";
import { checkRideOtp, NEXT_STATUS } from "./ride-otp";

describe("ride start code", () => {
  it("starts the ride when the customer's code matches", () => {
    expect(checkRideOtp("4821", "4821", 0)).toEqual({ ok: true });
  });
  it("refuses a wrong code", () => {
    expect(checkRideOtp("4821", "1111", 0)).toMatchObject({ ok: false, reason: "wrong", attemptsLeft: 4 });
  });
  it("locks after 5 wrong tries", () => {
    expect(checkRideOtp("4821", "4821", 5)).toMatchObject({ ok: false, reason: "locked" });
  });
  it("needs a code before starting", () => {
    expect(checkRideOtp("4821", "", 0)).toMatchObject({ ok: false, reason: "missing" });
  });
  it("collects the fare at the destination before completing", () => {
    expect(NEXT_STATUS.RIDE.IN_TRIP).toBe("AT_DROP");
    expect(NEXT_STATUS.RIDE.AT_DROP).toBe("COMPLETED");
  });
});
