// Server component -- just renders what /admin has already resolved for
// this subscriber's deep-dive requests. No client state needed here since
// there's nothing to interact with, unlike SearchBox's live search.
type EnhancedReport = {
  id: string;
  query_type: string;
  query_value: string;
  category_counts: Record<string, number> | null;
  summary: string | null;
  resolved_at: string | null;
};

export default function EnhancedReportsList({ reports }: { reports: EnhancedReport[] }) {
  if (reports.length === 0) {
    return (
      <p className="text-center text-sm text-muted">
        Nothing here yet. Results from any priority-search deep dive you
        request will show up in this list once an admin completes it.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {reports.map((r) => (
        <div key={r.id} className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-semibold capitalize">
              {r.query_type}: {r.query_value}
            </span>
            {r.resolved_at && (
              <span className="text-xs text-muted">
                {new Date(r.resolved_at).toLocaleDateString()}
              </span>
            )}
          </div>

          {r.category_counts && Object.keys(r.category_counts).length > 0 ? (
            <div className="mt-3 space-y-1.5 text-sm">
              {Object.entries(r.category_counts).map(([category, count]) => (
                <div key={category} className="flex items-center justify-between">
                  <span className="text-muted">{category}</span>
                  <span className="font-semibold text-orange">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">
              No categories flagged, nothing concerning turned up.
            </p>
          )}

          {r.summary && (
            <p className="mt-3 rounded-lg bg-navy p-3 text-sm text-white">{r.summary}</p>
          )}
        </div>
      ))}
    </div>
  );
}
