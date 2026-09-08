import assert from "node:assert/strict";
import test from "node:test";
import { testerBugIssues } from "../dist/rules.js";

test("testerBugIssues parses issue numbers and removes duplicates", () => {
  assert.deepEqual(
    testerBugIssues("Результат\nPIPELINE_BUG_ISSUES: #17, 18,17\nPIPELINE_LABELS: in-qa"),
    [17, 18],
  );
});

test("testerBugIssues accepts none", () => {
  assert.deepEqual(
    testerBugIssues("PIPELINE_BUG_ISSUES: none\nPIPELINE_LABELS: in-qa"),
    [],
  );
});

test("testerBugIssues rejects a missing or malformed marker", () => {
  assert.equal(testerBugIssues("PIPELINE_LABELS: in-qa"), null);
  assert.equal(testerBugIssues("PIPELINE_BUG_ISSUES: 17 and 18"), null);
});
