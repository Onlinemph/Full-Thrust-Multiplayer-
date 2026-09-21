import { presetFromObject, type RulesPreset } from '../data/rulesPreset'
import { explain, supabaseClient, supabaseReady } from './supabaseLink'

/**
 * Rules presets other players have published: the same Supabase project
 * that keeps the matches and the design shelf, behind two functions. The
 * server stores the JSON; everything that comes back is put through the
 * preset parser before it is shown, so a bad row is dropped rather than
 * applied.
 */
export interface CommunityPreset {
  id: string
  author: string
  publishedAt: string
  preset: RulesPreset
}

const LIST_LIMIT = 200

export function communityPresetsAvailable(): boolean {
  return supabaseReady()
}

export async function publishPreset(preset: RulesPreset, author: string): Promise<{ id: string } | { error: string }> {
  if (!communityPresetsAvailable()) return { error: 'This build has no Supabase project to publish to.' }
  const checked = presetFromObject(preset)
  if (typeof checked === 'string') return { error: checked }
  const { data, error } = await supabaseClient().rpc('publish_preset', {
    p_preset: checked,
    p_author: author.trim().slice(0, 40),
  })
  if (error) return { error: `Could not publish: ${explainPresets(error)}` }
  return { id: String(data) }
}

export async function listCommunityPresets(): Promise<CommunityPreset[] | { error: string }> {
  if (!communityPresetsAvailable()) return { error: 'This build has no Supabase project to read from.' }
  const { data, error } = await supabaseClient().rpc('list_presets', { p_limit: LIST_LIMIT })
  if (error) return { error: `Could not read the shelf: ${explainPresets(error)}` }
  if (!Array.isArray(data)) return []
  const out: CommunityPreset[] = []
  for (const row of data as unknown[]) {
    if (typeof row !== 'object' || row === null) continue
    const r = row as { id?: unknown; author?: unknown; created_at?: unknown; preset?: unknown }
    const preset = presetFromObject(r.preset)
    if (typeof preset === 'string') continue
    out.push({
      id: String(r.id ?? ''),
      author: typeof r.author === 'string' ? r.author : '',
      publishedAt: typeof r.created_at === 'string' ? r.created_at : '',
      preset,
    })
  }
  return out
}

function explainPresets(error: { code?: string; message: string }): string {
  if (error.code === 'PGRST202' || /could not find the function/i.test(error.message)) {
    return 'the project has no preset functions yet — run supabase/schema.sql in its SQL editor.'
  }
  return explain(error)
}
