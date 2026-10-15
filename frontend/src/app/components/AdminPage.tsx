import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deleteFeedback,
  getFeedback,
  getFeedbackAnalytics,
  type FeedbackAnalytics,
  type FeedbackItem,
} from "../lib/api";
import {
  fetchFeedbackChanges,
  fetchFeedbackList,
  mergeFeedbackLists,
} from "../lib/feedbackListSync";
import {
  feedbackCacheKey,
  getFeedbackCache,
  patchFeedbackCache,
  setFeedbackCache,
} from "../lib/feedbackCache";
import { getAnalyticsCache, setAnalyticsCache } from "../lib/analyticsCache";
import { SENTIMENT_COLORS } from "../lib/chartPalette";
import {
  defaultFeedbackListScope,
  feedbackMatchesListScope,
  feedbackQueryFromListScope,
  last12WeeksRange,
  last30DaysRange,
  type FeedbackListScope,
} from "../lib/insightsFilters";
import { useTicketingEnabled } from "../lib/branding";
import feedbackQr from "./image/feedback_qr.jpg";
import feedbackQrPrint from "./image/feedback_qr_print.jpg";
import { HOSPITAL } from "../lib/hospital";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLocation, useNavigate } from "react-router";
import * as XLSX from "xlsx";
import { RecentFeedbackBySentiment } from "./RecentFeedbackBySentiment";
import { countPatientFeedbackGroups } from "../lib/patientFeedbackGroups";

const ratingLabel: Record<number, string> = {
  1: "Very Poor",
  2: "Poor",
  3: "Okay",
  4: "Good",
  5: "Excellent",
};

const STATUS_COLORS: Record<string, string> = {
  New: "#8B1538",
  "In Progress": "#F4A261",
  Resolved: "#2FBF71",
};

/** The address the hospital's printed QR code opens. */
const FEEDBACK_QR_TARGET = "http://pfs.apdch.mapims.edu.in/feedback";

export function AdminPage({ readOnly = false }: { readOnly?: boolean } = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const isDeleteMode = location.pathname.includes("/delete");
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [analytics, setAnalytics] = useState<FeedbackAnalytics | null>(() => getAnalyticsCache());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [chartsReady, setChartsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { enabled: ticketingEnabled } = useTicketingEnabled();
  const [listScope, setListScope] = useState<FeedbackListScope>(defaultFeedbackListScope);
  const [excelDownloadBusy, setExcelDownloadBusy] = useState(false);
  const lastFeedbackSyncMsRef = useRef(0);

  const listQuery = useCallback(
    () => ({ lite: true as const, ...feedbackQueryFromListScope(listScope) }),
    [listScope]
  );

  const markFeedbackSynced = useCallback(() => {
    lastFeedbackSyncMsRef.current = Date.now();
  }, []);

  const loadAnalytics = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      if (opts?.silent) setIsRefreshing(true);
      const analyticsData = await getFeedbackAnalytics();
      setAnalytics(analyticsData);
      setAnalyticsCache(analyticsData);
    } catch {
      if (!opts?.silent) {
        setError("Failed to load analytics. Please check API and database.");
      }
    } finally {
      if (opts?.silent) setIsRefreshing(false);
    }
  }, []);

  const loadFeedback = useCallback(
    async (opts?: { silent?: boolean; incremental?: boolean }) => {
      const query = listQuery();
      const key = feedbackCacheKey(query);
      const cached = getFeedbackCache(key);

      try {
        if (opts?.silent) {
          setIsRefreshing(true);
        } else if (cached) {
          setItems(cached.items);
          lastFeedbackSyncMsRef.current = cached.lastSyncMs;
          setIsLoading(false);
        } else {
          setIsLoading(true);
        }
        if (!opts?.silent) setError(null);

        const useIncremental = Boolean(
          opts?.incremental && (lastFeedbackSyncMsRef.current > 0 || cached?.lastSyncMs)
        );
        const sinceMs = lastFeedbackSyncMsRef.current || cached?.lastSyncMs || 0;

        const feedbackData = useIncremental
          ? await fetchFeedbackChanges(query, sinceMs)
          : await fetchFeedbackList(query);

        if (useIncremental) {
          if (feedbackData.length) {
            setItems((current) => {
              let merged = mergeFeedbackLists(current, feedbackData);
              if (!listScope.allTime) {
                merged = merged.filter((row) => feedbackMatchesListScope(row, listScope));
              }
              patchFeedbackCache(key, merged, Date.now());
              return merged;
            });
          } else {
            setItems((current) => {
              patchFeedbackCache(key, current, Date.now());
              return current;
            });
          }
        } else {
          setItems(feedbackData);
          setFeedbackCache(key, feedbackData, Date.now());
        }
        markFeedbackSynced();
      } catch {
        if (!opts?.silent && !cached) {
          setError("Failed to load feedback. Please check API and database.");
        }
      } finally {
        if (opts?.silent) {
          setIsRefreshing(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [listQuery, listScope, markFeedbackSynced]
  );

  const reloadFeedbackList = useCallback(
    async (scope: FeedbackListScope, opts?: { silent?: boolean }) => {
      const query = { lite: true as const, ...feedbackQueryFromListScope(scope) };
      const key = feedbackCacheKey(query);
      try {
        if (opts?.silent) setIsRefreshing(true);
        else setIsLoading(true);
        setError(null);
        lastFeedbackSyncMsRef.current = 0;
        const feedbackData = await fetchFeedbackList(query);
        setItems(feedbackData);
        setFeedbackCache(key, feedbackData, Date.now());
        markFeedbackSynced();
      } catch {
        setError("Failed to load feedback. Please check API and database.");
      } finally {
        if (opts?.silent) setIsRefreshing(false);
        else setIsLoading(false);
      }
    },
    [markFeedbackSynced]
  );

  const handleListScopeChange = useCallback((scope: FeedbackListScope) => {
    setListScope(scope);
    void reloadFeedbackList(scope);
  }, [reloadFeedbackList]);

  const handleDeleteFeedback = useCallback(
    async (item: FeedbackItem, groupItems?: FeedbackItem[]) => {
      // A list row can hold several submissions (same patient, same day) plus their split issues.
      // Deleting a submission removes its split issues on the server, so only top-level rows
      // need a request; a row made only of split issues deletes those.
      const rows = groupItems?.length ? groupItems : [item];
      const submissions = rows.filter((row) => !row.isSplitChild);
      const targets = submissions.length ? submissions : rows;
      const who = item.patientName?.trim() || item.ticketId || item._id;
      const what =
        targets.length > 1 ? `${targets.length} submissions from ${who}` : `the feedback from ${who}`;
      if (!window.confirm(`Delete ${what}? Any split issues are removed too. This cannot be undone.`)) {
        return;
      }
      setError(null);
      try {
        for (const row of targets) await deleteFeedback(row._id);
      } catch {
        setError("Failed to delete feedback.");
      }
      // Reload instead of patching locally: the server also removed split issues, and the
      // cleared cache must be refilled from the server so deleted rows cannot come back.
      await reloadFeedbackList(listScope, { silent: true });
      void loadAnalytics({ silent: true });
    },
    [listScope, loadAnalytics, reloadFeedbackList]
  );

  useEffect(() => {
    const query = listQuery();
    const key = feedbackCacheKey(query);
    const cached = getFeedbackCache(key);
    const hasAnalytics = Boolean(getAnalyticsCache());

    void loadAnalytics({ silent: hasAnalytics });

    if (cached) {
      setItems(cached.items);
      lastFeedbackSyncMsRef.current = cached.lastSyncMs;
      setIsLoading(false);
      void loadFeedback({ silent: true, incremental: true });
      return;
    }
    void loadFeedback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => setChartsReady(true));
    return () => {
      cancelAnimationFrame(id);
      setChartsReady(false);
    };
  }, []);

  useEffect(() => {
    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        void loadAnalytics({ silent: true });
      }
    }
    function onFocus() {
      void loadAnalytics({ silent: true });
    }
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadAnalytics]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void loadAnalytics({ silent: true });
      void loadFeedback({ silent: true, incremental: true });
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [loadAnalytics, loadFeedback]);

  const totalSubmissions = analytics?.totals?.all ?? items.length;
  const patientCount = useMemo(() => countPatientFeedbackGroups(items), [items]);
  const averageRatingFromItems = useMemo(() => {
    if (!items.length) return 0;
    const parents = items.filter((row) => !row.isSplitChild);
    const base = parents.length ? parents : items;
    return Number((base.reduce((sum, row) => sum + row.rating, 0) / base.length).toFixed(1));
  }, [items]);
  const averageRating = analytics?.totals?.averageRating ?? averageRatingFromItems;
  const negativeAiCount =
    analytics?.totals?.negative ?? items.filter((i) => i.aiSentiment === "negative").length;
  const aiChannelCount = analytics?.totals?.aiTickets ?? items.filter((i) => i.source === "ai").length;

  // Ticket status only means something while the ticketing workflow is on; otherwise the
  // overview shows how feedback splits by AI sentiment.
  const statusChartData = analytics?.byStatus ?? [];
  const pieData = useMemo(() => {
    if (ticketingEnabled) {
      return statusChartData.map((d) => ({
        label: d.status as string,
        count: d.count,
        fill: STATUS_COLORS[d.status] ?? "#A39A91",
      }));
    }
    const totals = analytics?.totals;
    if (!totals) return [];
    return [
      { label: "Positive", count: totals.positive, fill: SENTIMENT_COLORS.positive },
      { label: "Neutral", count: totals.neutral, fill: SENTIMENT_COLORS.neutral },
      { label: "Negative", count: totals.negative, fill: SENTIMENT_COLORS.negative },
    ].filter((d) => d.count > 0);
  }, [ticketingEnabled, statusChartData, analytics]);
  const negativeDepartmentData = analytics?.negativeByDepartment ?? [];
  const trendData = analytics?.submissionsByDay ?? [];
  const chartRenderKey = chartsReady ? `ready-${pieData.length}-${trendData.length}` : "pending";
  function downloadExcel(rows: FeedbackItem[], fileName: string) {
    const data = rows.map((item) => ({
      patientName: item.patientName,
      UHID: item.patientRegNo?.trim() || "",
      department: item.department || "",
      rating: item.rating,
      status: item.status,
      aiSentiment: item.aiSentiment || "",
      source: item.source,
      comments: item.comments || "",
      createdAt: new Date(item.createdAt).toISOString(),
    }));
    const sheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Feedback");
    XLSX.writeFile(workbook, fileName);
  }

  function downloadAllFeedbackExcel() {
    void (async () => {
      if (excelDownloadBusy) return;
      try {
        setExcelDownloadBusy(true);
        const all = await getFeedback({ lite: true });
        if (!all.length) return;
        downloadExcel(all, "feedback-all-data.xlsx");
      } catch {
        setError("Could not download all feedback. Try again.");
      } finally {
        setExcelDownloadBusy(false);
      }
    })();
  }

  function downloadFilteredFeedbackExcel(rows: FeedbackItem[]) {
    if (!rows.length) return;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadExcel(rows, `feedback-filtered-${stamp}.xlsx`);
  }

  return (
    <div className="w-full">
      <div className="mb-5 sm:mb-6 flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800">
            {readOnly ? "Overview" : "Admin Panel"}
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-gray-600 mt-1.5 sm:mt-2">
            SaaS-level analytics for patient feedback performance
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Charts use all-time totals · table below loads{" "}
            {listScope.allTime ? "all submissions" : `${listScope.from} to ${listScope.to}`} only
          </p>
        </div>
        {!readOnly && (
        <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center">
          <button
            type="button"
            onClick={() => navigate("/admin/settings")}
            className="px-3 sm:px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50"
          >
            Settings
          </button>
          {ticketingEnabled && (
            <button
              type="button"
              onClick={() => navigate("/admin/tickets")}
              className="px-3 sm:px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover"
            >
              Ticket management
            </button>
          )}
        </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-4 mb-6">
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100 border-l-4 border-l-primary">
          <p className="text-gray-600 text-sm mb-1 font-medium">Submissions (all time)</p>
          <p className="text-3xl font-bold text-gray-800">{totalSubmissions}</p>
          <p className="text-xs text-gray-500 mt-1">All rows incl. split tickets</p>
        </div>
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100 border-l-4 border-l-indigo-500">
          <p className="text-gray-600 text-sm mb-1 font-medium">Patients (all time)</p>
          <p className="text-3xl font-bold text-gray-800">{patientCount}</p>
          <p className="text-xs text-gray-500 mt-1">
            Unique patients · from {totalSubmissions} submission rows
          </p>
        </div>
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100 border-l-4 border-l-[#2FBF71]">
          <p className="text-gray-600 text-sm mb-1 font-medium">Average Rating</p>
          <p className="text-3xl font-bold text-gray-800">{averageRating}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100 border-l-4 border-l-[#F4A261]">
          <p className="text-gray-600 text-sm mb-1 font-medium">Negative (AI)</p>
          <p className="text-3xl font-bold text-gray-800">{negativeAiCount}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100 border-l-4 border-l-[#7C3AED]">
          <p className="text-gray-600 text-sm mb-1 font-medium">AI Channel Submissions</p>
          <p className="text-3xl font-bold text-gray-800">{aiChannelCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-md p-5">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            {ticketingEnabled ? "Submission Status Distribution" : "Feedback Sentiment"}
          </h3>
          <div className="h-72">
            {chartsReady && pieData.length > 0 ? (
              <ResponsiveContainer key={chartRenderKey} width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.label} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-gray-400">
                {analytics
                  ? ticketingEnabled
                    ? "No status data yet"
                    : "No analysed feedback yet"
                  : "Loading charts…"}
              </div>
            )}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-5">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Negative Feedback by Department
          </h3>
          <div className="h-72">
            {chartsReady && negativeDepartmentData.length > 0 ? (
              <ResponsiveContainer key={`neg-${chartRenderKey}`} width="100%" height="100%">
                <BarChart data={negativeDepartmentData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="department" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#E5533D" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-gray-400">
                {analytics ? "No negative feedback by department" : "Loading charts…"}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-5 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Submission Trend (Last 14 Days)
        </h3>
        <div className="h-72">
          {chartsReady && trendData.length > 0 ? (
            <ResponsiveContainer key={`trend-${chartRenderKey}`} width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#8B1538" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-400">
              {analytics ? "No trend data yet" : "Loading charts…"}
            </div>
          )}
        </div>
      </div>

      {!readOnly && (
        <div className="rounded-2xl border-2 border-brand-gold bg-gradient-to-br from-[#FFFBF7] via-[#FFF8F0] to-[#FFF0F0] p-4 sm:p-8 shadow-md mb-6">
          <h3 className="text-xl font-bold text-primary mb-1">Feedback QR Code</h3>
          <p className="text-sm text-[#6b1229] mb-6">
            The hospital's official feedback QR code. Download the print-quality file for posters,
            counters and WhatsApp.
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <img
              src={feedbackQr}
              alt={`${HOSPITAL.name} feedback QR code`}
              width={1000}
              height={1210}
              className="mx-auto sm:mx-0 h-auto w-full max-w-[260px] shrink-0 rounded-xl bg-white shadow-md ring-2 ring-primary/20"
            />
            <div className="space-y-3 text-center sm:text-left flex-1 min-w-0">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                Scan target
              </p>
              <p className="text-sm text-[#4a0d18] break-all font-mono bg-white/70 rounded-lg px-3 py-2 border border-brand-gold/30">
                {FEEDBACK_QR_TARGET}
              </p>
              <a
                href={feedbackQrPrint}
                download={`${HOSPITAL.shortName.toLowerCase()}-feedback-qr.jpg`}
                className="inline-flex px-4 py-2 rounded-lg font-semibold text-white bg-primary hover:bg-[#6f1029] transition-colors shadow-sm ring-1 ring-brand-gold/40"
              >
                Download QR (print quality)
              </a>
            </div>
          </div>
        </div>
      )}

      <RecentFeedbackBySentiment
        items={items}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        error={error}
        isDeleteMode={!readOnly && isDeleteMode}
        listScope={listScope}
        onListScopeChange={handleListScopeChange}
        onRefresh={() => void loadFeedback({ silent: true, incremental: true })}
        onDownloadAll={downloadAllFeedbackExcel}
        excelDownloadBusy={excelDownloadBusy}
        onDownloadRange={downloadFilteredFeedbackExcel}
        onDeleteItem={!readOnly && isDeleteMode ? (item, groupItems) => void handleDeleteFeedback(item, groupItems) : undefined}
      />
    </div>
  );
}
