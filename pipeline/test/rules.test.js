import assert from "node:assert/strict";
import test from "node:test";
import {
  decideTesterOutcome,
  roleForLabels,
  testerBugIssues,
} from "../dist/rules.js";

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

test("tester passes QA only with no bugs and matching marker", () => {
  assert.equal(
    decideTesterOutcome(
      "finished",
      "PIPELINE_BUG_ISSUES: none\nPIPELINE_LABELS: qa-passed",
      [],
    ),
    "qa-passed",
  );
  assert.equal(
    decideTesterOutcome(
      "finished",
      "PIPELINE_BUG_ISSUES: 17\nPIPELINE_LABELS: in-qa",
      [17],
    ),
    "in-qa",
  );
});

test("tester protocol mismatch needs human", () => {
  assert.equal(decideTesterOutcome("finished", "PIPELINE_LABELS: qa-passed", null), "needs-human");
  assert.equal(
    decideTesterOutcome(
      "finished",
      "PIPELINE_BUG_ISSUES: 17\nPIPELINE_LABELS: qa-passed",
      [17],
    ),
    "needs-human",
  );
});

test("QA in progress and passed states do not retrigger tester", () => {
  assert.equal(roleForLabels(["bug", "in-qa"]), "tester");
  assert.equal(roleForLabels(["bug", "in-qa", "qa-in-progress"]), null);
  assert.equal(roleForLabels(["bug", "qa-passed"]), null);
});
