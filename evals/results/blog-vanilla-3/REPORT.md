# Third experiment: the blog, vanilla, five fresh sessions

The same experiment as `evals/results/blog-vanilla-2/`, rerun after D-060 to confirm the skill as it now stands. Skill at commit `e329118`. Prompt: `evals/harness/prompt.md`. Each session read only the skill, and could not see the tests, the reference builds, or other runs. The scored table is `results.md`; each session's own account is `evals/runs/blog-vanilla-3/run-<n>/REPORT.md`.

## Result against the kill criterion

**5 of 5 runs conform. The kill criterion (80%) passes, now against all 67 tests.**

| Measure | Experiment 2 | Experiment 3 |
| --- | --- | --- |
| Behavior and quality tests | 64 of 64 in every run | 67 of 67 in every run |
| Template fidelity on 10 views at 2 widths | 20 of 20 | 20 of 20 |
| Shipped files unmodified, no dependencies, required files present | 5 of 5 | 5 of 5 |
| Views with one DOM structure across all runs | 0 of 8 | 7 of 8 |
| Views with identical copy | 8 of 8 | 8 of 8 |

The three tests that the experiment-2 runs would have failed (V4/V5 publish-only fields, V8, the S5 conflict message) pass in every run.

## Where the runs still differ

One structure difference, on the collection screen: run 1 keeps the create dialog mounted (closed) while the collection is open, as the reference build does; runs 2 to 5 add it only while it is open. No one would see it. Every session named this gap. `build.md` "What is mounted" now says to follow the reference.

## What the sessions reported missing

No gap blocked a run. The ones raised by two or more:

| Gap | Runs |
| --- | --- |
| When the create dialog is mounted | 5 |
| A `forbidden` load: how the panel gets "This account isn't allowed" to the login screen | 5 |
| Whether the status button shows while loading, and how to hide it for types without status | 4 |
| Publish checks before or after the confirm dialog | 3 |
| Home's breadcrumb and page title; the last crumb's `href` | 3 |
| `.gitignore` for uploads is named by `local-disk.md` but not by `build.md` | 2 |
| Create: send every field, or only the dialog's, and whether computed values are included | 2 |
| Date-only values shifting a day by time zone | 2 |

Most runs guessed the same way on these, and every guess passed the tests. Two guesses split: run 3 formats date-only values in UTC while the others read them as local dates, and runs disagree on whether Delete on a dirty item asks to discard first. Neither is covered by a test yet.

## Incidents

Run 5 attached to another session's Chrome on port 9333 before moving to a free port, and stopped its server with `pkill -f "node start.mjs"`, which also stopped the servers runs 3 and 4 were using. Both had finished their checks; their reports are unaffected.
