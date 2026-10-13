import type { NeighbourCases } from "../lib/hotspotUtils";

/**
 * Plain-language "why is this a hotspot?" for a Gi* hotspot.
 *
 * Gi* scores a barangay on its own cases PLUS its neighbours', so a barangay
 * with zero recorded cases can be a hotspot when it borders a high-burden
 * one. Showing "0 cases · Hotspot" without saying so reads as a bug; this
 * names the neighbours that put it there.
 */
export function HotspotReason({
  name,
  ownCases,
  neighbours,
  tone = "dark",
}: {
  name: string;
  ownCases: number;
  /** Neighbouring barangays with at least one case, largest first. */
  neighbours: NeighbourCases[];
  /** "dark" for the map popups, "light" for white pages. */
  tone?: "dark" | "light";
}) {
  const top = neighbours.slice(0, 3);
  const more = neighbours.length - top.length;
  const t =
    tone === "dark"
      ? {
          box: "mt-2 border-t border-white/10 pt-2 text-slate-300",
          muted: "text-slate-400",
          faint: "text-slate-500",
          strong: "text-white",
        }
      : {
          box: "mt-2 text-slate-700",
          muted: "text-slate-500",
          faint: "text-slate-400",
          strong: "text-slate-900",
        };
  return (
    <div className={"text-[11px] leading-snug " + t.box}>
      <p>
        {ownCases === 0 ? (
          <>No TB patients are recorded as living in {name}.</>
        ) : (
          <>
            {ownCases.toLocaleString()} TB patient{ownCases === 1 ? "" : "s"}{" "}
            recorded as living in {name}.
          </>
        )}
      </p>
      {top.length > 0 && (
        <>
          <p className={"mt-1.5 " + t.muted}>
            {ownCases === 0
              ? "It is a hotspot because the barangays right next to it have many cases:"
              : "It is a hotspot together with the barangays next to it:"}
          </p>
          <ul className="mt-1 max-w-xs space-y-0.5">
            {top.map((n) => (
              <li key={n.psgc} className="flex justify-between gap-3">
                <span className="truncate">{n.name}</span>
                <span className={"font-semibold tabular-nums " + t.strong}>
                  {n.count.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
          {more > 0 && (
            <p className={"mt-0.5 text-[10px] " + t.faint}>
              +{more} more neighbouring barangay{more === 1 ? "" : "s"} with cases
            </p>
          )}
        </>
      )}
      {ownCases === 0 && (
        <p className={"mt-1.5 " + t.muted}>
          Outreach here can find cases that have not been recorded yet.
        </p>
      )}
    </div>
  );
}
