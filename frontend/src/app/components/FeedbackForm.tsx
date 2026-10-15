import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  enqueueFeedbackSubmission,
  newOutboxId,
  notifyOutboxChanged,
  saveVoiceDraft,
  syncAfterEnqueue,
} from "../lib/feedbackOutbox";
import { getSession, isInternalUser } from "../lib/auth";
import { usePatientIdentity } from "../lib/usePatientIdentity";
import {
  getBrandingSettings,
  loadBrandingSettings,
  onBrandingSettingsChange,
} from "../lib/branding";
import { FeedbackRemarkField } from "./StaffRemarksField";
import { FeedbackVoiceSection } from "./FeedbackVoiceSection";
import { PatientIdentitySection } from "./PatientIdentitySection";
import { PatientCard, PatientFooter, PrimaryAction, StatusNote, StepHeading } from "./PatientCard";
import { CheckCircle2 } from "lucide-react";
import rating5 from "./image/rating/rating-5.png";
import rating4 from "./image/rating/rating-4.png";
import rating3 from "./image/rating/rating-3.png";
import rating2 from "./image/rating/rating-2.png";
import rating1 from "./image/rating/rating-1.png";

type InputKind = "voice" | "type";

const emotions = [
  { id: 5, image: rating5, label: "Excellent", prompt: "What did you love about your visit?" },
  { id: 4, image: rating4, label: "Good", prompt: "What did you like?" },
  { id: 3, image: rating3, label: "Okay", prompt: "How can we improve?" },
  { id: 2, image: rating2, label: "Poor", prompt: "What went wrong?" },
  { id: 1, image: rating1, label: "Very Poor", prompt: "What went wrong?" },
];

export function FeedbackForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const modeParam = searchParams.get("mode");
  const inputKind: InputKind = modeParam === "voice" ? "voice" : "type";

  const [voiceReady, setVoiceReady] = useState(false);
  const [voiceRecordingBlob, setVoiceRecordingBlob] = useState<Blob | null>(null);
  const [voiceRevision, setVoiceRevision] = useState(0);
  const [selectedEmotion, setSelectedEmotion] = useState<number | null>(null);
  const identity = usePatientIdentity();

  const [comments, setComments] = useState("");
  const [remark, setRemark] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitPhase, setSubmitPhase] = useState<"idle" | "text" | "voice">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [transcriptionPending, setTranscriptionPending] = useState(false);
  const [primaryColor, setPrimaryColor] = useState("#8B1538");
  const prevModeBucketRef = useRef<string | null>(null);
  const outboxIdRef = useRef<string | null>(null);
  const draftCommentsRef = useRef("");
  const draftRatingRef = useRef<number | null>(null);
  const voiceBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    const bucket = modeParam === "voice" ? "voice" : "type";
    if (prevModeBucketRef.current === null) {
      prevModeBucketRef.current = bucket;
      return;
    }
    if (prevModeBucketRef.current === bucket) return;
    prevModeBucketRef.current = bucket;
    setSubmitError(null);
    setRemark("");
    setSelectedEmotion(null);
    setComments("");
    setVoiceReady(false);
    setVoiceRecordingBlob(null);
    setVoiceRevision((r) => r + 1);
    setTranscriptionPending(false);
    outboxIdRef.current = null;
    identity.reset();
  }, [modeParam, identity.reset]);

  const internalSubmit = isInternalUser(getSession());

  const selectedEmotionData = emotions.find((e) => e.id === selectedEmotion);

  useEffect(() => {
    void loadBrandingSettings().then((current) => {
      setPrimaryColor(current.primaryColor);
    });
    return onBrandingSettingsChange(() => {
      setPrimaryColor(getBrandingSettings().primaryColor);
    });
  }, []);

  const getSubmitFields = identity.getSubmitFields;

  const persistVoiceDraft = useCallback(
    async (transcript: string, inferredRating: number, audioBlob: Blob | null) => {
      if (!outboxIdRef.current) outboxIdRef.current = newOutboxId();
      const isStaffSession = getSession()?.role === "staff";
      await saveVoiceDraft(
        outboxIdRef.current,
        {
          ...getSubmitFields(),
          rating: inferredRating,
          comments: transcript.trim(),
          source: isStaffSession ? "staff" : "patient",
          submissionMode: "voice",
        },
        audioBlob
      );
    },
    [getSubmitFields]
  );

  const onVoiceSuccess = useCallback(
    (transcript: string, inferredRating: number) => {
      draftCommentsRef.current = transcript;
      draftRatingRef.current = inferredRating;
      setComments(transcript);
      setSelectedEmotion(inferredRating);
      setVoiceReady(true);
      setSubmitError(null);
      void persistVoiceDraft(transcript, inferredRating, voiceBlobRef.current);
    },
    [persistVoiceDraft]
  );

  const onVoiceCleared = useCallback(() => {
    setVoiceReady(false);
    setSelectedEmotion(null);
    setComments("");
  }, []);

  const onVoiceError = useCallback((message: string | null) => {
    setSubmitError(message);
  }, []);

  const onVoiceRecordingReady = useCallback(
    (blob: Blob | null) => {
      voiceBlobRef.current = blob;
      setVoiceRecordingBlob(blob);
      if (!blob) return;
      // Save the raw recording to IndexedDB the instant it's available — before
      // transcription finishes — so a dropped connection during transcription
      // never loses the audio. onVoiceSuccess overwrites this same draft (same
      // outbox id) with the final transcript/rating once ready.
      const transcript = draftCommentsRef.current.trim();
      const rating = draftRatingRef.current ?? 3;
      void persistVoiceDraft(transcript, rating, blob);
    },
    [persistVoiceDraft]
  );

  const handleSubmit = async () => {
    const identityError = identity.validateForSubmit();
    if (identityError) {
      setSubmitError(identityError);
      return;
    }

    if (inputKind === "type") {
      if (!selectedEmotion) {
        setSubmitError("Please choose how your experience felt.");
        return;
      }
    } else {
      if (!voiceReady || selectedEmotion == null) {
        setSubmitError("Please speak your feedback first.");
        return;
      }
      if (transcriptionPending) {
        setSubmitError(
          "Still finishing transcription — your recording is saved and this will complete automatically in a moment."
        );
        return;
      }
      const c = comments.trim();
      if (!c || c === "(No speech detected.)") {
        setSubmitError("No speech detected — tap to speak again.");
        return;
      }
    }

    try {
      setSubmitError(null);
      setIsSubmitting(true);
      setSubmitPhase("text");
      const outboxId = outboxIdRef.current ?? newOutboxId();
      outboxIdRef.current = outboxId;

      const payload = {
        ...identity.getSubmitFields(),
        rating: selectedEmotion as number,
        comments: comments.trim(),
        ...(remark.trim() ? { staffRemarks: remark.trim() } : {}),
        source: (internalSubmit ? "staff" : "patient") as "staff" | "patient",
        submissionMode: (inputKind === "voice" ? "voice" : "standard") as "voice" | "standard",
      };

      await enqueueFeedbackSubmission({
        id: outboxId,
        payload,
        audioBlob: inputKind === "voice" ? voiceBlobRef.current ?? voiceRecordingBlob : null,
        thankYouState: {
          rating: selectedEmotion as number,
          fromStaffSession: internalSubmit,
        },
      });

      if (inputKind === "voice" && voiceRecordingBlob?.size) {
        setSubmitPhase("voice");
      }

      const syncResult = await syncAfterEnqueue(outboxId);
      notifyOutboxChanged();

      let voiceUploadWarning: string | undefined;
      let offlineQueued = false;
      let created: Record<string, unknown> = {};

      if (syncResult.kind === "queued") {
        offlineQueued = true;
      } else {
        created = syncResult.response;
        if (syncResult.kind === "text_only") {
          voiceUploadWarning =
            "Your feedback was saved. We could not finish sending everything — your words are on record.";
        }
      }

      navigate("/thank-you", {
        state: {
          rating: selectedEmotion,
          fromStaffSession: internalSubmit,
          staffRemarks: remark.trim() || undefined,
          aiSummary: typeof created.aiSummary === "string" ? created.aiSummary : undefined,
          aiSentiment: created.aiSentiment as "positive" | "neutral" | "negative" | undefined,
          aiUrgency: created.aiUrgency as string | undefined,
          aiTopics: Array.isArray(created.aiTopics) ? (created.aiTopics as string[]) : undefined,
          voiceUploadWarning,
          offlineQueued,
        },
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not submit feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
      setSubmitPhase("idle");
    }
  };

  const canSubmitType = Boolean(selectedEmotion && identity.identityReady);
  const canSubmitVoice = Boolean(
    voiceReady && selectedEmotion != null && identity.identityReady && !transcriptionPending
  );

  const submitEnabled =
    identity.identityReady &&
    !isSubmitting &&
    (inputKind === "type" ? canSubmitType : canSubmitVoice);

  const showRemark =
    inputKind === "voice" ? voiceReady : Boolean(selectedEmotion);

  const linkClass = "inline text-left font-semibold underline decoration-1 underline-offset-2 hover:decoration-2";

  return (
    <div className="max-w-3xl mx-auto">
      <PatientCard
        kicker={inputKind === "voice" ? "Voice feedback" : "Rate & share"}
        title="How was your experience today?"
        subtitle={
          inputKind === "voice"
            ? "Tell us about your visit in your own words — Tamil, Hindi or English."
            : "Your feedback reaches the team responsible for your care."
        }
      >
        <section className="mb-8">
          <StepHeading step={1} title="Your details" primaryColor={primaryColor} />
          <PatientIdentitySection identity={identity} primaryColor={primaryColor} />
          <StatusNote
            primaryColor={primaryColor}
            ready={inputKind === "voice" && identity.identityReady}
          >
            {inputKind === "voice" ? (
              identity.identificationMode === "name" ? (
                identity.identityReady ? (
                  <>Ready to listen, {identity.resolvedPatientName}. Tap below to share your experience.</>
                ) : !identity.nameReady ? (
                  "Please enter your name and select your department before speaking."
                ) : (
                  "Please select your department before speaking."
                )
              ) : identity.identityReady ? (
                "Visit confirmed from EMR. Tap below to share your experience."
              ) : (
                "Look up your registration number and confirm your visit from EMR before speaking."
              )
            ) : (
              <>
                If the patient is elder or unable to read/write, staff can fill this form on their behalf. Prefer
                to speak?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/feedback/give?mode=voice", { replace: true })}
                  className={linkClass}
                  style={{ color: primaryColor }}
                >
                  Use voice instead
                </button>{" "}
                (Tamil, Hindi &amp; English). Or{" "}
                <button
                  type="button"
                  onClick={() => navigate("/feedback")}
                  className={linkClass}
                  style={{ color: primaryColor }}
                >
                  pick again on the previous screen
                </button>
                .
              </>
            )}
          </StatusNote>
        </section>

        {inputKind === "voice" && (
          <section className="mb-6">
            <StepHeading
              step={2}
              title="Share your experience"
              hint="Choose a language if you like, then tap the microphone and speak naturally."
              primaryColor={primaryColor}
            />
            <FeedbackVoiceSection
              identityReady={identity.identityReady}
              primaryColor={primaryColor}
              resetRevision={voiceRevision}
              onVoiceSuccess={onVoiceSuccess}
              onVoiceCleared={onVoiceCleared}
              onVoiceError={onVoiceError}
              onVoiceRecordingReady={onVoiceRecordingReady}
              onTranscriptionPendingChange={setTranscriptionPending}
            />
          </section>
        )}

        {inputKind === "type" && (
          <section className="mb-8">
            <StepHeading
              step={2}
              title="Rate your visit"
              hint={
                <>
                  Choose how you felt, then{" "}
                  <span className="font-medium text-gray-700">
                    describe your visit in comments so your rating matches your words.
                  </span>
                </>
              }
              primaryColor={primaryColor}
            />
            <div className="grid grid-cols-5 gap-2 md:gap-3" role="radiogroup" aria-label="Rating">
              {emotions.map((emotion) => {
                const selected = selectedEmotion === emotion.id;
                const dimmed = selectedEmotion != null && !selected;
                return (
                  <button
                    key={emotion.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setSelectedEmotion(emotion.id)}
                    className="group relative flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-xl border bg-white px-1 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md md:min-h-[128px] md:py-5"
                    style={
                      selected
                        ? {
                            borderColor: primaryColor,
                            backgroundColor: `${primaryColor}0A`,
                            boxShadow: `0 0 0 3px ${primaryColor}1F`,
                          }
                        : { borderColor: "#E8E1D9" }
                    }
                  >
                    {selected ? (
                      <CheckCircle2
                        className="absolute right-1.5 top-1.5 h-4 w-4 md:right-2 md:top-2"
                        style={{ color: primaryColor }}
                      />
                    ) : null}
                    <img
                      src={emotion.image}
                      alt=""
                      draggable={false}
                      className={`h-11 w-11 select-none transition-all duration-200 md:h-14 md:w-14 ${
                        selected
                          ? "scale-110 drop-shadow-[0_6px_10px_rgb(0_0_0/0.15)]"
                          : dimmed
                            ? "opacity-45 grayscale group-hover:opacity-80 group-hover:grayscale-0"
                            : "group-hover:scale-105"
                      }`}
                    />
                    <span
                      className={`text-center text-[11px] leading-tight md:text-sm ${
                        selected ? "font-semibold" : "font-medium text-gray-600"
                      }`}
                      style={selected ? { color: primaryColor } : undefined}
                    >
                      {emotion.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedEmotionData && (
              <div className="mt-6 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="mb-2 block text-sm font-semibold text-gray-800 md:text-base">
                  {selectedEmotionData.prompt}
                </label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Share your thoughts... (optional)"
                  className="h-32 w-full resize-none rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 outline-none transition placeholder:text-gray-400 md:h-36"
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = primaryColor;
                    e.currentTarget.style.boxShadow = `0 0 0 4px ${primaryColor}1A`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>
            )}
          </section>
        )}

        {showRemark ? (
          <div className="mb-6">
            <FeedbackRemarkField value={remark} onChange={setRemark} />
          </div>
        ) : null}

        <PrimaryAction
          primaryColor={primaryColor}
          onClick={() => void handleSubmit()}
          disabled={!submitEnabled}
        >
          {isSubmitting ? (
            <>
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              {submitPhase === "voice" ? "Almost done..." : "Submitting..."}
            </>
          ) : (
            "Submit feedback"
          )}
        </PrimaryAction>
        {submitError && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-center text-sm font-medium text-red-700">
            {submitError}
          </p>
        )}
      </PatientCard>

      <PatientFooter showTiming onBack={() => navigate("/feedback")} />
    </div>
  );
}
