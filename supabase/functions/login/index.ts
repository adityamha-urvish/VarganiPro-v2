import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bcrypt from "https://esm.sh/bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface LoginRequest {
  mobile: string;
  pin: string;
}

Deno.serve(async (req) => {
  // =====================================================
  // CORS
  // =====================================================

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        error: "Method not allowed",
      }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }

  try {
    // ===================================================
    // READ REQUEST
    // ===================================================

    const body =
      (await req.json()) as LoginRequest;

    const mobile =
      body.mobile?.trim();

    const pin =
      body.pin?.trim();

    // ===================================================
    // VALIDATION
    // ===================================================

    if (
      !mobile ||
      !/^\d{10}$/.test(mobile)
    ) {
      return new Response(
        JSON.stringify({
          error:
            "Enter a valid 10 digit mobile number",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        },
      );
    }

    if (
      !pin ||
      !/^\d{4}$/.test(pin)
    ) {
      return new Response(
        JSON.stringify({
          error: "PIN must be 4 digits",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        },
      );
    }

    // ===================================================
    // SUPABASE ADMIN CLIENT
    // ===================================================

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL");

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY",
      );

    if (
      !supabaseUrl ||
      !serviceRoleKey
    ) {
      throw new Error(
        "Supabase environment variables are missing",
      );
    }

    const supabase =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        },
      );

    // ===================================================
    // RATE LIMIT CHECK
    // ===================================================

    const {
      data: rateLimitData,
      error: rateLimitError,
    } = await supabase.rpc(
      "login_rate_limit",
      {
        p_mobile: mobile,
        p_ip: "",
        p_action: "check",
      },
    );

    if (rateLimitError) {
      console.error(
        "Rate limit check failed:",
        rateLimitError,
      );

      return new Response(
        JSON.stringify({
          error:
            "Unable to process login right now",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        },
      );
    }

    if (
      rateLimitData &&
      rateLimitData.allowed === false
    ) {
      return new Response(
        JSON.stringify({
          error:
            "Too many failed attempts. Please try again later.",
          locked_until:
            rateLimitData.locked_until,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        },
      );
    }

    // ===================================================
    // FIND APPLICATION USER
    // ===================================================

    const {
      data: user,
      error: userError,
    } = await supabase
      .from("users")
      .select(
        "id, name, mobile, pin_hash, role, is_active, auth_user_id",
      )
      .eq("mobile", mobile)
      .maybeSingle();

    if (userError) {
      console.error(
        "User lookup failed:",
        userError,
      );

      return new Response(
        JSON.stringify({
          error:
            "Unable to process login",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        },
      );
    }

    // ===================================================
    // USER NOT FOUND / INACTIVE
    // ===================================================

    if (
      !user ||
      !user.is_active ||
      !user.pin_hash
    ) {
      await supabase.rpc(
        "login_rate_limit",
        {
          p_mobile: mobile,
          p_ip: "",
          p_action: "failure",
        },
      );

      return new Response(
        JSON.stringify({
          error:
            "Invalid mobile number or PIN",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        },
      );
    }

    // ===================================================
    // VERIFY PIN
    // ===================================================

    const pinValid =
      await bcrypt.compare(
        pin,
        user.pin_hash,
      );

    if (!pinValid) {
      await supabase.rpc(
        "login_rate_limit",
        {
          p_mobile: mobile,
          p_ip: "",
          p_action: "failure",
        },
      );

      return new Response(
        JSON.stringify({
          error:
            "Invalid mobile number or PIN",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        },
      );
    }

    // ===================================================
    // SUCCESSFUL PIN VERIFICATION
    // ===================================================

    await supabase.rpc(
      "login_rate_limit",
      {
        p_mobile: mobile,
        p_ip: "",
        p_action: "success",
      },
    );

    // ===================================================
    // INTERNAL AUTH IDENTITY
    //
    // The user continues to log in with:
    // Mobile + 4 digit PIN
    //
    // Supabase internally uses:
    // mobile@auth.varganipro.local
    //
    // No SMS is required.
    // ===================================================

    const internalEmail =
      `${mobile}@auth.varganipro.local`;

    let authUserId =
      user.auth_user_id;

    // ===================================================
    // CREATE AUTH USER IF NEEDED
    // ===================================================

    if (!authUserId) {
      const {
        data: authUserData,
        error: authUserError,
      } =
        await supabase.auth.admin.createUser(
          {
            email: internalEmail,
            email_confirm: true,
            user_metadata: {
              app_user_id: user.id,
              name: user.name,
              role: user.role,
            },
          },
        );

      if (
        authUserError ||
        !authUserData.user
      ) {
        console.error(
          "Auth user creation failed:",
          authUserError,
        );

        return new Response(
          JSON.stringify({
            error:
              "Unable to create login session",
          }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              "Content-Type":
                "application/json",
            },
          },
        );
      }

      authUserId =
        authUserData.user.id;

      // Link Supabase Auth user
      // to our application user.
      const {
        error: updateError,
      } =
        await supabase
          .from("users")
          .update({
            auth_user_id:
              authUserId,
          })
          .eq("id", user.id);

      if (updateError) {
        console.error(
          "Failed to link application user:",
          updateError,
        );

        return new Response(
          JSON.stringify({
            error:
              "Unable to complete login",
          }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              "Content-Type":
                "application/json",
            },
          },
        );
      }
    }

    // ===================================================
    // PREPARE INTERNAL AUTH SESSION
    //
    // This password is NOT the user's PIN.
    // It is a temporary internal password used only
    // to establish the Supabase Auth session.
    // ===================================================

    const temporaryPassword =
      crypto.randomUUID();

    const {
      error: passwordError,
    } =
      await supabase.auth.admin
        .updateUserById(
          authUserId,
          {
            email:
              internalEmail,
            email_confirm: true,
            password:
              temporaryPassword,
          },
        );

    if (passwordError) {
      console.error(
        "Failed to prepare auth session:",
        passwordError,
      );

      return new Response(
        JSON.stringify({
          error:
            "Unable to create login session",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        },
      );
    }

    // ===================================================
    // CREATE SUPABASE SESSION
    // ===================================================

    const {
      data: sessionData,
      error: sessionError,
    } =
      await supabase.auth
        .signInWithPassword({
          email:
            internalEmail,
          password:
            temporaryPassword,
        });

    if (
      sessionError ||
      !sessionData.session
    ) {
      console.error(
        "Session creation failed:",
        sessionError,
      );

      return new Response(
        JSON.stringify({
          error:
            "Unable to create login session",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        },
      );
    }

    // ===================================================
    // SUCCESS
    // ===================================================

    return new Response(
      JSON.stringify({
        user: {
          id: user.id,
          name: user.name,
          mobile: user.mobile,
          role: user.role,
        },
        session:
          sessionData.session,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      },
    );
  } catch (error) {
    // ===================================================
    // UNEXPECTED ERROR
    // ===================================================

    console.error(
      "Login function error:",
      error,
    );

    return new Response(
      JSON.stringify({
        error:
          "Unable to process login",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "application/json",
        },
      },
    );
  }
});