// src/lib/supabase.ts
//
// Client Supabase cote navigateur. Utilise UNIQUEMENT la cle anon, qui est
// publique par conception et protegee par les policies RLS.
// La service_role key ne doit jamais apparaitre ici ni dans aucun fichier
// prefixe VITE_ : tout ce qui porte ce prefixe finit dans le bundle public.

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured
    ? createClient(url!, anonKey!)
    : null;
