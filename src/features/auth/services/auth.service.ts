import { supabase } from "@/supabase/client";

export interface LoginRequest {
  mobile: string;
  pin: string;
}

export async function login({
  mobile,
  pin,
}: LoginRequest) {
  const { data, error } = await supabase
    .from("users")
    .select("id, name, mobile, role, is_active")
    .eq("mobile", mobile)
    .single();

  if (error || !data) {
    throw new Error("Invalid mobile number or PIN");
  }

  if (!data.is_active) {
    throw new Error("User is inactive");
  }

  // Temporary check until we implement secure PIN verification
  if (pin !== "1234") {
    throw new Error("Invalid mobile number or PIN");
  }

  return data;
}