// Who gets told about a hotspot.
//
// Residence decides. A community account is alerted when one of *its own
// residents* is in the cluster — never because a clinic in its barangay
// happened to register somebody else's resident, and never merely because the
// cluster was filed under its name.
//
// Both halves of that used to fail, because routing keyed on the cluster's
// modal barangay alone: a cluster of 12 Calinan residents and 9 Baguio ones
// alerted Calinan for all 21 and told Baguio nothing. `barangay_psgcs` (see
// 20261009000000_hotspot_alerts_carry_residence.sql) carries every barangay of
// residence in the cluster so the fan-out can ask the right question.
//
// The Edge Function keeps its own copy of this rule — it deploys with
// `--no-remote` and cannot import from `src/` — so any change here must be
// mirrored in `supabase/functions/detect-hotspots/index.ts`.

/** Roles that receive every alert regardless of geography. */
const CITYWIDE_ROLES: ReadonlySet<string> = new Set([
  "tb_coordinator",
  "system_admin",
]);

/** Severities worth interrupting someone for. */
const ALERTING_SEVERITIES: ReadonlySet<string> = new Set(["high", "urgent"]);

export interface AlertRecipient {
  id: string;
  role: string;
  /** Assigned barangay — null for citywide roles and unassigned staff. */
  barangay_psgc: number | null;
}

export interface AlertableHotspot {
  id: string;
  severity: string;
  /** Modal barangay of residence — what the cluster is filed under. */
  barangay_psgc: number | null;
  /** Every barangay of residence in the cluster. Absent on pre-20261009 rows. */
  barangay_psgcs?: number[] | null;
}

export interface PendingAlert {
  hotspot_id: string;
  recipient_id: string;
}

export function isAlertingSeverity(severity: string): boolean {
  return ALERTING_SEVERITIES.has(severity);
}

/**
 * True when `psgc` has at least one resident in the cluster. Falls back to the
 * modal barangay for hotspots recorded before membership was stored, so old
 * rows keep alerting the one area they always did rather than nobody.
 */
export function hotspotCoversBarangay(
  hotspot: AlertableHotspot,
  psgc: number
): boolean {
  const members = hotspot.barangay_psgcs;
  if (members && members.length > 0) return members.includes(psgc);
  return hotspot.barangay_psgc === psgc;
}

/** Alerts to insert for one detection run. */
export function buildHotspotAlerts(
  hotspots: AlertableHotspot[],
  recipients: AlertRecipient[]
): PendingAlert[] {
  const alerts: PendingAlert[] = [];
  for (const h of hotspots) {
    if (!isAlertingSeverity(h.severity)) continue;
    for (const r of recipients) {
      if (CITYWIDE_ROLES.has(r.role)) {
        alerts.push({ hotspot_id: h.id, recipient_id: r.id });
        continue;
      }
      // Unassigned area staff have no residents to be responsible for; RLS
      // fails closed for them anyway, so an alert would open to an empty list.
      if (r.barangay_psgc === null) continue;
      if (hotspotCoversBarangay(h, r.barangay_psgc)) {
        alerts.push({ hotspot_id: h.id, recipient_id: r.id });
      }
    }
  }
  return alerts;
}
