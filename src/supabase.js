import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export async function savePalette({ colorA, colorB, colorMix, scheme, schemeHues, baseHue }) {
  const { data, error } = await supabase
    .from('color_palettes')
    .insert({ color_a: colorA, color_b: colorB, color_mix: colorMix, scheme, scheme_hues: schemeHues, base_hue: baseHue })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function loadPalettes(limit = 12) {
  const { data, error } = await supabase
    .from('color_palettes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}
