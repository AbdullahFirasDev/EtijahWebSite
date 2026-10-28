// Shared globe geometry. Used by the WebGL scene and by scripts/build-globe.mjs
// (which renders the matching static fallback), so keep this file dependency-free.

export type Vec3 = [number, number, number];
export type LatLng = readonly [lat: number, lng: number];

export const DEG = Math.PI / 180;

/** Office origin, from the company's Google Maps pin. */
export const NAJAF: LatLng = [32.0181, 44.3416];

/** Route endpoints shown on the globe; keys match the destination gallery. */
export const ROUTE_TARGETS: Record<string, LatLng> = {
  istanbul: [41.0082, 28.9784],
  dubai: [25.2048, 55.2708],
  maldives: [4.1755, 73.5093],
  kualaLumpur: [3.139, 101.6869],
  tbilisi: [41.7151, 44.8271],
  cairo: [30.0444, 31.2357],
};

/** The longitude/latitude that faces the viewer at rest. */
export const VIEW_CENTER = { lng: 60, lat: 22 };

/** Group rotations that bring VIEW_CENTER to face a camera on the +Z axis. */
export function viewRotation(lng = VIEW_CENTER.lng, lat = VIEW_CENTER.lat) {
  return { x: lat * DEG, y: -(lng + 90) * DEG };
}

export function latLngToVector(lat: number, lng: number, radius = 1): Vec3 {
  const phi = (90 - lat) * DEG;
  const theta = (lng + 180) * DEG;
  return [
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  ];
}

/** Great-circle arc between two points, lifted off the surface in proportion to its length. */
export function arcPoints(from: LatLng, to: LatLng, segments = 64): Vec3[] {
  const a = latLngToVector(from[0], from[1]);
  const b = latLngToVector(to[0], to[1]);
  const cos = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const omega = Math.acos(cos);
  const sinOmega = Math.sin(omega) || 1;
  const lift = 0.06 + omega * 0.42;
  const points: Vec3[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const wa = Math.sin((1 - t) * omega) / sinOmega;
    const wb = Math.sin(t * omega) / sinOmega;
    const r = 1 + lift * Math.sin(Math.PI * t);
    points.push([(a[0] * wa + b[0] * wb) * r, (a[1] * wa + b[1] * wb) * r, (a[2] * wa + b[2] * wb) * r]);
  }
  return points;
}

/** Applies the same Y-then-X rotation the scene graph uses (inner group spins, outer group tilts). */
export function rotateView([x, y, z]: Vec3, rot = viewRotation()): Vec3 {
  const cy = Math.cos(rot.y);
  const sy = Math.sin(rot.y);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const cx = Math.cos(rot.x);
  const sx = Math.sin(rot.x);
  return [x1, y * cx - z1 * sx, y * sx + z1 * cx];
}
