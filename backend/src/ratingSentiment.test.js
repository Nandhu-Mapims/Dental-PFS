import { test } from "node:test";
import assert from "node:assert/strict";
import { hasNoPatientText, ratingOnlyAiFields, sentimentFromRating } from "./ratingSentiment.js";

test("rating maps to sentiment", () => {
  assert.equal(sentimentFromRating(5), "positive");
  assert.equal(sentimentFromRating(4), "positive");
  assert.equal(sentimentFromRating(3), "neutral");
  assert.equal(sentimentFromRating(2), "negative");
  assert.equal(sentimentFromRating(1), "negative");
  assert.equal(sentimentFromRating(0), null);
  assert.equal(sentimentFromRating("abc"), null);
});

test("empty or placeholder comments count as no patient text", () => {
  assert.equal(hasNoPatientText(""), true);
  assert.equal(hasNoPatientText("   "), true);
  assert.equal(hasNoPatientText(undefined), true);
  assert.equal(hasNoPatientText("(No speech detected.)"), true);
  assert.equal(hasNoPatientText("Good"), false);
});

test("rating-only fields are complete and readable", () => {
  const fields = ratingOnlyAiFields(4, new Date("2026-11-03T10:00:00Z"));
  assert.equal(fields.aiSentiment, "positive");
  assert.equal(fields.aiUrgency, "low");
  assert.deepEqual(fields.aiTopics, []);
  assert.equal(fields.aiSummary, "Rated 4/5 (Good). No written comments.");
  assert.equal(ratingOnlyAiFields(1).aiUrgency, "high");
  assert.equal(ratingOnlyAiFields(2).aiUrgency, "medium");
  assert.equal(ratingOnlyAiFields(9), null);
});
