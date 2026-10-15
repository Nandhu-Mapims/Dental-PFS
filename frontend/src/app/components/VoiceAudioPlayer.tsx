import React, { useRef, useState } from "react";

type VoiceAudioPlayerProps = {
  src: string;
  className?: string;
  onUnavailable?: () => void;
};

/** Within this many seconds of the end counts as "at the end" for restarting playback. */
const END_SLACK_SECONDS = 0.25;

/**
 * Browser-recorded WebM files carry no duration, so the element reports Infinity until it
 * has played to the end. The timeline is then wrong, and pressing play can resume at the end
 * instead of starting over. Seeking far past the end makes the browser work out the real
 * duration up front; after that we rewind to 0, and any play from the end restarts at 0.
 */
export function VoiceAudioPlayer({
  src,
  className = "w-full max-w-xl",
  onUnavailable,
}: VoiceAudioPlayerProps) {
  const [missing, setMissing] = useState(false);
  const resolvingDurationRef = useRef(false);

  if (missing) return null;

  const finishDurationProbe = (el: HTMLAudioElement) => {
    if (!resolvingDurationRef.current || !Number.isFinite(el.duration)) return;
    resolvingDurationRef.current = false;
    el.currentTime = 0;
  };

  return (
    <audio
      controls
      className={className}
      preload="metadata"
      src={src}
      onLoadedMetadata={(e) => {
        const el = e.currentTarget;
        if (Number.isFinite(el.duration)) return;
        resolvingDurationRef.current = true;
        el.currentTime = Number.MAX_SAFE_INTEGER;
      }}
      onDurationChange={(e) => finishDurationProbe(e.currentTarget)}
      onTimeUpdate={(e) => finishDurationProbe(e.currentTarget)}
      onPlay={(e) => {
        const el = e.currentTarget;
        if (resolvingDurationRef.current) {
          // Played before the duration probe came back: start from the top, not the probe position.
          resolvingDurationRef.current = false;
          el.currentTime = 0;
          return;
        }
        if (Number.isFinite(el.duration) && el.currentTime >= el.duration - END_SLACK_SECONDS) {
          el.currentTime = 0;
        }
      }}
      onError={() => {
        setMissing(true);
        onUnavailable?.();
      }}
    >
      Your browser does not support audio playback.
    </audio>
  );
}
