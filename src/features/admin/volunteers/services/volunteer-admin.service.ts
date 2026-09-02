import { supabase } from "@/supabase/client";

export interface VolunteerRecord {
  volunteerId: string;
  userId: string;
  fullName: string;
  mobile: string;
  status: "active" | "inactive";
  mustChangePin: boolean;
  createdAt: string;
}

export interface ProvisionVolunteerResult {
  success: boolean;
  volunteerId: string;
  userId: string;
  isNewUser: boolean;
  temporaryPin: string | null;
}

export async function fetchVolunteers(
  organizationId: string
): Promise<VolunteerRecord[]> {
  const { data, error } = await supabase.rpc("get_organization_volunteers", {
    p_organization_id: organizationId,
  });

  if (error) {
    console.error("fetchVolunteers error:", error);
    throw new Error(error.message || "Failed to load volunteers");
  }

  return (data || []).map((row: any) => ({
    volunteerId: row.volunteer_id,
    userId: row.user_id,
    fullName: row.full_name,
    mobile: row.mobile,
    status: row.status as "active" | "inactive",
    mustChangePin: row.must_change_pin,
    createdAt: row.created_at,
  }));
}

export async function provisionVolunteer(
  organizationId: string,
  fullName: string,
  mobile: string
): Promise<ProvisionVolunteerResult> {
  const { data, error } = await supabase.rpc("provision_volunteer", {
    p_organization_id: organizationId,
    p_full_name: fullName.trim(),
    p_mobile: mobile.trim(),
  });

  if (error) {
    console.error("provisionVolunteer error:", error);
    throw new Error(error.message || "Failed to provision volunteer");
  }

  return {
    success: true,
    volunteerId: data.volunteer_id,
    userId: data.user_id,
    isNewUser: data.is_new_user,
    temporaryPin: data.temporary_pin ?? null,
  };
}

export async function resetVolunteerPin(
  volunteerId: string
): Promise<{ temporaryPin: string }> {
  const { data, error } = await supabase.rpc("reset_volunteer_pin", {
    p_volunteer_id: volunteerId,
  });

  if (error) {
    console.error("resetVolunteerPin error:", error);
    throw new Error(error.message || "Failed to reset PIN");
  }

  return {
    temporaryPin: data.temporary_pin,
  };
}

export async function setVolunteerStatus(
  volunteerId: string,
  status: "active" | "inactive"
): Promise<{ status: string }> {
  const { data, error } = await supabase.rpc("set_volunteer_status", {
    p_volunteer_id: volunteerId,
    p_status: status,
  });

  if (error) {
    console.error("setVolunteerStatus error:", error);
    throw new Error(error.message || "Failed to update volunteer status");
  }

  return {
    status: data.status,
  };
}
