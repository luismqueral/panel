# Evals

Tests for the skill, cheapest first (brief, Appendix J). There are two kinds:

1. **Fixed test suites.** They check the skill itself, run in seconds to minutes, and should pass after every change.
2. **Experiments.** Fresh sessions build a panel from a prompt, using only the skill. They show whether the skill works on a project it hasn't seen.

| Folder | What it is | Run |
| --- | --- | --- |
| `behavior/` | The behavior spec as browser tests, plus fidelity, axe, and 400px checks on every screen. Any build, any flavor | `PANEL_URL=<url> npm run test:behavior`, or `node tools/run-behavior.mjs <dist>` |
| `recipes/` | The verified recipes against the real project server | `npm run test:recipes` |
| `fixtures/` | Reference builds: `vanilla-blog/`, `react-blog/` | `npm run test:behavior`, `npm run test:behavior:react` |
| `harness/` | The experiment protocol: run prompts, preset intake, scorer, trace and screenshot tools | below |

## Fixed test suites

```bash
npm run -s test:schema            # the schema validator, against valid and invalid fixtures
npm run -s check:templates        # templates and the design system agree
npm run -s check:design-system    # components, dark mode, no sideways scroll at 400px
npm run -s check:playground -- panel/examples/blog/playground.html panel/examples/blog/panel.yaml
npm run -s test:recipes           # login and save recipes against a real server
npm run -s test:behavior          # the behavior tests on the vanilla blog build
npm run -s test:behavior:react    # the same tests on the React blog build
```

Never weaken a check to make it pass.

## Experiments

### Where they write

Runs and results are not in this repository. They go in a sibling folder, `../panel-evals/` by default (set `PANEL_EVALS_DIR` to move it; see `harness/paths.mjs`). Keep it out of any public remote.

| Folder | What it is |
| --- | --- |
| `runs/<experiment>/run-<n>/` | One fresh session's output and its `REPORT.md` |
| `results/<experiment>/` | The write-up, scores, traces, and screenshots |
| `private/` | Prompts and fixtures that describe internal systems and must not be published |

### Prompts

| Prompt | The session gets | It runs |
| --- | --- | --- |
| `harness/prompt.md` | A preset schema and intake record (`blog.intake.yaml`) | Build and Conformance |
| `harness/recipes-prompt.md` | Only a request in the person's words | Intake, Schema, Preview, Build, and Conformance: it designs the schema, then builds against it |

A new project needs a new prompt in the same shape: the request, the unattended rules (choose the recommended option, record it with `assumed: true`, treat approvals as given), the files to write in order, the read rules, and the reply format. If the session starts from an existing repo, write a made-up fixture repo for it. If the prompt or fixture describes internal systems, put both in `../panel-evals/private/`, not `harness/`.

### Steps

1. **Set up run folders.** Create `../panel-evals/runs/<experiment>/run-<n>/` for each run. If there's a fixture repo, copy it into each folder and save checksums of its files first:

   ```bash
   (cd <fixture> && find . -type f | sort | xargs shasum > ../fixture.sha)
   ```

2. **Launch fresh sessions,** one per run folder, in the background. Give each the prompt with `{{RUN}}` set to its own folder. A session must not see other runs, the tests, or this repository's answers.
3. **Watch each session.** In Cursor, a session's transcript is a `.jsonl` file under the agent transcripts folder. This writes a readable timeline, flagging any forbidden path it touches:

   ```bash
   node evals/harness/trace.mjs <transcript.jsonl> --run <run folder> --out ../panel-evals/results/<experiment>/run-<n>.TRACE.md --watch
   ```

4. **Save each session's final reply** as `REPORT.md` in its run folder.
5. **Check the results.**
   - **Blog experiments:** `node evals/harness/score.mjs ../panel-evals/runs/<experiment>`. It writes `results.md`, `results.json`, and screenshots (see "The blog scorer").
   - **Any other project:**
     - The schema: `node tools/validate.mjs <run>/panel.yaml`.
     - Shipped files unchanged: compare each copied file with its source byte for byte (`cmp`): `panel/design-system/` to `styles/`, `panel/snippets/` to `snippets/`, `panel/recipes/client/` to `adapters/`, `panel/recipes/server/` to `server/`.
     - A fixture repo put back as it was: `(cd <run> && shasum -c <fixture.sha> --quiet)`.
     - Any rule the prompt sets, such as no secret values in `seed.json` or the pages.
     - Screenshots: `node evals/harness/shots.mjs <run> ../panel-evals/results/<experiment>/shots/run-<n>`. It reads the run's `panel.yaml` and captures home, each type's list, first item, unsaved edit, and create dialog, each singleton, and the playground.
     - Each trace's "Forbidden paths touched" line.
6. **Write up and commit.** Write `../panel-evals/results/<experiment>/REPORT.md`: the result, how the runs differ, the gaps the sessions raised (how many raised each), and incidents. Commit `../panel-evals` locally. If the findings change the skill, add an entry to `DECISIONS.md` here.

To look at a finished build, serve its run folder and open `/panel/?test`. Test mode uses the run's `seed.json` in memory, needs no sign-in, and saves nothing.

### The blog scorer

For each run, `harness/score.mjs`:

- copies the test seed over the run's `seed.json`;
- serves the run's `panel/` and runs the behavior suite;
- checks that every shipped file is unmodified and every template is inlined unchanged;
- checks for added dependencies;
- snapshots eight views.

Across runs, it counts distinct DOM structures and distinct visible copy per view.

A run **conforms** when every test passes, every shipped file is unmodified, it adds no dependencies, and every required file exists. The kill criterion is 80% of runs conforming. The scorer checks the vanilla layout; a React run needs its own required-files list. It compares against the skill as it is now, so rescoring an old run after the skill changed shows those changes as failures.

### Known weak spots

- **Steps 1 to 5 are manual.** There is no single command that runs an experiment.
- **Only the blog has a scorer.** Other projects get the separate checks in step 5.
- **Runs aren't isolated.** Sessions share one machine. Twice a session has stopped another's processes with a broad `pkill`, even though the prompt forbids it. Sessions can also read the IDE's terminal output files, which hold every run's output.
- **Traces are Cursor-only and partial.** They show messages and tool calls, but not tool results, thinking, tokens, time, or cost.

`docs/EVALS-PLAN.md` is the plan to address these with Harbor: one command per experiment, a container per run, and a standard trace format across Cursor, Claude Code, and other models.
