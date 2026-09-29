import { ASSET_STATUS, type DashboardData } from "@/lib/types";
import { AssetPreviewControl } from "@/components/dashboard/AssetCard";
import { StatusSelect } from "@/components/advisor/StatusSelect";
import { Stage } from "./Journey";

/** Assets as a checklist: one line each, the detail inside the preview. */
export function AssetChecklist({ data }: { data: DashboardData }) {
  const { assets, client, viewer } = data;
  if (!assets.length) return null;
  const done = assets.filter((a) => a.status === "done").length;
  const shortName = client.name.replace(/\s+(Co\.?|Pty\.? Ltd\.?|Ltd\.?|Inc\.?)$/i, "");
  return (
    <section className="block" aria-labelledby="h-assets">
      <h2 id="h-assets">
        Assets <Stage k="A" />
      </h2>
      <p className="lede">These stay with {shortName} after the cycle. You own them.</p>
      <div className="v2-progress" role="img" aria-label={`${done} of ${assets.length} assets done`}>
        <b>
          {done} of {assets.length} done
        </b>
        <span className="v2-progress-track">
          {assets.map((a) => (
            <span key={a.id} className={`v2-progress-cell ${ASSET_STATUS[a.status].key}`} />
          ))}
        </span>
      </div>
      <ul className="v2-assets">
        {assets.map((a) => {
          const st = ASSET_STATUS[a.status];
          const [title, ...restParts] = a.name.split(":");
          const rest = restParts.join(":").trim();
          const label =
            a.status === "not_started" && a.due_week ? `Week ${a.due_week}` : a.status === "drafting" && a.due_week ? `Drafting` : st.label;
          return (
            <li key={a.id}>
              <span className={`v2-dot ${st.key}`} aria-hidden="true" />
              <div className="v2-asset-name">
                <b>{title.trim()}</b>
                {rest && <span>{rest}</span>}
              </div>
              {viewer.kind === "advisor" ? (
                <StatusSelect slug={client.slug} table="assets" id={a.id} value={a.status} options={ASSET_STATUS} label={`${a.name} status`} />
              ) : (
                <span className={`tag ${st.key}`}>{label}</span>
              )}
              <div className="v2-asset-preview">
                <AssetPreviewControl asset={a} showDescription />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
