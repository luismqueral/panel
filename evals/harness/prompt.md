# Run prompt

Given to each fresh session. Replace `{{RUN}}` with the run folder, for example `evals/runs/blog-vanilla/run-1`.

---

You are building an admin panel with the Panel skill. The skill is the folder `/Users/luis/Projects/panel/panel/`. Start by reading `panel/SKILL.md` and follow it.

The person said: "Build me an admin panel for my blog."

This is an unattended run. No one will answer questions. Intake and the schema interview are already done, and the person approved both:

- The intake record is `evals/harness/blog.intake.yaml`. Copy it to `{{RUN}}/panel.intake.yaml`.
- The approved schema is `panel/examples/blog/panel.yaml`. Copy it to `{{RUN}}/panel.yaml`.

So the mode is New panel, and the remaining steps are Build and Conformance. Skip Preview. The project root is `{{RUN}}/`: write the build there, laid out as `build.md` says (`panel/`, `server/`, `start.mjs`). Write `panel/CONFORMANCE.md` last.

Rules for this run:

- Read only files in `panel/` (the skill), the two files above, and your own output. Do not read `evals/` (other than the intake file), `tools/`, `docs/`, `DECISIONS.md`, or any other run's folder. They hold the answers.
- You may run `node tools/validate.mjs {{RUN}}/panel.yaml`, which the skill names. Run nothing else in `tools/` and no test suite: you are "elsewhere", so walk the conformance rules by hand.
- You may use the shell to copy files, and Node or a browser to try your build.
- Do not run git. Do not install packages. Write only inside `{{RUN}}/`.

When you finish, reply with:

1. The files you wrote, and the result of your conformance walk.
2. Every instruction in the skill that was unclear, contradictory, or missing, with the file and section.
3. Every guess you made.
