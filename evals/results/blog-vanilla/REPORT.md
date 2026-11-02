# First experiment: the blog, vanilla, five fresh sessions

The smallest first experiment from the brief (Appendix J): vanilla templates plus the blog schema, five fresh sessions, scored for conformance, template fidelity, and consistency. Skill at commit `ffb0b93`. Prompt: `evals/harness/prompt.md`. Each session read only the skill, and could not see the tests, the reference builds, or other runs. The scored table is `results.md`; each session's own account is `evals/runs/blog-vanilla/run-<n>/REPORT.md`.

## Result against the kill criterion

**0 of 5 runs conform. The kill criterion (80%) fails as written.**

Every run fails one or two of the 60 behavior and quality tests. All failures come from two tests, and both trace to rules the skill did not state, not to builds that ignored a rule:

| Test | Runs failing | Cause |
| --- | --- | --- |
| Collections show the empty state | 1, 2, 3, 5 | `behavior-spec.md` section 7 says `reset(seed)` "replaces all data". It does not say the current screen must re-render. Four runs passed the memory adapter's `reset` through as is, so after a reset the screen keeps the old data. Run 4 re-rendered and passed. |
| K6 skip link | 2, 4, 5 | K6 says the skip link "does not change the screen". The test also requires the URL to keep the route. Three runs let the URL become `#pn-main`. |

The tests stay as they are: both check behavior a person would notice (a stale screen after test setup, an address that no longer reloads the same screen). The fix is to state both rules in the spec.

## What held

| Measure | Result |
| --- | --- |
| Template fidelity on 10 views at 2 widths | 20 of 20 in every run |
| Shipped files unmodified (CSS, snippets, adapters, server, inlined templates) | 5 of 5 |
| No added dependencies | 5 of 5 |
| Every required file present | 5 of 5 |
| Behavior and quality tests | 58 to 59 of 60 in every run (293 of 300 overall) |
| Same DOM structure, 8 views | Runs 1–4 identical on every view. Run 5 differs only by an always-mounted, never-opened status slide-over |
| Same visible copy, 8 views | Identical across all 5 runs |

Every run copied templates and snippets mechanically rather than retyping them, which is why fidelity and unmodified files are perfect. The fixed copy table in `build.md` step 7 made the copy identical.

## Gaps the sessions reported

Each session listed what was unclear. Reported by most or all of them:

| Gap | Runs | Where |
| --- | --- | --- |
| S3 says Delete stays enabled while saving, but Delete is inside the form and `save-state.js` disables the whole form. Every run patched around it | 1–5 | `behavior-spec.md` S3 (wording added in Phase 6) |
| `build.md` asks for one `adapters/<recipe>.js` per recipe; the recipes say to copy `http.js` and `auth.js` | 1–5 | `build.md` "What you produce", step 6 |
| `compute` key for computed custom fields is only visible in a `fields.js` comment | 1–5 | `build.md` step 2 |
| Singular forms: "1 word", "Fix 1 field" | 1–5 | `build.md` step 7, V4 |
| Crumbs and title while an item loads or is missing; current nav entry on an item; login page title | 1–5 | `build.md` step 4 |
| Too-large upload message: contract and `fields.js` disagree | 2–5 | `recipes/contracts.md`, `snippets/fields.js` |
| The allow list is in `panel.config.js`, which the server serves publicly | 1, 2 | `google-login.md` step 3, `server.mjs` |
| "Ask" steps and the Google checklist cannot finish unattended | 1, 2, 5 | recipes, `build.md` step 8 |
| No mechanism for S9 on browser back, or for keeping edits on `unauthorized` | 3, 5 | `behavior-spec.md` S9, `contracts.md` |
| `start.mjs` port, host, and the ES-module requirement | 2, 3 | `build.md` |
| Enter in a one-field form submits natively and reloads | 5 | `behavior-spec.md` section 4 |
| `required` on singleton fields is never enforced | 5 | `behavior-spec.md` section 2 |

## Limits of this experiment

- One schema, one flavor, one model, the skill's author's own harness. The brief's variety, change-stability, model-robustness, cold-user, and baseline tests are not run.
- Sessions could use the repo's Playwright to try their builds (the prompt allowed a browser). A person outside this repository would not have it.
- Google sign-in, axe by hand, and the recipes' "Ask" steps were not exercised by the sessions.

## Recommendation

Do not rethink the approach on this result: the structure and copy are consistent, and fidelity is perfect. Fix the two missing rules and the S3 contradiction, close the other gaps in the table, then rerun five fresh sessions. If the rerun stays under 80%, the criterion stands and the approach needs rethinking.
