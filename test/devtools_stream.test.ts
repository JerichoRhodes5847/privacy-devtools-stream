import assert from "node:assert/strict";
import { validateRequest } from "../src/devtools_stream.js";

const accepted = validateRequest({ prompt: "summarize build logs", release: { version: "1.4.0", commit: "abc123" } });
assert.equal(accepted.success, true);

const rejected = validateRequest({ prompt: "patient diagnosis", release: { version: "1.4.0", commit: "abc123" }, patient_id: "42" });
assert.equal(rejected.success, false);
console.log("request boundary test passed");
