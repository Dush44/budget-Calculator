import { createClient } from '@supabase/supabase-js'

// Replace these with your actual Supabase project credentials
const supabaseUrl = 'https://tznkbyaoicklmxollgzh.supabase.co/rest/v1/'
const supabaseKey = 'sb_publishable_zS_PVyN7nnX00sqjVg-5oA_Wdn3jLoV'

export const supabase = createClient(supabaseUrl, supabaseKey)