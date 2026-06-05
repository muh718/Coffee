import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const email = `test_${Date.now()}@test.com`;
  const password = 'password123';
  
  console.log(`Creating user ${email}...`);
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name: 'Test User' }
    }
  });

  if (signUpError) {
    console.error('Sign up error:', signUpError);
    return;
  }
  console.log('User created:', signUpData.user?.id);

  console.log('Fetching profile...');
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*, families(name, owner_id)')
    .eq('id', signUpData.user?.id)
    .single();

  if (profileError) {
    console.error('Profile fetch error:', profileError);
  } else {
    console.log('Profile fetched successfully:', profile);
  }

  // Create a family to test
  console.log('Creating family...');
  const { data: rpcData, error: rpcError } = await supabase.rpc('create_user_family');
  if (rpcError) console.error('RPC Error:', rpcError);
  else console.log('RPC Success:', rpcData);

  console.log('Fetching profile again...');
  const { data: profile2, error: profileError2 } = await supabase
    .from('users')
    .select('*, families(name, owner_id)')
    .eq('id', signUpData.user?.id)
    .single();

  if (profileError2) {
    console.error('Profile fetch error 2:', profileError2);
  } else {
    console.log('Profile fetched successfully 2:', profile2);
  }
}

test();
