// No top-level imports: Next also builds an Edge bundle of this file.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { startup } = await import('./lib/startup')
  await startup()
}
