import { supabase } from "@/supabase/client";
import { login } from "@/features/auth/services/auth.service";

export interface RegisterMandalParams {
  mandalName: string;
  adminName: string;
  mobile: string;
  pin: string;
}

export interface RegisterMandalResult {
  success: boolean;
  organizationId: string;
  userId: string;
  eventId: string;
  mandalName: string;
}

export async function registerMandalAndAdmin(
  params: RegisterMandalParams
): Promise<RegisterMandalResult> {
  const { data, error } = await supabase.rpc("register_mandal_and_admin", {
    p_mandal_name: params.mandalName.trim(),
    p_admin_name: params.adminName.trim(),
    p_mobile: params.mobile.trim(),
    p_pin: params.pin.trim(),
  });

  if (error) {
    console.error("register_mandal_and_admin error:", error);
    throw new Error(error.message || "Failed to register Mandal");
  }

  const result = data as {
    success: boolean;
    organization_id: string;
    user_id: string;
    event_id: string;
    mandal_name: string;
  };

  // Automatically log in the newly registered Admin
  const user = await login({
    mobile: params.mobile.trim(),
    pin: params.pin.trim(),
  });

  localStorage.setItem("vp_user", JSON.stringify(user));

  return {
    success: true,
    organizationId: result.organization_id,
    userId: result.user_id,
    eventId: result.event_id,
    mandalName: result.mandal_name,
  };
}
