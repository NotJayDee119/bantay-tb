import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Popup, Tooltip, ZoomControl } from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import { Activity, AlertTriangle, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { Spinner } from "../../components/ui";
import { OpenFreeMapLayer } from "../../components/OpenFreeMapLayer";
import { supabase } from "../../lib/supabase";
import { dbscan, type DbscanPoint } from "../../lib/dbscan";
import { loadDbscanSettings } from "../../lib/dbscanSettings";
import { buildHotspotAlerts, isAlertingSeverity } from "../../lib/hotspotAlerts";
import {
  DEBOUNCE_MS,
  RELOAD_DEBOUNCE_MS,
  freshnessLabel,
  shouldDetect,
  type DetectReason,
} from "../../lib/hotspotRefresh";
import { formatDateTime } from "../../lib/utils";
import { useAreaScope } from "../../hooks/useAreaScope";
import barangays from "../../data/barangays.json";
import { toast } from "sonner";

type Severity = "watch" | "moderate" | "high" | "urgent" | "low" | "medium";

interface Hotspot {
  id: string;
  barangay_psgc: number;
  case_count: number;
  density: number;
  severity: Severity;
  detected_at: string;
  centroid_lat: number;
  centroid_lon: number;
  radius_km: number;
}

const SEVERITY_COLOR: Record<Severity, string> = {
  watch: "#60a5fa",
  moderate: "#fbbf24",
  high: "#f97316",
  urgent: "#dc2626",
  low: "#60a5fa",
  medium: "#fbbf24",
};

// Canonical severities for the legend — "low"/"medium" are DB aliases.
const SEVERITY_ORDER: Severity[] = ["watch", "moderate", "high", "urgent"];

// Plain-language names shown to health workers instead of the raw DB values.
const SEVERITY_LABEL: Record<Severity, string> = {
  watch: "Watch",
  moderate: "Moderate",
  high: "High",
  urgent: "Urgent",
  low: "Watch",
  medium: "Moderate",
};

// One line explaining what each level means and what to do about it.
const SEVERITY_MEANING: Record<Severity, string> = {
  watch: "A few cases nearby. Keep an eye on it.",
  moderate: "Several cases grouped together.",
  high: "Many cases close together. Needs attention.",
  urgent: "A large group of cases. Act right away.",
  low: "A few cases nearby. Keep an eye on it.",
  medium: "Several cases grouped together.",
};

// Dark glass console chrome — shared language with the GIS map overlays.
const GLASS =
  "rounded-xl border border-white/10 bg-brand-950/90 shadow-lift backdrop-blur";
// Friendly panel heading — sentence case, easy to read at a glance.
const PANEL_TITLE = "text-sm font-semibold text-white";

function SeverityChip({ severity }: { severity: Severity }) {
  const c = SEVERITY_COLOR[severity];
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold"
      style={{ color: c, borderColor: `${c}66`, background: `${c}1a` }}
    >
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

export function Hotspots() {
  const scope = useAreaScope();
  // Detection clusters the whole city and fans out alerts to coordinators.
  // An area-scoped account only reads its own barangay's cases and profiles,
  // so its recompute would cluster partial data and skip citywide recipients.
  // Scoped staff still see every hotspot RLS grants them — they just don't
  // trigger the run; the detect-hotspots Edge Function does it citywide.
  const canRecompute = !scope.scoped;
  const [list, setList] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  // True while an automatic run is in flight. Kept apart from `running` so the
  // manual button doesn't show a spinner for work the user didn't ask for.
  const [autoChecking, setAutoChecking] = useState(false);
  // How many days of recent cases the detection considers (from Settings).
  // Shown to users so it's clear older cases aren't counted.
  const [windowDays, setWindowDays] = useState(90);
  const mapRef = useRef<LeafletMap | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("hotspots")
      .select("*")
      .order("detected_at", { ascending: false })
      .limit(100);
    if (error) toast.error(error.message);
    setList((data ?? []) as Hotspot[]);
    setLoading(false);
  }

  // ── Automatic detection ──────────────────────────────────────────────
  // Everything below exists so the map keeps itself current. It used to sit on
  // whatever the last person to encode a case had left behind, and a scoped
  // account could not refresh it at all — the manual button is citywide-only.
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detectInFlight = useRef(false);
  const disposed = useRef(false);

  /**
   * One reload per detection run, not one per row. A run deletes every TB
   * hotspot and re-inserts them, so reacting to each change event emptied the
   * map and refilled it — the markers visibly flashed away and back.
   */
  function scheduleReload() {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => {
      if (!disposed.current) void load();
    }, RELOAD_DEBOUNCE_MS);
  }

  /**
   * Ask the Edge Function to recompute. Deliberately not the client-side
   * `recompute()` below: that reads through the caller's RLS, so a scoped
   * account would cluster only its own barangay's cases and overwrite the
   * citywide picture with a partial one. The function runs as service_role and
   * sees every case, which is why it is safe to let any role trigger it.
   */
  async function runDetection(reason: DetectReason) {
    if (detectInFlight.current || disposed.current) return;

    // The floor is checked against the table, not a local timestamp, so open
    // dashboards don't each fire a run for the same case.
    const { data: latest } = await supabase
      .from("hotspots")
      .select("detected_at")
      .order("detected_at", { ascending: false })
      .limit(1);
    const lastRun = latest?.[0]?.detected_at ?? null;
    const decision = shouldDetect(lastRun, reason);
    if (!decision.run) {
      // Somebody else recomputed for this same change — the case form fires a
      // run of its own, and other open dashboards race us. Their result is the
      // one we wanted, so pick it up instead of sitting on a stale list.
      if (decision.skipped === "too_soon" && !disposed.current) await load();
      return;
    }

    detectInFlight.current = true;
    setAutoChecking(true);
    try {
      const { error } = await supabase.functions.invoke("detect-hotspots", {
        body: { trigger: `auto_${reason}` },
      });
      // Quiet on failure. Nobody asked for this run, so a toast would be an
      // interruption reporting a job the user never started; the realtime
      // subscription and the freshness label already tell the truth.
      if (error) console.warn("Automatic hotspot detection failed:", error);
      else if (!disposed.current) await load();
    } catch (err) {
      console.warn("Automatic hotspot detection failed:", err);
    } finally {
      detectInFlight.current = false;
      if (!disposed.current) setAutoChecking(false);
    }
  }

  function scheduleDetection(reason: DetectReason) {
    if (detectTimer.current) clearTimeout(detectTimer.current);
    detectTimer.current = setTimeout(() => {
      void runDetection(reason);
    }, DEBOUNCE_MS);
  }

  useEffect(() => {
    disposed.current = false;
    load();
    loadDbscanSettings().then((s) => setWindowDays(s.window_days));

    // On open: refresh anything gone stale. The detection window slides, so a
    // result can go out of date without a single new case being recorded.
    void runDetection("stale");

    const ch = supabase
      .channel("hotspots-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hotspots" },
        scheduleReload
      )
      // The half that makes this automatic. A case recorded anywhere in the
      // city — by anyone, on any device — now re-runs detection here. Writing
      // hotspots cannot re-trigger this, so there is no feedback loop.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cases" },
        () => scheduleDetection("cases_changed")
      )
      .subscribe();

    return () => {
      disposed.current = true;
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      if (detectTimer.current) clearTimeout(detectTimer.current);
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function recompute() {
    setRunning(true);
    try {
      const settings = await loadDbscanSettings();
      setWindowDays(settings.window_days);
      const since = new Date();
      since.setDate(since.getDate() - settings.window_days);
      const { data, error } = await supabase
        .from("cases")
        .select("id, barangay_psgc, jitter_lat, jitter_lon")
        .gte("reported_at", since.toISOString())
        .limit(20000);
      if (error) throw error;
      const points: DbscanPoint[] = (data ?? []).map(
        (c: { id: string; jitter_lat: number; jitter_lon: number }) => ({
          id: c.id,
          lat: c.jitter_lat,
          lon: c.jitter_lon,
        })
      );
      const clusters = dbscan(points, settings.eps_km, settings.min_pts);

      const inserts = clusters.map((cl) => {
        // Most-represented barangay in the cluster
        const counts = new Map<number, number>();
        for (const p of cl.points) {
          const cs = (data ?? []).find(
            (c: { id: string }) => c.id === p.id
          ) as { barangay_psgc: number } | undefined;
          if (!cs) continue;
          counts.set(cs.barangay_psgc, (counts.get(cs.barangay_psgc) ?? 0) + 1);
        }
        const topBgy = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        // Same membership record the Edge Function writes: every barangay of
        // residence in the cluster, plus the cases themselves so an alert can
        // show its recipient the addresses behind the count.
        const barangay_psgcs = [...counts.keys()];
        const case_ids = cl.points.map((p) => p.id);
        const radii = cl.points.map((p) => {
          const dLat = p.lat - cl.centroid.lat;
          const dLon = p.lon - cl.centroid.lon;
          return Math.sqrt(dLat * dLat + dLon * dLon) * 111;
        });
        const radius_km = Math.max(0.3, Math.max(...radii));
        const density = cl.points.length / (Math.PI * radius_km * radius_km);
        const severity: Severity =
          cl.points.length >= 50 ? "urgent" : cl.points.length >= 20 ? "high" : cl.points.length >= 10 ? "moderate" : "watch";
        return {
          barangay_psgc: topBgy ?? barangays[0].psgc,
          barangay_psgcs,
          case_ids,
          disease: "tb" as const,
          case_count: cl.points.length,
          density,
          severity,
          window_start: since.toISOString(),
          window_end: new Date().toISOString(),
          centroid_lat: cl.centroid.lat,
          centroid_lon: cl.centroid.lon,
          radius_km,
        };
      });

      // Replace the previous run's hotspots so the list shows the current
      // picture instead of stacking a fresh copy of every cluster each time.
      const { error: delErr } = await supabase
        .from("hotspots")
        .delete()
        .eq("disease", "tb");
      if (delErr) throw delErr;

      let insertedHotspots:
        | {
            id: string;
            severity: string;
            barangay_psgc: number | null;
            barangay_psgcs: number[] | null;
          }[]
        | null = [];
      if (inserts.length > 0) {
        const { data, error: insErr } = await supabase
          .from("hotspots")
          .insert(inserts)
          .select("id, severity, barangay_psgc, barangay_psgcs");
        if (insErr) throw insErr;
        insertedHotspots = data;
      }

      // Fan-out alerts — mirrors the Edge Function, which keeps its own copy
      // of the same rule (it deploys without remote imports).
      const alertable = (insertedHotspots ?? []).filter((h) =>
        isAlertingSeverity(h.severity)
      );
      if (alertable.length > 0) {
        const { data: staff } = await supabase
          .from("profiles")
          .select("id, role, barangay_psgc")
          .in("role", ["tb_coordinator", "barangay_admin", "health_worker", "system_admin"]);
        const alerts = buildHotspotAlerts(alertable, staff ?? []);
        if (alerts.length > 0) {
          await supabase.from("hotspot_alerts").insert(alerts);
        }
      }

      toast.success(
        inserts.length === 0
          ? "No hotspot areas right now."
          : `${inserts.length} hotspot area${inserts.length === 1 ? "" : "s"}.`
      );
      await load();
    } catch (err) {
      console.error("Hotspot recompute failed:", err);
      toast.error("Something went wrong while checking. Please try again.");
    } finally {
      setRunning(false);
    }
  }

  // Re-render on a slow tick so "Updated 2 minutes ago" doesn't freeze at the
  // value it had when the last hotspot arrived.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const center = useMemo<[number, number]>(() => [7.0731, 125.6128], []);
  const urgentCount = useMemo(
    () => list.filter((h) => h.severity === "urgent" || h.severity === "high").length,
    [list]
  );
  // List is ordered newest-first, so the first row carries the latest run time.
  const lastChecked = list.length > 0 ? list[0].detected_at : null;

  function flyTo(h: Hotspot) {
    mapRef.current?.flyTo([h.centroid_lat, h.centroid_lon], 13.5, {
      duration: 0.8,
    });
  }

  return (
    <div className="relative isolate h-full overflow-hidden bg-brand-950">
      {/* ── Cluster map — full-bleed dark surveillance console ────────── */}
      <MapContainer
        center={center}
        zoom={11}
        zoomControl={false}
        style={{ height: "100%", width: "100%", background: "#061020" }}
        ref={(m: LeafletMap | null) => {
          mapRef.current = m;
        }}
      >
            <OpenFreeMapLayer styleName="dark" />
            <ZoomControl position="bottomleft" />
            {list.map((h) => {
              const color = SEVERITY_COLOR[h.severity];
              const r = Math.min(40, 8 + h.case_count * 0.6);
              return (
                <Fragment key={h.id}>
                  {/* Soft halo — blurred via CSS so the cluster melts into
                      the basemap instead of cutting off sharply. */}
                  <CircleMarker
                    center={[h.centroid_lat, h.centroid_lon]}
                    radius={r + 7}
                    interactive={false}
                    pathOptions={{
                      className: "pcm-glow",
                      stroke: false,
                      fillColor: color,
                      fillOpacity: 0.3,
                    }}
                  />
                  <CircleMarker
                    center={[h.centroid_lat, h.centroid_lon]}
                    radius={r}
                    pathOptions={{
                      className: "pcm-core",
                      color,
                      opacity: 0.85,
                      weight: 1.5,
                      fillColor: color,
                      fillOpacity: 0.5,
                    }}
                  >
                    <Tooltip
                      direction="top"
                      offset={[0, -8]}
                      opacity={1}
                      className="pcm-tooltip"
                    >
                      <div className="pcm-tooltip-inner text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span
                            className="inline-block h-2 w-2 shrink-0 rounded-full"
                            style={{ background: color }}
                          />
                          <span className="text-xs font-semibold text-white">
                            {barangayName(h.barangay_psgc)}
                          </span>
                        </div>
                        <div className="mt-1 font-display text-2xl font-extrabold leading-none tracking-tight text-white">
                          {h.case_count}
                        </div>
                        <div
                          className="mt-0.5 text-[11px] font-semibold"
                          style={{ color }}
                        >
                          {SEVERITY_LABEL[h.severity]}
                        </div>
                        <div className="text-[10px] text-slate-300">
                          TB case{h.case_count === 1 ? "" : "s"} here
                        </div>
                      </div>
                    </Tooltip>
                    <Popup className="ghm-popup">
                      <div className="min-w-[190px]">
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
                          <AlertTriangle
                            className="h-4 w-4"
                            style={{ color }}
                          />
                          <span className="truncate">
                            {barangayName(h.barangay_psgc)}
                          </span>
                          <span className="ml-auto">
                            <SeverityChip severity={h.severity} />
                          </span>
                        </div>
                        <div className="mt-2">
                          <span className="font-display text-xl font-extrabold tracking-tight text-white">
                            {h.case_count}
                          </span>
                          <span className="ml-1.5 text-[11px] text-slate-300">
                            TB case{h.case_count === 1 ? "" : "s"} in this area
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] leading-snug text-slate-400">
                          {SEVERITY_MEANING[h.severity]} Covers about{" "}
                          {h.radius_km.toFixed(1)} km across.
                        </p>
                        <div className="mt-2 border-t border-white/10 pt-1.5 text-[11px] text-slate-500">
                          Last updated {formatDateTime(h.detected_at)}
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                </Fragment>
              );
            })}
      </MapContainer>

      {/* ── Title + action — top-left console panel ─────────────────── */}
      <div className={"absolute left-3 top-3 z-[500] w-64 p-3.5 sm:left-4 sm:top-4 " + GLASS}>
        <div className={"flex items-center gap-1.5 " + PANEL_TITLE}>
          <AlertTriangle className="h-4 w-4 text-vigil-400" />
          TB hotspots
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-slate-300">
          A hotspot is an area with a high concentration of TB cases. Bigger,
          brighter circles mean a higher concentration.
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
          Concentration is measured over the last {windowDays} days of cases, so
          the map shows where TB is concentrated now rather than over the whole
          record.
        </p>

        {/* Live status. This panel used to claim detection ran "on a schedule",
            which was not true — there is no cron job. Now it says what is
            actually happening, and it is actually happening. */}
        <div
          aria-live="polite"
          className="mt-3 flex items-center gap-1.5 border-t border-white/10 pt-2.5 text-[11px] text-slate-400"
        >
          {autoChecking ? (
            <>
              <Spinner className="h-3 w-3 shrink-0 text-accent-400" />
              <span className="text-slate-300">Checking for hotspots…</span>
            </>
          ) : (
            <>
              <span
                aria-hidden
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_theme(colors.emerald.400)]"
              />
              <span>
                <span className="font-semibold text-slate-300">Live</span>
                {lastChecked ? ` · ${freshnessLabel(lastChecked, now)}` : ""}
              </span>
            </>
          )}
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
          This map updates by itself whenever a case is recorded anywhere in the
          city. You don&rsquo;t need to refresh it.
        </p>

        {canRecompute && (
        <button
          type="button"
          onClick={recompute}
          disabled={running}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/10 px-2.5 py-2 text-[12px] font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? (
            <>
              <Spinner className="h-3.5 w-3.5 text-accent-400" />
              Checking…
            </>
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5" />
              Check again now
            </>
          )}
        </button>
        )}
        {scope.scoped && (
          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
            Showing hotspots for{" "}
            <span className="font-semibold text-slate-300">
              {scope.name ?? "your assigned area"}
            </span>
            . Detection itself runs city-wide, so a cluster straddling your
            boundary still counts.
          </p>
        )}
      </div>

      {/* ── Detections chip — compact, only while the rail is hidden ─── */}
      <div className="pointer-events-none absolute right-3 top-3 z-[500] md:hidden">
        <div className={"pointer-events-auto flex items-center gap-2 px-3 py-2 " + GLASS}>
          <Activity className="h-4 w-4 text-accent-400" />
          <div>
            <div className="font-display text-lg font-extrabold leading-none tracking-tight text-white">
              {list.length}
            </div>
            <div className="text-[11px] text-slate-300">
              hotspot{list.length === 1 ? "" : "s"} · {urgentCount} need attention
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent hotspots — right rail, can be hidden to clear the map ─ */}
      <div
        className={
          "absolute bottom-3 right-3 top-3 z-[500] hidden w-72 flex-col overflow-hidden sm:bottom-4 sm:right-4 sm:top-4 " +
          (railOpen ? "md:flex " : "md:hidden ") +
          GLASS
        }
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <div className={"flex items-center gap-1.5 " + PANEL_TITLE}>
            <AlertTriangle className="h-4 w-4 text-vigil-400" />
            Hotspot areas
          </div>
          <div className="flex items-center gap-2">
            {list.length > 0 && (
              <span className="text-[11px] tabular-nums text-slate-400">
                {urgentCount} need attention
              </span>
            )}
            <button
              type="button"
              onClick={() => setRailOpen(false)}
              aria-label="Hide list"
              title="Hide list"
              className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="border-b border-white/10 px-4 py-2">
          <p className="text-[11px] leading-snug text-slate-400">
            Areas with a high concentration of TB cases over the last{" "}
            {windowDays} days. Tap one to find it on the map.
          </p>
          {lastChecked && (
            <p className="mt-1 text-[10px] text-slate-500">
              Last checked {formatDateTime(lastChecked)}
            </p>
          )}
        </div>
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Spinner className="text-accent-400" />
          </div>
        ) : list.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm leading-relaxed text-slate-400">
            No hotspot areas right now. That’s good news — no area has a high
            concentration of TB cases. This list updates on its own as cases are
            recorded.
          </p>
        ) : (
          <ul className="flex-1 divide-y divide-white/5 overflow-y-auto">
            {list.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => flyTo(h)}
                  className="w-full px-4 py-3 text-left transition hover:bg-white/5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-white">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{
                          background: SEVERITY_COLOR[h.severity],
                          boxShadow: `0 0 6px ${SEVERITY_COLOR[h.severity]}`,
                        }}
                      />
                      <span className="truncate">
                        {barangayName(h.barangay_psgc)}
                      </span>
                    </span>
                    <SeverityChip severity={h.severity} />
                  </div>
                  <div className="mt-1 pl-4 text-[11px] text-slate-400">
                    {h.case_count} TB case{h.case_count === 1 ? "" : "s"} · about{" "}
                    {h.radius_km.toFixed(1)} km wide
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Reopen tab — only on desktop while the rail is hidden ────── */}
      {!railOpen && (
        <button
          type="button"
          onClick={() => setRailOpen(true)}
          className={
            "absolute right-3 top-3 z-[500] hidden items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-white/10 md:flex sm:right-4 sm:top-4 " +
            GLASS
          }
        >
          <ChevronLeft className="h-4 w-4" />
          <AlertTriangle className="h-4 w-4 text-vigil-400" />
          {list.length} hotspot{list.length === 1 ? "" : "s"}
        </button>
      )}

      {/* ── Severity legend — bottom-left, clear of the zoom control ── */}
      <div className={"absolute bottom-3 left-14 z-[500] px-3 py-2 sm:bottom-4 sm:left-16 " + GLASS}>
        <div className="text-[11px] font-semibold text-slate-200">
          How serious is it?
        </div>
        <div className="mt-1.5 flex items-center gap-3">
          {SEVERITY_ORDER.map((sev) => (
            <span
              key={sev}
              className="inline-flex items-center gap-1 text-[11px] text-slate-300"
              title={SEVERITY_MEANING[sev]}
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: SEVERITY_COLOR[sev] }}
              />
              {SEVERITY_LABEL[sev]}
            </span>
          ))}
        </div>
        <div className="mt-1 text-[10px] text-slate-500">
          Lower concentration → higher concentration
        </div>
      </div>

      {/* ── Empty overlay — map stays visible behind ────────────────── */}
      {!loading && list.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[400] grid place-items-center bg-brand-950/50 backdrop-blur-sm">
          <p className="max-w-xs px-6 text-center text-sm leading-relaxed text-slate-300">
            {autoChecking ? (
              <>Checking for areas with a high concentration of TB cases…</>
            ) : (
              <>
                No hotspots to show. No area currently has enough TB cases close
                together to count as one — this map will fill in by itself if
                that changes.
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

function barangayName(psgc: number): string {
  return barangays.find((b) => b.psgc === psgc)?.name ?? "—";
}
