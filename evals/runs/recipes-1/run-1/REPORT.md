I built the Sunday Table panel through all five steps. The schema passes `node tools/validate.mjs`. My hand-run conformance walk found no failures: every check passed or doesn't apply, except nine items only the person can do, listed below.

## 1. The schema and why

**Adapters**
- **Login** uses `password`, with `password_env: PANEL_PASSWORD`, because the request says "share one password rather than set up accounts".
- **Data** uses `json-files` at `./content`, written by the small Node server.
- **Files** uses `local-disk` at `./uploads`, served from `/uploads`. Both follow "simple files on the computer", and the server is what intake recommends when there's a login.

**Type `recipe` ("Recipes")**
- **Statuses** are `idea → testing → ready → retired`, in the person's words. Retired recipes are kept as a status, not deleted.
- **List:** each row shows the name and the cook. Rows sort by name, and search covers the name.
- **Fields:**
 - `name`: text, required.
 - `photo`: image.
 - `serves`: number, 1 to 100.
 - `prep_time` and `cook_time`: numbers in minutes, at least 0. These three sit side by side, a third of the width each.
 - `ingredients`: a `custom` field, required. Each row has an amount and an ingredient, stored as `{amount, ingredient}`. No built-in field holds paired values. "Add ingredient" adds a row; clearing a row removes it.
 - `steps`: textarea, required, one step per line.
 - `cook`: relation to `cook`, labeled "From". The request says which family member a recipe comes from, and the cooks list exists.
 - `favorite`: toggle, default false.
- **Required fields** are only the name, ingredients, and steps. That way an idea can be saved with just a name, but it needs ingredients and steps before it moves to testing.

**Type `cook` ("Cooks")** has no statuses. Fields: `name` (required), `photo`, and `bio` (a short textarea).

**Singleton `about`** has `title` (required) and `body` (markdown).

**Choices the request left open**
- The photo is optional, so a recipe can reach "ready" without one.
- There is no slug.
- The About page has no photo.
- There's no autosave and no confirmation before publishing.
- Delete stays on recipes, for mistakes.

## 2. Files written, and the conformance result

- `panel.intake.yaml`
- `panel.yaml`
- `playground.html` (25 screens)
- `package.json`, `.gitignore` (ignores `uploads/`), and `start.mjs`
- `server/`: the seven recipe server files, copied unchanged.
- `panel/`:
 - `index.html`, `panel.config.js`, `panel.js`, `seed.json`
 - `styles/`, `snippets/`, and `adapters/`, copied unchanged.
 - `CONFORMANCE.md`, written last.

**What I checked**
- **Schema checks:** all eight pass.
- **Template fidelity:** every template on every build screen matched its source, and so did all 25 playground screens.
- **Width:** no sideways scroll at 400px, in light or dark.
- **Behavior rules:** I drove them in a browser against the test adapters. Every applicable rule passed. The rules for autosave, slugs, tags, computed fields, and publish confirmation don't apply to this schema.
- **Real server:** I ran it with throwaway credentials. Login, the cookie flags, create, upload, reload, the About page, and logout all worked, and bad fields, bad statuses, and writes without the `x-panel` header were refused.

**Fixed along the way:** the relation control reports `""` when no cook is chosen, but the data contract says `null`. `panel.js` now converts it.

**Needs the person:**
- Set `PANEL_PASSWORD` and `SESSION_SECRET` on the computer before running `node start.mjs`.
- Tab through each screen and look for a focus ring at every stop.
- Run axe.
- Check `git diff` after an edit (git was off-limits here).
- Stop the server mid-save and confirm the file on disk is the old version.
- Confirm content goes in git (assumed yes) and uploads don't (assumed no).

## 3. Unclear, contradictory, or missing instructions

1. **`build.md` step 4, the status tone:** the last status is always `positive`. Here that makes "Retired" green and "Ready" amber. There's no way to mark which status is the live one.
2. **`build.md` step 4, sort options:** when `list.sort` is the title field, "Title A–Z" repeats "Name, ascending". I left the duplicate out.
3. **`behavior-spec.md` V3, V4, V7, V8:** nothing says what blocks saving an item in a type without statuses. I treated cooks like a singleton, so an empty required name blocks the save.
4. **`playground.md` Rule 2:** the `confirm` screen is labeled "Publish confirm" even when nothing asks before publishing. I filled it as the delete confirm and labeled it "Delete confirm".
5. **`snippets/fields.js`:** the `custom` control is always a read-only computed box. There's no pattern for an editable custom field, so I wrote my own in `panel.js`.
6. **`build.md` "What you produce" and step 4:** the item screen always has Delete. The skill doesn't say how to handle "we don't delete them".
7. **`playground.md` Rule 2:** it doesn't say where `confirm` and `slide-over` go when there are two types. I put them after both types' screens.
8. **`intake.md` Rule 6:** the record's `open_questions` shows only assumed answers. It doesn't say whether to record answers taken straight from the request.
9. **Proposal:** the skill says to write one for anything Panel lacks, but this one is only here in my reply, not in a file. It's for a repeating-rows field type. The person asked for "ingredients with their amounts". `custom` can hold the data, but there's no template for rows. The smallest addition would be a `rows` field type that names its sub-fields.

## 4. Guesses

- **Intake answers:** the vanilla flavor, a standalone page, writes through the server, no extra behaviors, content in git, and uploads not in git.
- **Recipes:** Delete stays. A recipe's list row shows the cook's name.
- **Fields:**
 - Only the name, ingredients, and steps are required, and the photo is optional.
 - Serves runs from 1 to 100.
 - Steps are plain text, one step per line.
 - The About page has only a title and a body.
- **Ingredients editor:** a row is removed by clearing it, because the grid has no room for a remove button. Below 40rem wide, the two boxes in each row stack.
- **Playground:** all the fake recipe and cook data is invented. The edited fields are serves for a recipe and the bio for a cook.

To build and check, I used throwaway generator and test pages, which I deleted afterwards, along with the test content. I also wrote one scratch file to `/tmp`, outside the run folder, and deleted it.
