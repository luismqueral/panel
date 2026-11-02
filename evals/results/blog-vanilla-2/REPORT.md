# Second experiment: the blog, vanilla, five fresh sessions

The same experiment as `evals/results/blog-vanilla/`, rerun after D-059 closed the gaps the first one found. Skill at commit `921218a`. Prompt: `evals/harness/prompt.md`. Each session read only the skill, and could not see the tests, the reference builds, or other runs. The scored table is `results.md`; each session's own account is `evals/runs/blog-vanilla-2/run-<n>/REPORT.md`.

## Result against the kill criterion

**5 of 5 runs conform at `921218a`. The kill criterion (80%) passes.**

| Measure | Result |
| --- | --- |
| Behavior and quality tests | 64 of 64 in every run |
| Template fidelity on 10 views at 2 widths | 20 of 20 in every run |
| Shipped files unmodified | 5 of 5 |
| No added dependencies | 5 of 5 |
| Every required file present, allow list kept off the served config | 5 of 5 |
| Same visible copy, 8 views | Identical across all 5 runs |

## Where the runs still differ

The DOM structure differs on some views, in ways a person would not see:

- Runs 1 and 4 keep the status slide-over mounted while it is closed.
- Run 3 fills the empty-state region before it knows the collection is empty.
- Run 5 leaves the template rows in place under the Not found screen.

`build.md` now has a "What is mounted" row that settles all three: mount a part only while it shows.

## What the sessions reported missing

Each session listed the places it had to guess. The ones raised by two or more runs, and what changed after scoring (D-060):

| Gap | Runs | Change |
| --- | --- | --- |
| No way to show "Changed elsewhere" on a conflict | 4 | `save-state.js` and `useSaveState` take `errorMessage(error)`; S5 states the copy |
| Config example lacks `data` and `files` | 4 | `build.md` config example has `auth`, `data`, `files` |
| Singleton load error copy | 4 | Added to the copy table |
| Fidelity and K5 need a check "elsewhere" | 5 | `build.md` gives the hand procedure |
| "Publish" with 3 or more statuses | 3 | Publish means moving to any status after the first |
| Image files not served | 3 | `server.mjs` serves `.jpg`, `.jpeg`, `.gif` |
| Publish-only required fields stop being checked after a failed publish | 2 | A `validation.js` bug; it now keeps them checked until cleared |
| Saving an already published post skips the publish checks | 2 | New rule V8 |
| Cmd+S only on item screens | 2 | Shortcuts apply on every screen |

## The new tests and the old runs

Three tests were added with these fixes (67 in all): V4/V5 publish-only fields stay checked, V8, and the S5 conflict message. Rescored against them, the experiment-2 runs would not conform. Every run fails V8, and runs 1 to 4 also fail V4/V5, because they copied the `validation.js` that had the bug. They would also show modified files, since the shipped snippets and server changed after they copied them. Both reference builds pass all 67.

So the 5 of 5 holds for the skill as scored. A third run of five sessions is the way to confirm the current skill holds it too.
