import { Feedback, mongoose } from "./models.js";

/** After this many failed AI attempts a row takes its sentiment from the rating instead. */
const MAX_AI_FAILURES = 6;

/**
 * Periodically finds feedback with no AI sentiment and fills it in:
 * - rows with patient text get full AI analysis (needs OPENROUTER_API_KEY);
 * - rows with no patient text (a rating only) take the sentiment from the rating, key or not.
 * Rows that fail back off (1, 2, 4 … 60 minutes) so they cannot block newer rows, and after
 * MAX_AI_FAILURES they fall back to the rating, so nothing stays "Pending" forever.
 * Skips split-child rows (parent analysis creates them).
 */
export function createPendingAiWorker({ reanalyzeFeedbackById, isEnabled }) {
  let running = false;
  let intervalHandle = null;
  let initialTimeoutHandle = null;

  const pollSeconds = Math.max(15, Number(process.env.PENDING_AI_POLL_SECONDS) || 45);
  const batchSize = Math.max(1, Math.min(20, Number(process.env.PENDING_AI_BATCH_SIZE) || 5));
  const minAgeSeconds = Math.max(10, Number(process.env.PENDING_AI_MIN_AGE_SECONDS) || 30);

  /** feedbackId -> { failures, retryAt } — in memory, so a restart simply retries everything. */
  const backoff = new Map();

  function noteFailure(id) {
    const key = String(id);
    const failures = (backoff.get(key)?.failures ?? 0) + 1;
    const waitMinutes = Math.min(60, 2 ** (failures - 1));
    backoff.set(key, { failures, retryAt: Date.now() + waitMinutes * 60_000 });
  }

  function coolingDownIds() {
    const now = Date.now();
    const ids = [];
    for (const [id, entry] of backoff) {
      if (entry.retryAt > now) ids.push(new mongoose.Types.ObjectId(id));
    }
    return ids;
  }

  async function findPendingRows(limit) {
    const cutoffOid = mongoose.Types.ObjectId.createFromTime(
      Math.floor((Date.now() - minAgeSeconds * 1000) / 1000)
    );
    const noPatientText = {
      $or: [{ comments: { $exists: false } }, { comments: null }, { comments: { $regex: /^\s*$/ } }],
    };
    return Feedback.find({
      isSplitChild: { $ne: true },
      _id: { $lte: cutoffOid, $nin: coolingDownIds() },
      $and: [
        { $or: [{ aiSentiment: null }, { aiSentiment: { $exists: false } }, { aiSentiment: "" }] },
        // Without an AI key only the rating-only rows can be completed.
        ...(isEnabled() ? [] : [noPatientText]),
      ],
    })
      .sort({ _id: 1 })
      .limit(limit)
      .lean();
  }

  async function processBatch() {
    if (running) return { processed: 0, updated: 0, failed: 0, skipped: true };

    running = true;
    let updated = 0;
    let failed = 0;

    try {
      const rows = await findPendingRows(batchSize);
      if (!rows.length) {
        return { processed: 0, updated: 0, failed: 0 };
      }

      // eslint-disable-next-line no-console
      console.log("[pending-ai] auto-processing batch", { count: rows.length });

      for (const row of rows) {
        const key = String(row._id);
        const ratingFallback = (backoff.get(key)?.failures ?? 0) >= MAX_AI_FAILURES;
        try {
          const ok = await reanalyzeFeedbackById(row._id, { ratingFallback });
          if (ok) {
            updated += 1;
            backoff.delete(key);
          } else {
            failed += 1;
            noteFailure(key);
          }
        } catch (err) {
          failed += 1;
          noteFailure(key);
          // eslint-disable-next-line no-console
          console.error("[pending-ai] row failed", {
            feedbackId: key,
            message: err?.message || String(err),
          });
        }
      }

      // eslint-disable-next-line no-console
      console.log("[pending-ai] batch done", { updated, failed });
      return { processed: rows.length, updated, failed };
    } finally {
      running = false;
    }
  }

  function start() {
    // eslint-disable-next-line no-console
    console.log("[pending-ai] worker started", {
      pollSeconds,
      batchSize,
      minAgeSeconds,
      aiAnalysis: isEnabled() ? "on" : "off (OPENROUTER_API_KEY not set; rating-only rows still filled)",
    });

    initialTimeoutHandle = setTimeout(() => {
      void processBatch();
    }, 12_000);

    intervalHandle = setInterval(() => {
      void processBatch();
    }, pollSeconds * 1000);
  }

  function stop() {
    if (initialTimeoutHandle) clearTimeout(initialTimeoutHandle);
    if (intervalHandle) clearInterval(intervalHandle);
  }

  return { start, stop, processBatch };
}
