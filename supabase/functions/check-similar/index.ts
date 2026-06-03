// ============================================
// Supabase Edge Function: Check Similar Records
// ============================================
// Checks for duplicate/similar record names using fuzzy matching
// Endpoint: POST /functions/v1/check-similar

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { proposedName } = await req.json();

    if (!proposedName || proposedName.trim().length === 0) {
      return new Response(
        JSON.stringify({ matches: [], success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role for RLS bypass
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Call the find_similar_records function
    const { data, error } = await supabase.rpc("find_similar_records", {
      query_name: proposedName.trim(),
    });

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({
        matches: data || [],
        success: true,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Check similar error:", error);
    return new Response(
      JSON.stringify({
        matches: [],
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
