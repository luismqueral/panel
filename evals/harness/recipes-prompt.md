# Run prompt: recipe site, from a person's request

Given to each fresh session. Replace `{{RUN}}` with the run folder, for example `../panel-evals/runs/recipes-1/run-1` (see `paths.mjs`). Unlike `prompt.md`, the session gets no schema or intake record: it designs the schema from the request, then builds the panel from that schema.

---

You are building an admin panel with the Panel skill. The skill is the folder `/Users/luis/Projects/panel/panel/`. Start by reading `panel/SKILL.md` and follow it.

The person said:

> I run a small family recipe site called Sunday Table, and I want an admin panel for it. It's a brand-new project, nothing built yet.
>
> Recipes go through stages: an idea someone suggests, then we test it in the kitchen, then it's ready to go on the site, and eventually some get retired. We keep retired ones, we don't delete them.
>
> Each recipe has a name, a photo, how many people it serves, prep time and cook time in minutes, the ingredients with their amounts, the steps, and which family member it comes from. We'd like to mark a few as favorites.
>
> We also keep a list of the family cooks, each with a short bio and a photo. And there's one About page.
>
> My sister and I both edit it. We'd rather share one password than set up accounts. Just keep everything in simple files on the computer.

This is an unattended run. No one will answer questions. Wherever the skill would ask the person, choose the recommended option, record it under `open_questions` with `assumed: true`, and continue. Wherever it would wait for approval, treat the step as approved and continue.

Run every step of the New panel mode: Intake, Schema, Preview, Build, and Conformance. The project root is `{{RUN}}/`. Write, in this order:

1. `{{RUN}}/panel.intake.yaml`, the intake record.
2. `{{RUN}}/panel.yaml`, the schema. It must pass `node tools/validate.mjs {{RUN}}/panel.yaml`.
3. `{{RUN}}/playground.html`, the preview.
4. The build, laid out as `build.md` says, with `panel/CONFORMANCE.md` last.

Rules for this run:

- Read only files in `panel/` (the skill) and your own output. Do not read `evals/`, `tools/`, `docs/`, `DECISIONS.md`, or anything in `../panel-evals/` but your own folder. They hold the answers.
- You may run `node tools/validate.mjs`, which the skill names. Run nothing else in `tools/` and no test suite: you are "elsewhere", so walk the conformance rules by hand.
- You may use the shell to copy files, and Node or a browser to try your build. Use free ports you have checked, and stop only the processes you started.
- Do not run git. Do not install packages. Write only inside `{{RUN}}/`.

When you finish, reply with:

1. The schema you designed, and why: each type, singleton, and field, and each choice the request left open.
2. The files you wrote, and the result of your conformance walk.
3. Every instruction in the skill that was unclear, contradictory, or missing, with the file and section.
4. Every guess you made.
