import feedbackQr from "./image/feedback_qr.jpg";
import feedbackQrPrint from "./image/feedback_qr_print.jpg";
import { HOSPITAL } from "../lib/hospital";

/** The address the hospital's printed QR code opens. */
const FEEDBACK_QR_TARGET = "http://pfs.apdch.mapims.edu.in/feedback";

/** The hospital's printed feedback QR code, with a print-quality download. */
export function FeedbackQrCard() {
  return (
    <div className="rounded-2xl border-2 border-brand-gold bg-gradient-to-br from-[#FFFBF7] via-[#FFF8F0] to-[#FFF0F0] p-4 sm:p-6 shadow-md">
      <h3 className="text-lg font-bold text-primary mb-1">Feedback QR Code</h3>
      <p className="text-sm text-[#6b1229] mb-5">
        The hospital's official feedback QR code. Download the print-quality file for posters,
        counters and WhatsApp.
      </p>
      <div className="flex flex-col sm:flex-row sm:items-center gap-6">
        <img
          src={feedbackQr}
          alt={`${HOSPITAL.name} feedback QR code`}
          width={1000}
          height={1210}
          className="mx-auto sm:mx-0 h-auto w-full max-w-[220px] shrink-0 rounded-xl bg-white shadow-md ring-2 ring-primary/20"
        />
        <div className="space-y-3 text-center sm:text-left flex-1 min-w-0">
          <p className="text-xs font-semibold text-primary uppercase tracking-wide">Scan target</p>
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
  );
}
