import assert from "node:assert/strict";
import test from "node:test";
import {
  decideReleaseManagerOutcome,
  decideTesterOutcome,
  releaseChangelog,
  releasePrNumbers,
  releaseTag,
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
  assert.equal(roleForLabels(["bug", "qa-passed"]), "release-manager");
});

test("release-manager starts on qa-passed only", () => {
  assert.equal(roleForLabels(["feature", "qa-passed"]), "release-manager");
  assert.equal(roleForLabels(["feature", "qa-passed", "ready-for-release"]), null);
  assert.equal(roleForLabels(["feature", "qa-passed", "release-approved"]), null);
  assert.equal(roleForLabels(["feature", "qa-passed", "needs-human"]), null);
});

test("release markers parse tag, PRs and changelog", () => {
  const text = [
    "Чеклист",
    "PIPELINE_RELEASE_TAG: 0.3.0",
    "PIPELINE_PR_NUMBERS: #15, 16,15",
    "PIPELINE_CHANGELOG_BEGIN",
    "## Что вошло",
    "- stage 1",
    "PIPELINE_CHANGELOG_END",
    "PIPELINE_LABELS: ready-for-release",
  ].join("\n");
  assert.equal(releaseTag(text), "v0.3.0");
  assert.deepEqual(releasePrNumbers(text), [15, 16]);
  assert.equal(releaseChangelog(text), "## Что вошло\n- stage 1");
  assert.equal(
    decideReleaseManagerOutcome("finished", text, "v0.3.0", [15, 16], "## Что вошло\n- stage 1"),
    "ready-for-release",
  );
});

test("release-manager protocol mismatch needs human", () => {
  assert.equal(
    decideReleaseManagerOutcome("finished", "PIPELINE_LABELS: ready-for-release", null, [], "x"),
    "needs-human",
  );
  assert.equal(
    decideReleaseManagerOutcome(
      "finished",
      "PIPELINE_RELEASE_TAG: v1.0.0\nPIPELINE_PR_NUMBERS: none\nPIPELINE_LABELS: ready-for-release",
      "v1.0.0",
      [],
      null,
    ),
    "needs-human",
  );
  assert.equal(
    decideReleaseManagerOutcome("error", "PIPELINE_LABELS: ready-for-release", "v1.0.0", [], "body"),
    "needs-human",
  );
});
