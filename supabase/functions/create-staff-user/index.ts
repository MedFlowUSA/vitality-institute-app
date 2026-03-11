import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {

    const body = await req.json();

    const {
      first_name,
      last_name,
      email,
      temp_password,
      role,
      location_id
    } = body;

    if (!email || !temp_password) {
      return new Response(
        JSON.stringify({ error: "Missing email or password" }),
        { status: 400 }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // create auth user
    const { data: userData, error: createError } =
      await supabase.auth.admin.createUser({
        email,
        password: temp_password,
        email_confirm: true
      });

    if (createError) {
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400 }
      );
    }

    const userId = userData.user.id;

    // create profile
    const { error: profileError } =
      await supabase.from("profiles").insert({
        id: userId,
        first_name,
        last_name,
        role,
        active_location_id: location_id
      });

    if (profileError) {
      return new Response(
        JSON.stringify({ error: profileError.message }),
        { status: 400 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId
      }),
      { status: 200 }
    );

  } catch (err) {

    return new Response(
      JSON.stringify({
        error: err.message
      }),
      { status: 500 }
    );

  }
});
