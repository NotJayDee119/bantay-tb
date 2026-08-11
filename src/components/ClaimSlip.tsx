import { useEffect } from "react";
import { formatDate } from "../lib/utils";

/**
 * The physical artefact the patient walks out with.
 *
 * Printed on its own — `@media print` in index.css hides the rest of the app —
 * so a health worker gets a slip rather than a screenshot of the dashboard.
 * Instructions run in all three languages because the person reading this at
 * home is often not the person who was at the counter.
 *
 * Nothing clinical appears here. A slip left on a jeepney seat should reveal a
 * name and a phone number to call, not a diagnosis.
 */
export function ClaimSlip({
  code,
  patientName,
  facilityName,
  expiresAt,
  onDone,
}: {
  code: string;
  patientName: string;
  facilityName: string | null;
  expiresAt: string | null;
  onDone: () => void;
}) {
  // Print on mount, and hand control back when the dialog closes — whether the
  // worker printed or cancelled, the panel should return to normal.
  useEffect(() => {
    const done = () => onDone();
    window.addEventListener("afterprint", done);
    const t = window.setTimeout(() => window.print(), 60);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("afterprint", done);
    };
  }, [onDone]);

  return (
    <div id="claim-slip" className="claim-slip">
      <div className="claim-slip__inner">
        <header className="claim-slip__head">
          <div>
            <p className="claim-slip__brand">BANTAY-TB</p>
            <p className="claim-slip__sub">
              Davao City Health Office &middot; TB DOTS Programme
            </p>
          </div>
          {facilityName && (
            <p className="claim-slip__facility">{facilityName}</p>
          )}
        </header>

        <p className="claim-slip__for">
          For: <strong>{patientName}</strong>
        </p>

        <div className="claim-slip__codebox">
          <p className="claim-slip__label">Your claim code</p>
          <p className="claim-slip__code">{code}</p>
          {expiresAt && (
            <p className="claim-slip__expiry">
              Use it before {formatDate(expiresAt)} &middot; works once
            </p>
          )}
        </div>

        <ol className="claim-slip__steps">
          <li>Open bantay-tb on your phone and tap “I have a claim code”.</li>
          <li>Type the code above, then choose your own password.</li>
          <li>Your medicine schedule is already waiting inside.</li>
        </ol>

        <div className="claim-slip__lang">
          <p>
            <strong>Filipino:</strong> Huwag mag-sign up. I-type ang code sa
            itaas sa “I have a claim code”, pumili ng password, at makikita mo
            na ang iskedyul ng iyong gamot.
          </p>
          <p>
            <strong>Cebuano:</strong> Ayaw pag-sign up. I-type ang code sa
            ibabaw sa “I have a claim code”, pagpili og password, ug makita nimo
            ang iskedyul sa imong tambal.
          </p>
        </div>

        <p className="claim-slip__foot">
          Keep this slip private &mdash; it opens your account. Lost it? Ask
          {facilityName ? ` ${facilityName}` : " your DOTS centre"} for a new
          one.
        </p>
      </div>
    </div>
  );
}
