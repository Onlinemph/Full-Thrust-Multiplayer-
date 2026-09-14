/// <reference types="vite/client" />

/**
 * Build-time configuration, read off `import.meta.env`.
 *
 * Both are optional: without them the app is exactly what it was — hot-seat,
 * the computer, and remote play by pasted codes — and the Supabase section of
 * the remote-play panel says how to switch it on.
 */
interface ImportMetaEnv {
  /** The project's URL, `https://<ref>.supabase.co`. */
  readonly VITE_SUPABASE_URL?: string
  /** The project's anon (publishable) key. Safe in a browser: the schema's RLS is what guards the data. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}
