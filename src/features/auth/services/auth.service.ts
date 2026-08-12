import { supabase } from "@/supabase/client";

export interface LoginRequest {
  mobile: string;
  pin: string;
}

interface LoginResponse {
  user: {
    id: string;
    name: string;
    mobile: string;
    role: string;
  };
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    expires_at?: number;
    token_type: string;
    user: {
      id: string;
      email?: string;
    };
  };
}

export async function login({
  mobile,
  pin,
}: LoginRequest) {
  const { data, error } =
    await supabase.functions.invoke<LoginResponse>(
      "login",
      {
        body: {
          mobile,
          pin,
        },
      }
    );

  if (error) {
    console.error("Login function error:", error);
    throw new Error("Unable to process login");
  }

  if (!data?.session || !data?.user) {
    throw new Error("Unable to create login session");
  }

  // -----------------------------------------------------
  // IMPORTANT:
  // Install the session returned by the Edge Function
  // into the browser's Supabase client.
  // -----------------------------------------------------

  const { error: sessionError } =
    await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });

  if (sessionError) {
    console.error(
      "Failed to set Supabase session:",
      sessionError
    );

    throw new Error(
      "Unable to establish authenticated session"
    );
  }

  // Verify that the browser now has the session.
  const {
    data: authData,
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    console.error(
      "Session verification failed:",
      authError
    );

    throw new Error(
      "Login session could not be verified"
    );
  }

  return data.user;
}