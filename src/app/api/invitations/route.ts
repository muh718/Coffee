/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { INVITATION_EXPIRY_MINUTES } from "@/lib/constants";

// POST — إنشاء دعوة جديدة
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // التحقق من أن المستخدم أدمن
    const { data: profile } = await supabase
      .from("users")
      .select("role, family_id")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin" || !profile.family_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const invitedRole = body.role === "admin" ? "admin" : "user";

    // توليد كود عشوائي من 6 أحرف
    const code = generateCode();
    const expiresAt = new Date(
      Date.now() + INVITATION_EXPIRY_MINUTES * 60 * 1000
    ).toISOString();

    const { data: invitation, error } = await supabase
      .from("invitations")
      .insert({
        family_id: profile.family_id,
        code,
        invited_role: invitedRole,
        created_by: user.id,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      console.error("Create invitation error:", error);
      return NextResponse.json(
        { error: "فشل إنشاء الدعوة" },
        { status: 500 }
      );
    }

    // تسجيل في سجل النشاط
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "CREATE_INVITATION",
      target_id: invitation.id,
      details: { code, role: invitedRole },
    });

    return NextResponse.json({ invitation, success: true });
  } catch (error) {
    console.error("Invitation API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET — جلب دعوات العائلة
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role, family_id")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin" || !profile.family_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: invitations, error } = await supabase
      .from("invitations")
      .select("*, creator:users!created_by(id, name)")
      .eq("family_id", profile.family_id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Fetch invitations error:", error);
      return NextResponse.json({ invitations: [] });
    }

    return NextResponse.json({ invitations: invitations || [] });
  } catch (error) {
    console.error("Invitations GET error:", error);
    return NextResponse.json({ invitations: [] });
  }
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
