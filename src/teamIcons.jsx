import { BriefcaseBusiness, CarFront, Headphones, ShieldCheck, Users } from "lucide-react";

export const TEAM_ICON_OPTIONS = [
  { id: "users", label: "Pessoas", Icon: Users },
  { id: "briefcase", label: "Comercial", Icon: BriefcaseBusiness },
  { id: "car", label: "Operação", Icon: CarFront },
  { id: "shield", label: "Qualidade", Icon: ShieldCheck },
  { id: "headphones", label: "Atendimento", Icon: Headphones },
];

export function TeamIcon({ name = "users", size = 14, ...props }) {
  const option = TEAM_ICON_OPTIONS.find((item) => item.id === name) || TEAM_ICON_OPTIONS[0];
  return <option.Icon size={size} aria-hidden="true" {...props} />;
}
