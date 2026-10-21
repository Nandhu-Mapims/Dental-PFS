import test from "node:test";
import assert from "node:assert/strict";
import { redactPersonalDetails } from "./piiRedact.js";

test("masks the patient's name, phone numbers and email", () => {
  const out = redactPersonalDetails(
    "I am Ramesh Kumar, call me on +91 98765 43210 or ramesh.k@gmail.com. Kumar waited long.",
    { names: ["Ramesh Kumar"] }
  );
  assert.equal(out, "I am [name], call me on [phone] or [email]. [name] waited long.");
});

test("keeps dates, short numbers and clinical words", () => {
  const text = "Visited on 15-10-2026, waited 45 minutes in room 3 for root canal.";
  assert.equal(redactPersonalDetails(text, { names: ["Priya S"] }), text);
});

test("matches a name only as a whole word, in any case", () => {
  assert.equal(
    redactPersonalDetails("ANITHA said the anitha-ward staff were kind; Anithamma too.", { names: ["Anitha"] }),
    "[name] said the [name]-ward staff were kind; Anithamma too."
  );
});

test("works on Tamil text and Tamil-script names", () => {
  assert.equal(
    redactPersonalDetails("என் பெயர் முருகன், டாக்டர் நல்லா பார்த்தாங்க. 9876543210", { names: ["முருகன்"] }),
    "என் பெயர் [name], டாக்டர் நல்லா பார்த்தாங்க. [phone]"
  );
});

test("handles empty input and missing names", () => {
  assert.equal(redactPersonalDetails("", { names: ["X"] }), "");
  assert.equal(redactPersonalDetails(null), "");
  assert.equal(redactPersonalDetails("no names here"), "no names here");
});
