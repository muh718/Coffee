import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { proposedName } = body;

    if (!proposedName || proposedName.trim().length === 0) {
      return NextResponse.json({ matches: [], success: true });
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Call the database function directly
    const { data, error } = await supabase.rpc("find_similar_records", {
      proposed_name: proposedName.trim(),
    });

    if (error) {
      console.error("Similarity check error:", error);
      return NextResponse.json({ matches: [], success: true });
    }

    return NextResponse.json({
      matches: data || [],
      success: true,
    });
  } catch (error) {
    console.error("Check similar API error:", error);
    return NextResponse.json(
      { matches: [], success: false },
      { status: 500 }
    );
  }
}
