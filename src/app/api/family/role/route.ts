import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'غير مصرح' }, { status: 401 });
    }

    const body = await request.json();
    if (!body.targetUserId || !body.role) {
      return NextResponse.json({ success: false, error: 'البيانات غير مكتملة' }, { status: 400 });
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc('change_family_role', {
      target_user_id: body.targetUserId,
      new_role: body.role
    });

    if (rpcError) {
      console.error('RPC Error:', rpcError);
      return NextResponse.json({ success: false, error: 'فشل في تغيير الصلاحية' }, { status: 500 });
    }

    if (!rpcData.success) {
      return NextResponse.json({ success: false, error: rpcData.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Change role exception:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
