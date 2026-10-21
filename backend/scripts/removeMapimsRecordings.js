/**
 * Removes the MAPIMS patient recordings that were bundled into this repo by mistake and,
 * from 2026-10-14, copied onto the APDCH upload volume at startup.
 *
 * Deletes only these exact file names (21 MAPIMS submissions from May-June 2026, before
 * APDCH went live), so no APDCH recording can match. Safe to run repeatedly; the backend
 * runs it on every start.
 *
 * Manual run: node scripts/removeMapimsRecordings.js
 */
import fs from "fs/promises";
import path from "path";

const MAPIMS_RECORDINGS = [
  "69ff0ce7ece1c45aea57818f.webm",
  "69ff0d2bece1c45aea578197.webm",
  "69ff0e11a85848883966fde4.webm",
  "6a07ec99a1a0ad0e00dec368.webm",
  "6a11392a7671cfe5f1281f6f-q0.webm",
  "6a11392a7671cfe5f1281f6f-q1.webm",
  "6a11392a7671cfe5f1281f6f-q2.webm",
  "6a11392a7671cfe5f1281f6f-q3.webm",
  "6a11392a7671cfe5f1281f6f-q4.webm",
  "6a113c5c0cc47230c3582ff9-q0.webm",
  "6a113c5c0cc47230c3582ff9-q1.webm",
  "6a113c5c0cc47230c3582ff9-q2.webm",
  "6a113c5c0cc47230c3582ff9-q3.webm",
  "6a113c5c0cc47230c3582ff9-q4.webm",
  "6a13da86e1b1a86cce66f687.webm",
  "6a14257a4df18328ea030aab-q0.webm",
  "6a14257a4df18328ea030aab-q1.webm",
  "6a14257a4df18328ea030aab-q2.webm",
  "6a14257a4df18328ea030aab-q3.webm",
  "6a14257a4df18328ea030aab-q4.webm",
  "6a166485e2d90f0bda6aee8f-q0.webm",
  "6a166485e2d90f0bda6aee8f-q1.webm",
  "6a166485e2d90f0bda6aee8f-q2.webm",
  "6a166485e2d90f0bda6aee8f-q3.webm",
  "6a166485e2d90f0bda6aee8f-q4.webm",
  "6a16653ae2d90f0bda6aeed7-q0.webm",
  "6a16653ae2d90f0bda6aeed7-q1.webm",
  "6a16653ae2d90f0bda6aeed7-q2.webm",
  "6a16653ae2d90f0bda6aeed7-q3.webm",
  "6a16653ae2d90f0bda6aeed7-q4.webm",
  "6a1686df3966f4d597090169-q0.webm",
  "6a1686df3966f4d597090169-q1.webm",
  "6a1686df3966f4d597090169-q2.webm",
  "6a1686df3966f4d597090169-q3.webm",
  "6a1686df3966f4d597090169-q4.webm",
  "6a1805d8c7d16537e37241fd.webm",
  "6a181447c7d16537e3724782-q0.webm",
  "6a181447c7d16537e3724782-q1.webm",
  "6a181447c7d16537e3724782-q2.webm",
  "6a181447c7d16537e3724782-q3.webm",
  "6a181447c7d16537e3724782-q4.webm",
  "6a181e18c7d16537e3724bdc-q0.webm",
  "6a181e18c7d16537e3724bdc-q1.webm",
  "6a181e18c7d16537e3724bdc-q2.webm",
  "6a181e18c7d16537e3724bdc-q3.webm",
  "6a181e18c7d16537e3724bdc-q4.webm",
  "6a1820b8bf2bd3cc9033b92e-q0.webm",
  "6a1820b8bf2bd3cc9033b92e-q1.webm",
  "6a1820b8bf2bd3cc9033b92e-q2.webm",
  "6a1820b8bf2bd3cc9033b92e-q3.webm",
  "6a1820b8bf2bd3cc9033b92e-q4.webm",
  "6a182340bf2bd3cc9033ba1d.webm",
  "6a30ecb08b0461292b6d9c26.webm",
  "6a30ed2f8b0461292b6d9c52-q0.webm",
  "6a30ed2f8b0461292b6d9c52-q1.webm",
  "6a30ed2f8b0461292b6d9c52-q2.webm",
  "6a30ed2f8b0461292b6d9c52-q3.webm",
  "6a30ed2f8b0461292b6d9c52-q4.webm",
  "6a3122c5ce804dcd66bc0dcc-q0.webm",
  "6a3122c5ce804dcd66bc0dcc-q1.webm",
  "6a3122c5ce804dcd66bc0dcc-q2.webm",
  "6a3122c5ce804dcd66bc0dcc-q3.webm",
  "6a3122c5ce804dcd66bc0dcc-q4.webm",
  "6a351165eb7dbf830e6d5875.webm",
  "6a351388eda24ca08e9ff416-q0.webm",
  "6a351388eda24ca08e9ff416-q1.webm",
  "6a351388eda24ca08e9ff416-q2.webm",
  "6a351388eda24ca08e9ff416-q3.webm",
  "6a351388eda24ca08e9ff416-q4.webm",
];

const dir = path.join(process.cwd(), "uploads", "feedback-voice");
let removed = 0;
for (const name of MAPIMS_RECORDINGS) {
  try {
    await fs.unlink(path.join(dir, name));
    removed += 1;
  } catch (err) {
    if (err?.code !== "ENOENT") {
      // eslint-disable-next-line no-console
      console.error(`[cleanup] could not remove ${name}`, err?.message || err);
    }
  }
}
if (removed > 0) {
  // eslint-disable-next-line no-console
  console.log(`[cleanup] removed ${removed} MAPIMS recording(s) from uploads/feedback-voice`);
}
