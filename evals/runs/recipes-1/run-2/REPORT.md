I built the Sunday Table admin panel through all five steps. `panel.yaml` passes the validator, and the conformance walk found no failures: every default, project, and build check passes except eight that need you (axe, HTTPS cookie, real secrets, `git diff`, two git questions, dialogs in your browser, below).

## 1. The schema and why

**Recipe** (type "Recipes")
- **Statuses:** idea, testing, ready, retired, your four stages in order. Retiring is a status, not a delete, so retired recipes stay in the list. That rule is also the project check under `conformance:`.
- **Fields:**
 - `name`: text, required, two-thirds width. It is also the list title and what the create dialog asks for.
 - `favorite`: toggle, default off. This is how you "mark a few as favorites".
 - `photo`: image.
 - `cook`: a link to a Cook, labelled "Comes from". Not required, because some recipes may not have a clear family source.
 - `serves`, `prep_time`, `cook_time`: numbers. `serves` is at least 1; the times are at least 0, with the help text "In minutes."
 - `ingredients`: a textarea, one ingredient per line with the amount first, required. Panel has no field for a list of structured rows, so this was the closest fit.
 - `steps`: Markdown (a numbered list), required.
- **List:** cook's name as the subtitle, search on name and ingredients, ordered A to Z by name.

**Cook** (type "Cooks"): `name` (text, required), `photo` (image), and `bio` (textarea, "A sentence or two."). No status, because cooks have no stages.

**About** (a singleton, one page): `title` (text, required) and `body` (Markdown).

**Choices your request left open:**
- **Sign-in:** one shared password, set in the environment; the user shows as "editor".
- **Storage:** JSON files in `content/`, written through a small Node server. Photos go in `uploads/`.
- **Required fields:** name, ingredients, and steps must be filled before a recipe leaves the "idea" stage. Photo stays optional.
- **Not added:** no URL slug, no confirmation step before publishing, no autosave.

## 2. Files written and the conformance result

Everything is in `evals/runs/recipes-1/run-2/`:
- `panel.intake.yaml`, `panel.yaml`, `playground.html` (25 screens)
- `panel/index.html`, `panel/panel.config.js`, `panel/panel.js`, `panel/seed.json`
- The skill's styles, snippets, browser adapters, and server files, copied unchanged (all 20 are byte-identical to the sources)
- `start.mjs`, `package.json`, `.gitignore` (ignores `uploads/`)
- `panel/CONFORMANCE.md`, written last

**Conformance walk:**
- **Default checks:** all 8 in schema-guide §8 pass, as does the project check ("Retiring a recipe keeps it in the Recipes list.").
- **Page structure:** the template fidelity check passes on every built screen and every playground screen.
- **Behavior rules:** every rule in `behavior-spec.md` holds. Rules for features this panel doesn't have (autosave, slugs, tags, computed fields, a publish confirmation) don't apply and are marked so.
- **Hand checklists:** the password, JSON-file, and photo-upload checklists pass against the real server, including a server stop in the middle of a save.
- **Needs you:**
 - Run axe (an accessibility checker) on each screen.
 - Check the `Secure` cookie flag once the panel runs over HTTPS.
 - Set the real `PANEL_PASSWORD` and `SESSION_SECRET`.
 - Run the `git diff` check.
 - Confirm the two git choices: commit `content/`, but not `uploads/`.
 - Open and close a dialog twice in your own browser. Headless Chrome 156 drops the dialog `close` event, which the skill's `dialogs.js` waits on; a normal Chrome window passed every dialog check.

## 3. Unclear, contradictory, or missing instructions in the skill

**`build.md`**
- **Step 4:** the "positive" colour goes to the last status. That makes "retired" look positive and "ready" look like a notice, which is backwards here.
- **Step 4:** any move past the first status counts as publishing, so idea → testing already requires the publish fields. There is no way to set which fields each status requires.
- **Toast wording:** "{Singular} {status}" produces "Recipe testing".
- **Sort options:** nothing says what to offer when `list.sort` is missing or repeats the title. I offered only "Title A–Z".
- **Relation subtitle:** nothing says how a relation shows as a row subtitle. I showed the linked cook's name.
- **Types with no status:** nothing says how to hide the status button and row pill (I used `hidden`), or whether required fields block a save (I chose format checks only).
- **Delete:** a Delete action is required, but you said "we don't delete". I kept it, and retiring is the path the panel encourages.

**Other files**
- **`playground.md`:** the screen list has a "Publish confirm" screen, but no rule defines a publish confirmation; I showed the delete confirm instead. It's also unclear whether the confirm and slide-over screens repeat for each type.
- **Field types (schema-guide):** there is no repeater or structured-list field, so ingredient amounts can't be stored as separate rows.
- **`SKILL.md` vs. the brief:** `SKILL.md` says to stop after the preview; this run said to continue.
- **Intake:** the Round 3 behavior question has no unattended default.
- **Recipe "Ask" steps:** there is no unattended guidance except `build.md` step 8.
- **Test mode (`memory.js`):** the account shows "me@example.com", not "editor".
- **`dialogs.js`:** it relies only on the `close` event, which is what fails in headless Chrome.
- **Smaller points:**
 - schema-guide says to read "one similar file" from the examples (I read two).
 - `PHILOSOPHY.md` is never loaded by any step.
 - The playground's dark-mode check depends on `data-theme` or the media query, and doesn't say which.

## 4. Every guess made

All are recorded in `panel.intake.yaml` with `assumed: true`.

**Setup**
- Plain HTML and JavaScript with no build step.
- Saves go through a small server.
- The panel runs standalone, not inside another site.
- Delete is kept.
- Commit `content/` to git, but not `uploads/`.

**Recipe fields**
- Ingredients are one per line.
- Steps are written in Markdown.
- Name, ingredients, and steps are required to leave "idea".
- The cook link and the photo are optional.
- No slug.
- Ordered by name, with no `list.sort` key.
- No publish confirmation.

**About page:** a title and a body.

**Test data:** the family names and recipes in `seed.json` and the playground (Grandma Rose, Uncle Teo, Marisol, Ben) are made up.
