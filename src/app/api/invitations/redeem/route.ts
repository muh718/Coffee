import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST — استرداد كود دعوة
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { code } = body;

    if (!code || code.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "يرجى إدخال كود الدعوة" },
        { status: 400 }
      );
    }

    // استدعاء دالة قاعدة البيانات
    const { data, error } = await supabase.rpc("redeem_invitation", {
      invite_code: code.trim().toUpperCase(),
    });

    if (error) {
      console.error("Redeem invitation RPC error:", error);
      return NextResponse.json(
        { success: false, error: "حدث خطأ أثناء معالجة الدعوة" },
        { status: 500 }
      );
    }

    if (!data.success) {
      return NextResponse.json(
        { success: false, error: data.error },
        { status: 400 }
      );
    }

    // تسجيل في سجل النشاط
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "REDEEM_INVITATION",
      details: { code: code.trim().toUpperCase(), family_id: data.family_id, role: data.role },
    });

    return NextResponse.json({
      success: true,
      family_id: data.family_id,
      role: data.role,
    });
  } catch (error) {
    console.error("Redeem API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
