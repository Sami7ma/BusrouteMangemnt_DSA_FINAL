import { createClient } from '@supabase/supabase-js'

// Server-only admin client — bypasses RLS
// NEVER import this in a "use client" component — only in /api routes
export const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)
