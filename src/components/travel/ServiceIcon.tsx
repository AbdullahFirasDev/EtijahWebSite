import { BedDouble, Bus, Camera, Check, Plane, ShieldCheck, Ship, Smartphone, Stamp, Ticket, TrainFront, UserRoundCheck, UtensilsCrossed, Compass } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

const ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  plane: Plane,
  hotel: BedDouble,
  meals: UtensilsCrossed,
  transfer: Bus,
  tours: Compass,
  guide: UserRoundCheck,
  visa: Stamp,
  insurance: ShieldCheck,
  ticket: Ticket,
  ship: Ship,
  train: TrainFront,
  camera: Camera,
  sim: Smartphone,
  check: Check,
};

export function ServiceIcon({ name, className = "size-4" }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Check;
  return <Icon className={className} strokeWidth={1.8} aria-hidden="true" />;
}
