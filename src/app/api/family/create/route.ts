import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ success: false, error: 'اسم العائلة مطلوب' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'غير مصرح' }, { status: 401 });
    }

    // Call the RPC that creates the family and updates the user
    const { data: rpcData, error: rpcError } = await supabase.rpc('create_user_family');
    
    if (rpcError) {
      return NextResponse.json({ success: false, error: rpcError.message }, { status: 500 });
    }
    
    if (!rpcData || !rpcData.success) {
       return NextResponse.json({ success: false, error: rpcData?.error || 'فشل إنشاء العائلة' }, { status: 500 });
    }

    // Now update the family name
    const { error: updateError } = await supabase
      .from('families')
      .update({ name: name.trim() })
      .eq('id', rpcData.family_id);
      
    if (updateError) {
       console.error('Failed to update family name:', updateError);
       // We still return success because the family was created
    }

    return NextResponse.json({ success: true, family_id: rpcData.family_id, name: name.trim() });
    
  } catch (error) {
    console.error('Create family error:', error);
    return NextResponse.json({ success: false, error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
