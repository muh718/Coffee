import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!query.trim()) {
      // No search query — return recent records
      const { data, error } = await supabase
        .from("records")
        .select(`
          *,
          creator:users!created_by(id, name, avatar_url),
          images(count)
        `)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      const records = (data || []).map((r: any) => ({
        ...r,
        image_count: r.images?.[0]?.count || 0,
        creator_name: r.creator?.name || "غير معروف",
      }));

      return NextResponse.json({ records, total: records.length });
    }

    // Use the deep_search function
    const { data, error } = await supabase.rpc("deep_search", {
      search_query: query,
      result_limit: limit,
      result_offset: offset,
    });

    if (error) throw error;

    return NextResponse.json({ records: data || [], total: (data || []).length });
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { records: [], total: 0, error: "Internal server error" },
      { status: 500 }
    );
  }
}
