import { RefreshCw } from "lucide-react";
import { Navigate, Outlet } from "react-router";
import { getSession } from "../../lib/auth";
import { InsightsPeriodFilterBar } from "./InsightsPeriodFilterBar";
import { useInsightsData } from "./useInsightsData";

/**
 * Container for Ticket trends (only reachable while Ticketing is on). The other Insights tabs
 * were folded into the single Dashboard; their old URLs redirect there (see routes.tsx).
 */
export function InsightsHub() {
  const data = useInsightsData();

  if (getSession()?.role === "hod") {
    return <Navigate to="/dashboard" replace />;
  }

  if (data.isLoading && !data.hasData) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        Loading ticket trends…
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-red-700 font-medium">{data.error}</p>
        <button
          type="button"
          onClick={() => void data.loadData()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
        >
          <RefreshCw size={16} />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 pb-10">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Ticket trends</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tickets opened from negative feedback, by status and over time.
        </p>
      </div>

      <InsightsPeriodFilterBar
        periodFilter={data.periodFilter}
        setPeriodFilter={data.setPeriodFilter}
        timeFilter={data.timeFilter}
        setTimeFilter={data.setTimeFilter}
        customFrom={data.customFrom}
        setCustomFrom={data.setCustomFrom}
        customTo={data.customTo}
        setCustomTo={data.setCustomTo}
        customRange={data.customRange}
        applyRange={data.applyRange}
        clearRange={data.clearRange}
        loadData={data.loadData}
        isLoading={data.isLoading}
      />

      <Outlet context={data} />
    </div>
  );
}
