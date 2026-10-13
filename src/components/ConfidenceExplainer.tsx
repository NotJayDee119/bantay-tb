/**
 * "What do 95% and 99% mean?" — one explanation, used wherever hotspot
 * confidence levels appear, so a health worker and a reviewing panel read the
 * same, statistically correct definition.
 *
 * Collapsed by default: it answers a question, it isn't the content.
 */
export function ConfidenceExplainer({
  tone = "light",
  className = "",
}: {
  tone?: "dark" | "light";
  className?: string;
}) {
  const t =
    tone === "dark"
      ? {
          summary: "text-slate-300 hover:text-white",
          body: "text-slate-400",
          strong: "text-slate-200",
        }
      : {
          summary: "text-brand-700 hover:text-brand-800",
          body: "text-slate-600",
          strong: "text-slate-900",
        };
  return (
    <details className={"group text-[11px] leading-snug " + className}>
      <summary
        className={
          "cursor-pointer select-none font-semibold underline underline-offset-2 " +
          t.summary
        }
      >
        What do 95% and 99% mean?
      </summary>
      <div className={"mt-1.5 space-y-1.5 " + t.body}>
        <p>
          Each barangay is compared with what we would expect if TB cases were
          spread <span className={t.strong}>randomly</span> across Davao City.
        </p>
        <ul className="space-y-1">
          <li>
            <span className={"font-semibold " + t.strong}>
              High — 95% confidence:
            </span>{" "}
            a pattern this strong would happen by chance less than{" "}
            <span className={t.strong}>1 time in 20</span>.
          </li>
          <li>
            <span className={"font-semibold " + t.strong}>
              Urgent — 99% confidence:
            </span>{" "}
            less than <span className={t.strong}>1 time in 100</span>.
          </li>
        </ul>
        <p>
          There are only these two levels. They are the standard cut-offs used
          in public-health hotspot mapping (Getis-Ord Gi* z-score of at least
          1.96 or 2.58).
        </p>
        <p>
          A hotspot shows where to <span className={t.strong}>start looking</span>.
          It does not prove an outbreak — confirm it with field visits and
          screening.
        </p>
      </div>
    </details>
  );
}
