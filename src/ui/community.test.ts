import { afterEach, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import { listCommunityDesigns, publishDesign } from './community'
import { useSupabaseClientForTests } from './supabaseLink'
import { SHIP_DESIGNS } from '../data/ships'
import { priceDesign } from '../data/designPricing'

/**
 * The shelf, against a fake project: what goes up comes back, repriced and
 * checked, and what is not a legal design never reaches the shelf at all.
 */
const frigate = SHIP_DESIGNS.find((d) => d.id === 'esu-frigate')!

function fakeProject() {
  const rows: Array<{ id: string; author: string; created_at: string; design: unknown }> = []
  const client = {
    rpc(name: string, args: Record<string, unknown>) {
      switch (name) {
        case 'publish_design': {
          const id = `row-${rows.length + 1}`
          rows.push({
            id,
            author: String(args.p_author),
            created_at: new Date(2026, 0, rows.length + 1).toISOString(),
            design: args.p_design,
          })
          return Promise.resolve({ data: id, error: null })
        }
        case 'list_designs':
          return Promise.resolve({ data: [...rows].reverse(), error: null })
        default:
          return Promise.resolve({ data: null, error: { message: `no such function ${name}` } })
      }
    },
  }
  return { client: client as unknown as SupabaseClient, rows }
}

describe('the community shelf', () => {
  afterEach(() => useSupabaseClientForTests(null))

  it('publishes a design and lists it back, priced from the tables', async () => {
    const project = fakeProject()
    useSupabaseClientForTests(project.client)
    const published = await publishDesign({ ...frigate, points: 1 }, '  Ada  ')
    expect(published).toEqual({ id: 'row-1' })
    expect(project.rows[0]?.author).toBe('Ada')
    const listed = await listCommunityDesigns()
    if ('error' in listed) throw new Error(listed.error)
    expect(listed).toHaveLength(1)
    expect(listed[0]?.design.points).toBe(priceDesign(frigate).points)
    expect(listed[0]?.author).toBe('Ada')
  })

  it('refuses to publish an illegal hull, and drops one that reached the shelf', async () => {
    const project = fakeProject()
    useSupabaseClientForTests(project.client)
    const refused = await publishDesign({ ...frigate, mass: 10 }, 'Ada')
    expect('error' in refused && refused.error).toMatch(/Not a legal design/)
    // Something got a bad row in by other means.
    project.rows.push({ id: 'bad', author: 'x', created_at: '', design: { id: 'bad' } })
    const listed = await listCommunityDesigns()
    if ('error' in listed) throw new Error(listed.error)
    expect(listed).toHaveLength(0)
  })

  it('says what to do about a project without the functions', async () => {
    const project = fakeProject()
    const bare = project.client as unknown as { rpc: () => Promise<unknown> }
    bare.rpc = () =>
      Promise.resolve({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } })
    useSupabaseClientForTests(project.client)
    const listed = await listCommunityDesigns()
    expect('error' in listed && listed.error).toMatch(/schema\.sql/)
  })

  it('is not available without a project', async () => {
    const listed = await listCommunityDesigns()
    expect('error' in listed && listed.error).toMatch(/no Supabase project/)
  })
})
