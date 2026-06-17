import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://jmitmxjpvqgnlutjxyos.supabase.co"
const SUPABASE_ANON_KEY = "sb_publishable_lvcFIpYG2o-g_eqyzRoa4A_XKD0s3oq"

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)