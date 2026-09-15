import type { ShipDesign } from '../engine/types'
import { normaliseDesign } from '../data/designFile'
import { explain, supabaseClient, supabaseReady } from './supabaseLink'

/**
 * Designs other players have published.
 *
 * The same Supabase project that keeps the matches keeps a table of designs,
 * behind two functions: one that takes a design and an author's name, one
 * that lists what has been published. Nothing on the server knows what a
 * design is — it stores the JSON the shipyard wrote — so everything that
 * comes back is put through `normaliseDesign` before it is shown: repriced
 * from the tables, checked against the same validator the shipyard refuses
 * to save past, and dropped if it fails. A published hull that lies about
 * its points is priced honestly on every table it reaches.
 *
 * There is no account and no delete. The anon key can publish and list, and
 * that is all; taking something down is done in the project's SQL editor.
 */
export interface CommunityDesign {
  /** The row's id. */
  id: string
  author: string
  publishedAt: string
  design: ShipDesign
}

/** The most the list asks for; a shelf, not a search engine. */
const LIST_LIMIT = 200

export function communityAvailable(): boolean {
  return supabaseReady()
}

/** Put a design on the shelf. Resolves to the row's id, or a reason. */
export async function publishDesign(
  design: ShipDesign,
  author: string,
): Promise<{ id: string } | { error: string }> {
  if (!communityAvailable()) return { error: 'This build has no Supabase project to publish to.' }
  const checked = normaliseDesign(design)
  if (typeof checked === 'string') return { error: checked }
  const { data, error } = await supabaseClient().rpc('publish_design', {
    p_design: checked,
    p_author: author.trim().slice(0, 40),
  })
  if (error) return { error: `Could not publish: ${explainDesigns(error)}` }
  return { id: String(data) }
}

/** What has been published, newest first. */
export async function listCommunityDesigns(): Promise<CommunityDesign[] | { error: string }> {
  if (!communityAvailable()) return { error: 'This build has no Supabase project to read from.' }
  const { data, error } = await supabaseClient().rpc('list_designs', { p_limit: LIST_LIMIT })
  if (error) return { error: `Could not read the shelf: ${explainDesigns(error)}` }
  if (!Array.isArray(data)) return []
  const out: CommunityDesign[] = []
  for (const row of data as unknown[]) {
    if (typeof row !== 'object' || row === null) continue
    const r = row as { id?: unknown; author?: unknown; created_at?: unknown; design?: unknown }
    const design = normaliseDesign(r.design)
    if (typeof design === 'string') continue
    out.push({
      id: String(r.id ?? ''),
      author: typeof r.author === 'string' ? r.author : '',
      publishedAt: typeof r.created_at === 'string' ? r.created_at : '',
      design,
    })
  }
  return out
}

/** The one failure a first setup hits: a project without the design functions. */
function explainDesigns(error: { code?: string; message: string }): string {
  if (error.code === 'PGRST202' || /could not find the function/i.test(error.message)) {
    return 'the project has no design functions yet — run supabase/schema.sql in its SQL editor.'
  }
  return explain(error)
}
