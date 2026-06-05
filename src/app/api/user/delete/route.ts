import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    const supabase = await createClient();

    // Verify session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'غير مصرح' }, { status: 401 });
    }

    // 1. Prepare account deletion (transfers records, ownership, cleans up families)
    const { data: prepareData, error: prepareError } = await supabase.rpc('prepare_account_deletion');
    
    if (prepareError || (prepareData && !prepareData.success)) {
      console.error('Error preparing account deletion:', prepareError || prepareData);
      return NextResponse.json(
        { success: false, error: prepareData?.error || 'حدث خطأ أثناء تنظيف الحساب' }, 
        { status: 500 }
      );
    }

    // 2. Delete the user from auth.users permanently
    const { data: deleteData, error: deleteError } = await supabase.rpc('delete_my_account');

    if (deleteError || (deleteData && !deleteData.success)) {
      console.error('Error deleting account:', deleteError || deleteData);
      return NextResponse.json(
        { success: false, error: 'حدث خطأ أثناء حذف الحساب' }, 
        { status: 500 }
      );
    }

    // 3. Clear the auth session cookie since the user is deleted
    await supabase.auth.signOut();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Delete account exception:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
