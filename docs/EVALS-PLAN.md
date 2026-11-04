# Plan: testing the Panel skill with Harbor

This plan replaces how we test the skill today. It is written for someone new to evals: section 1 explains the ideas, section 2 says why we are changing, and sections 3 to 9 are the steps.

## 1. The ideas, in plain words

An **eval** (evaluation) is a repeatable test of an AI agent. You give the agent a task, let it work alone, then check the result with code. Because agents are random, you run the same task several times and count how often they pass.

| Word | Meaning | For Panel |
| --- | --- | --- |
| Task | One job, with its instructions, its starting files, and a way to check the result | "Build me an admin panel for my blog", with the skill and the blog schema |
| Agent | The program that does the task. It uses a model (the AI) | Claude Code, or Cursor's command-line agent |
| Model | The AI behind the agent | For example Claude Sonnet, or a GPT model |
| Trial | One attempt by one agent at one task | One fresh session building one panel |
| Job | A batch of trials run together | 5 trials of Claude Code on the blog task |
| Sandbox | A fresh, sealed computer (a Docker container) for each trial | The agent sees only the skill and the inputs |
| Verifier | The code that checks a trial and gives it a score | Our 67 behavior tests, fidelity, and file checks |
| Reward | The score the verifier writes: 1 means pass, 0 means fail | 1 when the build conforms |
| Oracle | A fake agent that runs a known correct answer | Copies our reference blog build into place |
| Trace (trajectory) | The record of everything the agent did: messages, tool calls, results, tokens, cost | What it read, ran, and wrote, step by step |
| Baseline | The same task without the thing you are testing | The blog task with no skill |
| Pass rate | Passing trials divided by all trials | 5 of 5 is 100% |

**Harbor** is a free, open-source tool (Apache 2.0) that runs evals. It builds a sandbox for each trial, starts the agent inside it, runs the verifier when the agent stops, and saves the trace and score. It already knows how to run Claude Code, Cursor's agent, and about 40 others.

## 2. Why change how we test

Experiments 1 to 3 used Cursor subagents inside this repository. They worked, but have four weaknesses:

1. **Trust, not proof.** The agents could see the tests. We asked them not to read them. In a sandbox, the tests are not there until the agent has finished.
2. **Incomplete logs.** Cursor's transcripts show what the agent asked for, not what came back, and have no tokens or cost.
3. **One agent, one model.** Every run used the same model as the session that started it.
4. **Hard for others to repeat.** Anyone with Harbor and an API key can rerun a Harbor task with one command.

## 3. What we will build

A Harbor task in `evals/harbor/blog-vanilla/`:

```
evals/harbor/blog-vanilla/
  instruction.md        the prompt, from evals/harness/prompt.md, minus the "don't read" rules
  task.toml             settings: time limits, memory, where the skill is
  environment/
    Dockerfile          Node, Chromium, the skill, and the two input files
    skills/panel/       the skill, copied from panel/ at a known commit
    inputs/             blog.intake.yaml and panel.yaml
  tests/
    test.sh             runs our scorer on /app and writes the reward
    ...                 the behavior tests, fidelity tools, and seed data
  solution/
    solve.sh            copies the reference blog build into /app
```

Then a second task, `blog-vanilla-no-skill/`, identical except it has no skill. It is the baseline.

## 4. Steps

Each step says what to do, why, how we know it is done, and what it costs. Steps 1 to 4 cost nothing but time. API money starts at step 5.

### Step 1: Install Harbor

- **Do:** install `uv` (a Python tool manager), then `uv tool install harbor`. `uv` brings its own Python, because Harbor needs 3.12 or later and this Mac has 3.9. Run `harbor run --help`.
- **Why:** everything else needs it.
- **Done when:** `harbor run --help` prints its options.
- **Cost:** none. Docker is already installed and running.

### Step 2: Teach the scorer to score one build

- **Do:** add a mode to `evals/harness/score.mjs` that scores one folder (`/app`) and writes JSON: conforms (0 or 1), tests passed, fidelity, unmodified files, dependencies, missing files, and the allow-list check.
- **Why:** today it scores a folder of five runs. Harbor checks one trial at a time and reads a file called `reward.json`.
- **Done when:** scoring a copy of `../panel-evals/runs/blog-vanilla-3/run-1` gives the same numbers as `results.md`.
- **Cost:** none.

### Step 3: Write the task

- **Do:** write the files in section 3. The Dockerfile installs Node and Chromium, copies the skill to `/skills/panel` and the inputs to `/app/inputs`. `task.toml` sets `skills_dir = "/skills"`, an agent time limit (start with 60 minutes; our runs took about 20), and enough memory for Chromium.
- **Why:** this is the eval itself.
- **Done when:** the image builds.
- **Cost:** none. The image will be large (about 1 to 2 GB) because of Chromium.

### Step 4: Check the test with the oracle

- **Do:** `harbor run -p evals/harbor/blog-vanilla` (the default agent is the oracle).
- **Why:** if the known correct answer does not score 1, the task or the scorer is broken, and no agent's score means anything. Also run it once on a deliberately broken build (one snippet edited) to see it score 0.
- **Done when:** the reference build scores 1, and the broken one scores 0.
- **Cost:** none.

### Step 5: One trial per agent

- **Do:** one Claude Code trial and one Cursor trial:

  ```
  harbor run -p evals/harbor/blog-vanilla -a claude-code -m <model> -o evals/jobs
  harbor run -p evals/harbor/blog-vanilla -a cursor-cli -m <model> -o evals/jobs
  ```

- **Why:** to see what each agent's trace actually contains before paying for more. Check: is every tool call and its result there? Tokens? Cost? Time? The agent's final reply, with its list of gaps and guesses?
- **Done when:** we have written down, per agent, what the trace has and lacks.
- **Cost:** two trials. Needs `ANTHROPIC_API_KEY` and a Cursor API key, billed per use. Write down the cost of each; it sets the budget for step 6.

### Step 6: The real experiment

- **Do:** 5 trials per agent on both tasks, with and without the skill. `-k 5` repeats each trial 5 times; `-n` runs some at once.
- **Why:** with the skill against without it shows whether the skill helps, not only whether agents can build a panel. Two agents show whether it works beyond one.
- **Done when:** 20 trials are scored.
- **Cost:** about 20 times the step-5 cost per trial. Decide the budget before starting.

### Step 7: Read across the trials

- **Do:** a script over Harbor's output folder that writes one report: pass rate per agent, with and without the skill; time, tokens, and cost per trial; which skill files each trial read; the agents' lists of gaps and guesses, grouped; and the structure and copy comparison we already do.
- **Why:** Harbor scores each trial alone. Comparing trials, and linking a guess to whether the agent read the part of the skill that answers it, is how the skill gets better.
- **Done when:** one page answers "does the skill work, does it help, what does it cost, and what is still unclear".
- **Cost:** none.

### Step 8: Write down the rule for passing before each experiment

- **Do:** before every job, write in its folder: what counts as a pass, and what result would mean the skill failed. For example "at least 4 of 5 trials conform with the skill, and clearly more than without it".
- **Why:** deciding after seeing the results lets you move the line. Writing it first is what makes the result believable to others.

### Step 9: Make it repeatable by anyone

- **Do:** keep each job's command or config file, the skill's commit, the agent and model names, and the results in the repository.
- **Why:** someone else can rerun the same experiment and compare.

## 5. What stays the same

- The skill, the behavior spec, and the 67 tests do not change. Harbor only changes how trials are run and recorded.
- The kill criterion from the brief (at least 80% of runs conform) still applies, per agent.
- The old experiments stay as they are, as history.

## 6. Open questions

- **Cursor traces.** Harbor's own pages disagree on whether the Cursor agent produces full traces. Step 5 answers it.
- **The agent's report.** The prompt asks each agent to list unclear instructions and guesses. We need to confirm its final reply survives in the trace.
- **How many trials.** 5 trials show a lot less than they seem to: 5 of 5 is consistent with a true pass rate well below 100%. More trials cost more. Step 5's cost decides this.
- **Which models.** Start with one model per agent, then add more once the task is stable.
- **Local paths and private details in traces.** Set aside for now.

## 7. Glossary of commands

| Command | What it does |
| --- | --- |
| `harbor run -p <task>` | Runs the task with the oracle, to check the test |
| `harbor run -p <task> -a <agent> -m <model>` | Runs one trial with a real agent |
| `-k 5` | 5 trials of each task |
| `-n 4` | 4 trials at once |
| `-o <folder>` | Where results go (default `./jobs`) |
| `--job-name <name>` | Names the job's folder |
| `--dry-run` | Prints the settings without running anything |
