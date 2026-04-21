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
      location_id,
      clinic_id
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
    let resolvedClinicId = clinic_id ?? null;

    if (!location_id) {
      return new Response(
        JSON.stringify({ error: "Missing location_id" }),
        { status: 400 }
      );
    }

    const { data: locationRow, error: locationError } = await supabase
      .from("locations")
      .select("id,is_placeholder,market_status")
      .eq("id", location_id)
      .maybeSingle();

    if (locationError) {
      return new Response(
        JSON.stringify({ error: locationError.message }),
        { status: 400 }
      );
    }

    if (!locationRow?.id) {
      return new Response(
        JSON.stringify({ error: "Selected location was not found." }),
        { status: 400 }
      );
    }

    if (locationRow.is_placeholder || locationRow.market_status === "coming_soon") {
      return new Response(
        JSON.stringify({ error: "Coming soon markets cannot be assigned to staff until they are activated." }),
        { status: 400 }
      );
    }

    if (!resolvedClinicId) {
      const { data: clinicLocationRow, error: clinicLocationError } = await supabase
        .from("clinic_locations")
        .select("clinic_id")
        .eq("location_id", location_id)
        .limit(1)
        .maybeSingle();

      if (!clinicLocationError && clinicLocationRow?.clinic_id) {
        resolvedClinicId = clinicLocationRow.clinic_id;
      }
    }

    // create profile
    const { error: profileError } =
      await supabase.from("profiles").insert({
        id: userId,
        first_name,
        last_name,
        role,
        active_location_id: location_id,
        active_clinic_id: resolvedClinicId
      });

    if (profileError) {
      return new Response(
        JSON.stringify({ error: profileError.message }),
        { status: 400 }
      );
    }

    const { error: resetPrimaryLocationError } = await supabase
      .from("user_locations")
      .update({ is_primary: false })
      .eq("user_id", userId);

    if (resetPrimaryLocationError) {
      return new Response(
        JSON.stringify({ error: resetPrimaryLocationError.message }),
        { status: 400 }
      );
    }

    const { data: existingUserLocation, error: existingUserLocationError } = await supabase
      .from("user_locations")
      .select("id")
      .eq("user_id", userId)
      .eq("location_id", location_id)
      .maybeSingle();

    if (existingUserLocationError) {
      return new Response(
        JSON.stringify({ error: existingUserLocationError.message }),
        { status: 400 }
      );
    }

    if (existingUserLocation?.id) {
      const { error: updateUserLocationError } = await supabase
        .from("user_locations")
        .update({ is_primary: true })
        .eq("id", existingUserLocation.id);

      if (updateUserLocationError) {
        return new Response(
          JSON.stringify({ error: updateUserLocationError.message }),
          { status: 400 }
        );
      }
    } else {
      const { error: insertUserLocationError } = await supabase
        .from("user_locations")
        .insert({
          user_id: userId,
          location_id,
          is_primary: true
        });

      if (insertUserLocationError) {
        return new Response(
          JSON.stringify({ error: insertUserLocationError.message }),
          { status: 400 }
        );
      }
    }

    if (resolvedClinicId) {
      const { error: clinicUserError } = await supabase
        .from("clinic_users")
        .upsert(
          {
            clinic_id: resolvedClinicId,
            user_id: userId,
            role,
            is_active: true
          },
          { onConflict: "clinic_id,user_id" }
        );

      if (clinicUserError && !clinicUserError.message?.toLowerCase().includes("does not exist")) {
        return new Response(
          JSON.stringify({ error: clinicUserError.message }),
          { status: 400 }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        clinic_id: resolvedClinicId
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
