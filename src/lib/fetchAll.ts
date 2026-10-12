/**
 * Read every row a query matches, not just the first page.
 *
 * Supabase (PostgREST) caps each response at 1,000 rows by default, and a
 * larger `.limit()` does not lift that cap — the request silently comes back
 * with exactly 1,000. Any total built from one request therefore tops out at
 * 1,000 the moment the data grows past it. This pages through with `.range()`
 * until a short page says the end has been reached.
 *
 * Pages after the first are requested in parallel waves, so ~7,000 rows take
 * three round trips instead of eight one-after-another.
 *
 * `build` must return a fresh query each call, with a stable `.order()` so
 * pages don't overlap or skip rows.
 */
const PAGE = 1000;
const WAVE = 4;

type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<PageResult<T>>
): Promise<{ data: T[]; error: string | null }> {
  const page = (i: number) => build(i * PAGE, i * PAGE + PAGE - 1);

  // One page first: most queries fit in it, and it costs nothing extra.
  const first = await page(0);
  if (first.error) return { data: [], error: first.error.message };
  const all: T[] = [...(first.data ?? [])];
  if ((first.data?.length ?? 0) < PAGE) return { data: all, error: null };

  for (let next = 1; ; next += WAVE) {
    const results = await Promise.all(
      Array.from({ length: WAVE }, (_, k) => page(next + k))
    );
    for (const r of results) {
      if (r.error) return { data: all, error: r.error.message };
      const rows = r.data ?? [];
      all.push(...rows);
      if (rows.length < PAGE) return { data: all, error: null };
    }
  }
}
