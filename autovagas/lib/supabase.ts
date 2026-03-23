import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Server-side Supabase client using service role key (bypasses RLS)
// RLS is enforced at the bucket level for direct client access:
//   Bucket 'cvs' policy: authenticated users can only read/write their own files
//   Policy expression: (auth.uid()::text = storage.foldername(name)[1])
export const supabase = createClient(supabaseUrl, supabaseServiceKey)
