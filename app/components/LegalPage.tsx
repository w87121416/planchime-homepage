import type { ReactNode } from "react";
import { SiteFrame } from "./SiteFrame";

export type LegalDocumentHistory = {
  version: string;
  publishedAt: string;
  note: string;
};

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="legal-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function LegalPage({
  eyebrow,
  title,
  summary,
  version,
  status,
  publishedAt,
  effectiveAt,
  history,
  children,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  version: string;
  status: string;
  publishedAt: string;
  effectiveAt: string;
  history?: LegalDocumentHistory[];
  children: ReactNode;
}) {
  return (
    <SiteFrame>
      <div className="legal-hero">
        <div className="shell legal-shell">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="legal-summary">{summary}</p>
          {/* 版本、发布日期与生效日期分开呈现，方便用户和审核人员确认正在阅读的正式文本。 */}
          <dl className="document-meta" aria-label={`${title}版本信息`}>
            <div><dt>状态</dt><dd>{status}</dd></div>
            <div><dt>版本</dt><dd>{version}</dd></div>
            <div><dt>发布日期</dt><dd>{publishedAt}</dd></div>
            <div><dt>生效日期</dt><dd>{effectiveAt}</dd></div>
          </dl>
        </div>
      </div>
      <article className="shell legal-shell legal-content">
        {children}
        {history?.length ? (
          <LegalSection title="版本记录">
            <div className="legal-table-wrap">
              <table className="legal-table history-table">
                <thead><tr><th>版本</th><th>发布日期</th><th>主要变化</th></tr></thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={`${item.version}-${item.publishedAt}`}>
                      <td>{item.version}</td>
                      <td>{item.publishedAt}</td>
                      <td>{item.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </LegalSection>
        ) : null}
      </article>
    </SiteFrame>
  );
}
