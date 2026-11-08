/**
 * Edge Functions return their reason as `{ error }` in the body, but
 * supabase.functions.invoke wraps any non-2xx in a generic "Edge Function
 * returned a non-2xx status code". Read the body so the user sees why.
 */
export async function readFunctionError(error: unknown): Promise<string> {
  const ctx = (error as { context?: unknown }).context;
  if (ctx instanceof Response) {
    try {
      const body = (await ctx.clone().json()) as { error?: string };
      if (body?.error) return body.error;
    } catch {
      // fall through to the generic message
    }
  }
  return error instanceof Error ? error.message : String(error);
}
