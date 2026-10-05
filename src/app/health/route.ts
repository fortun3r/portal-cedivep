import { config } from '@/lib/config'
import { getHealth } from '@/lib/server-state'

export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'no-store' }

/** Diagnostics: which driver, row counts and the results window. Never the DB host or raw errors. */
export async function GET() {
  try {
    return Response.json({ ok: true, driver: config.driver, demo: config.demo, ...(await getHealth()) }, { headers })
  } catch (e) {
    console.error('[health]', e)
    return Response.json({ ok: false, driver: config.driver }, { status: 500, headers })
  }
}
