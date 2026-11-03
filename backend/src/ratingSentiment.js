/**
 * Sentiment for feedback with no patient text to analyse, such as a typed submission that
 * only picked a rating. Without this the row would wait for AI analysis that can never run
 * and show as "Pending" forever. The patient's own rating is the signal: 4–5 positive,
 * 3 neutral, 1–2 negative.
 */

const RATING_LABELS = { 1: "Very Poor", 2: "Poor", 3: "Okay", 4: "Good", 5: "Excellent" };

/** True when the patient gave no words the AI could read (staff remarks don't count). */
export function hasNoPatientText(comments) {
  const text = String(comments || "").trim();
  return !text || text === "(No speech detected.)";
}

export function sentimentFromRating(rating) {
  const r = Number(rating);
  if (!Number.isFinite(r) || r < 1 || r > 5) return null;
  if (r >= 4) return "positive";
  if (r === 3) return "neutral";
  return "negative";
}

/** The AI fields to store for a rating-only submission, or null when the rating is unusable. */
export function ratingOnlyAiFields(rating, now = new Date()) {
  const sentiment = sentimentFromRating(rating);
  if (!sentiment) return null;
  const r = Math.round(Number(rating));
  return {
    aiSentiment: sentiment,
    aiUrgency: r === 1 ? "high" : r === 2 ? "medium" : "low",
    aiTopics: [],
    aiSummary: `Rated ${r}/5 (${RATING_LABELS[r]}). No written comments.`,
    aiAnalyzedAt: now,
  };
}
