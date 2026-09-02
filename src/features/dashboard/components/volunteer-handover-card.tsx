import {
  VolunteerHandoverForm,
  type VolunteerHandoverFormProps,
} from "@/features/analytics/components/volunteer-handover-form";
import type { VolunteerHandoverData } from "../hooks/use-volunteer-handover";

export type { VolunteerHandoverData };

export interface VolunteerHandoverCardProps extends VolunteerHandoverFormProps {}

export function VolunteerHandoverCard(props: VolunteerHandoverCardProps) {
  return <VolunteerHandoverForm {...props} />;
}
