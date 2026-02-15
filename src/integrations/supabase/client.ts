
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://jjvtjuemmkmwkoxfzyng.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_hQJ92G4G60JPj1HBNRUR0A_5aa1zszf";

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
