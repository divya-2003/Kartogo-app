// Ride fares — shared by the /rides page and server so the price shown is the price charged.
export type Vehicle = "bike" | "auto" | "car";

export const VEHICLES: { id: Vehicle; label: string; seats: number; base: number; perKm: number; speedKmh: number; icon: string }[] = [
  { id: "bike", label: "Bike", seats: 1, base: 20, perKm: 7, speedKmh: 28, icon: "🏍️" },
  { id: "auto", label: "Auto", seats: 3, base: 30, perKm: 12, speedKmh: 22, icon: "🛺" },
  { id: "car", label: "Car", seats: 4, base: 60, perKm: 18, speedKmh: 30, icon: "🚗" },
];

export type Pt = { lat: number; lng: number };

export function distanceKm(a: Pt, b: Pt) {
  const R = 6371, rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  // 1.25 × straight line ≈ road distance
  return Math.max(0.5, 2 * R * Math.asin(Math.sqrt(h)) * 1.25);
}

export function quote(v: Vehicle, km: number) {
  const c = VEHICLES.find(x => x.id === v)!;
  return { fare: Math.round(c.base + c.perKm * km), minutes: Math.max(3, Math.round((km / c.speedKmh) * 60)) };
}
