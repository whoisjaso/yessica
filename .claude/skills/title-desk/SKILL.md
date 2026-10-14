---
name: title-desk
description: Build and extend Title Desk, the registration app for a contract title agent (first user: the Triple J registration agent) who files Texas title and registration in TxDMV webDEALER for Triple J Auto Investment and for any other dealership. Use when asked to build, change, fix or ship the title agent's app, her dealers, her Title Work list, the New sale intake for an outside dealer, the filled 130-U, the webDEALER copy list, the Filed step, the agent's SOP ("How To File"), or the Handle A Sale SOP. Triggers: Yessica, title agent, registration agent, Title Work, title desk, webDEALER filing, file title, registration for other dealers, multi-dealer registration, SOP for Handle A Sale.
---

# Title Desk

A small app for one job: a contract title agent files title and registration
through TxDMV webDEALER for several dealerships. Triple J Auto Investment is
the first dealer on it. Every other dealer is a row of data, not a code change.

The owner's words, which are the spec:

> "I have a representative ... who does our registration, sort of as a
> contract type of ordeal, and she does multiple other's registration. I want
> to build her something ... really simple and easy to use that could save her
> a lot of time as she's doing these paperworks."
>
> "this is an application just for her to fulfill not only Triple J, but any
> type of dealership."

She is already an associated user on each dealer's own webDEALER account (she
files under the dealer's GDN with her own webDEALER user). Title Desk never
logs into webDEALER, never stores her webDEALER password, and never scrapes or
automates webDEALER: writing into webDEALER directly needs TxDMV's approved
vendor "Web Service Access" arrangement (see the header of
`src/lib/sales/webdealer.ts`). Title Desk gets everything ready so her time in
webDEALER is copy, paste, submit.

## Where it lives

Build it inside this repo (thetriplejauto) under its own route group,
`src/app/title/**`, with its library in `src/lib/title-desk/**`. Reasons: the
130-U fill, the webDEALER copy list, VIN decode, weights, plain-words gate,
roles and Playwright harness already exist and are tested here; one deploy;
Triple J's sales reach her list with no sync. Keep the boundary clean (Title
Desk imports from shared libs; nothing in Handle A Sale imports from Title
Desk) so it can be lifted into its own repo later. Do not change Handle A
Sale's behaviour for Triple J.

## The product in five lines

1. **Dealers.** Tiles: dealer name and how many to file. One dealer goes
   straight to its list. "Add dealer" is three one-blank pages: name, GDN,
   address (street lookup fills city, ZIP; county from city).
2. **Title Work.** One heading, one line ("4 to file"), tiles sorted by days
   left on the 30-day clock. A tile is: buyer, car, days left as a figure with
   a calendar glyph, one copper word: **Ready**, **Waiting** (plus the plain
   two-word reason under it: "Weights first", "Buyer signs"), **Filed**.
3. **A sale** is one page with four rows and nothing else:
   - **130-U**: the filled official form, Open and Print.
   - **webDEALER**: the copy list in webDEALER's own page order, one tap
     copies a box. Held behind "Weights first" when box 11 or 12 is blank.
   - **Bring**: what goes to the county (2290 proof over 55,000 lb, the lien,
     the fees due day).
   - **Filed**: one blank, the webDEALER receipt or transaction number. Enter
     files it. Records who and when, stops the clock, the tile turns Filed.
4. **How sales arrive.** Triple J: on their own when the Handle A Sale packet
   is signed. Any other dealer: **New**, the shortest intake that fills a
   130-U, one question a page:
   VIN (decode fills year, make, model, body, empty weight, weight band) →
   licence scan (name, address, ID) → price and sale date → odometer reading
   → Real Number / Rolled Over / Not Real → title kind tiles → lien? (if yes,
   who holds it, one blank) → weight rating off the door sticker only if the
   VIN gave a band and the body needs box 12. Everything else derives.
5. **How To File.** Her SOP, first tile on her screen, generated from the
   webDEALER page order with a picture of each step. Printable. English and
   Spanish.

Her rail shows only: Dealers, Title Work, How To File.

## Owner's standing rules (not optional)

Read `CLAUDE.md` and `docs/plans/2026-10-11-platform-blueprint.md` sections
"The experience bar", "Nothing the system can know is ever asked",
"The word budget" and "Plain words" before building.

- **Derive, never ask** what the system can know. Every question must be
  something only a person at the desk can answer.
- **One question a page.** Tiles advance on tap; no Next on a choice page.
  Enter moves to the next blank; on the last blank Enter is Next.
- **30 words a screen** (first viewport at 390x844, names and figures marked
  `data-own-content` do not count). Add every Title Desk route to `ROUTES` in
  `scripts/word-budget.mjs` with a registration-role cookie.
- **Plain words, sixth-grade level.** The owner: "think about it from the
  perspective of someone that's new and has no idea anything about the
  dealership ... a sixth grade level vocabulary." Tiles one or two words; one
  plain line of 7 words or fewer under a tile only when it is a decision a
  newcomer could get wrong. `src/__tests__/plain-words.test.ts` and its
  blocklist `src/lib/admin/plain-words.ts` must stay green; the reading grade
  over `messages/en.json` must stay at or under 6.5. Printed legal forms keep
  the law's words; screens do not.
- **Spanish twin** for every string.
- **No repetition.** One fact asked once, one function owns each rule (the
  weight gate is `weightsReady` in `src/lib/sales/weight-boxes.ts`; reuse it,
  do not copy it).
- **No PII in the repo.** No agent name beyond copy written by the owner, no
  emails, phone numbers, user names, GDNs or dealer IDs of real people or
  dealers in code, fixtures or tests. Fixtures use invented data. Her email is
  typed once on the invite page at run time.
- **Shared tree.** Codex works in the same project: `git status` first, stay
  out of `src/` files that are modified and not yours, never `reset --hard`,
  `clean -f` or force-push.

## Reuse, do not rebuild

| Need | Use |
|---|---|
| Filled official 130-U | `src/lib/fill-130u/fill-pdf.ts` (`fill130U`), `field-mapping.ts`, `from-agreement.ts` (`buildAgreementData`), `seller-name.ts`; the form is `public/forms/130-U.pdf`. For an outside dealer, feed the dealer's row where the code reads `dealership` / `DEALER`; make the dealer a parameter, never a new copy. |
| webDEALER copy list in page order | `src/lib/sales/webdealer.ts`: `HANDOFF_PAGES`, `buildHandoffFields`, `handoffPageText`, `missingHandoffFields`, plate helpers; UI `src/components/admin/WebDealerHandoff.tsx`. It reads a `SaleDetail`; for outside-dealer intake, build the same shape from the intake answers rather than forking the builder. |
| VIN decode | `src/lib/nhtsa.ts`; `src/lib/vehicles/curb-weight-lookup.ts` (`vinFacts`, `lookupCurbWeight`) |
| Box 11 / box 12 | `src/lib/sales/weight-boxes.ts` (`weightBoxes`, `weightsReady`, `gvwrRefusal`, `boxElevenPounds`); `src/lib/vehicles/gvwr.ts` (`parseGvwrBand`, `gvwrBandFromDecode`, `pickGvwr`, `gvwrFromFiled`); `src/lib/vehicles/plate-class.ts` (`needsCarryingCapacity`, `suggestPlateClass`) |
| Title kinds, county | `src/lib/vehicles/title-kinds.ts`; `src/lib/vehicles/texas-counties.ts` |
| 30-day clock | `src/lib/sales/title-deadline.ts` (`titleClock`, reminders) |
| Heavy trucks (2290, Buyers Guide cutoff) | `src/lib/sales/heavy.ts` |
| Fees-in-30-days lien, "Title comes here" | the #220 code (`feesDueOn`, `sellerAsLienholder`, `form130ULienKeys`) |
| Roles and route guard | `src/lib/admin/route-permissions.ts` (deny by default; a route-matrix test walks every `page.tsx`); `src/lib/operations/team.ts` (`registration` role, `paperwork:manage`) |
| Existing training material | `src/lib/registration/training.ts`, `/admin/dealership/registration-training`, `public/registration-training/*` (fold the useful parts into How To File; do not keep two SOPs) |
| Tiles, sheets, copy boxes | `TapSheet`, `CopyBox`, `GlyphTile`, `SheetTile` (see PRs #205, #209) |
| Licence scan | the buyer intake's existing licence scan in Start A Sale |

## Data (add-only migration; the owner applies migrations by hand)

`supabase/migrations/<timestamp>_title_desk.sql`:
- `title_dealers`: id, name, dba, gdn, street, city, state, zip, county,
  created_at. Seed Triple J from the app's dealership config at runtime or by
  a one-line insert the owner runs; do not hard-code the GDN in the migration.
- `title_agent_dealers`: agent user id ↔ dealer id.
- `title_sales`: one row per sale on her list. For Triple J, a link to the
  deal (the deal stays the source of truth, the row is a projection); for an
  outside dealer, the intake answers as JSON plus derived columns. Columns:
  dealer_id, deal_id nullable, sale_date, due_on, status, buyer_name, car,
  intake jsonb, filed_number, filed_by, filed_at.
- Never drop, update in bulk, or rewrite rows. Row-level security: an agent
  sees only her dealers' rows. Say in the PR exactly what the owner runs.

## Legal facts to respect (cite them in code and the PR)

- Dealer must apply for title and registration within 30 days of sale
  (Tex. Transp. Code §501.0234(a); 45 days when seller-financed). The tile's
  days-left counts to that day.
- Since 1 July 2025 dealers file title and registration electronically in
  webDEALER (TxDMV). An agent files under the dealer's account with her own
  user.
- 130-U box 11 empty weight rounded up to the next 100 lb; box 12 carrying
  capacity = GVWR − empty weight (TxDMV Vehicle Weight Verification
  Guidelines). Cars do not need box 12; `needsCarryingCapacity` decides.
- Odometer statement meanings: 49 CFR 580.5(e). Screens say Real Number /
  Rolled Over / Not Real; the form prints the federal wording.
- Heavy Vehicle Use Tax proof (Form 2290) at 55,000 lb and up (26 U.S.C.
  §4481; 43 TAC §217.31).
- Do not invent fees or rates. Anything not in statute or the dealer's own
  record is asked once or left out and listed as a question.

## Build order

1. Data and roles: migration, RLS, `registration` role scoped to `/title/**`
   and the two PDF/handoff readers; route-guard test listing her allowed
   routes by syntax; a test that every other route denies her.
2. Title Work for Triple J (deals already exist): list, sale page, Filed.
3. Dealers and Add dealer.
4. New intake for an outside dealer, producing the same sale page.
5. How To File, generated from `HANDOFF_PAGES` with pictures
   (`scripts/title-desk-shots.mjs` writes `public/title-desk/<page>.png`;
   a test fails if a page has no picture or a picture has no page).
6. Invite: a one-blank page (email) that sends the existing sign-in link with
   role `registration`.

## Also wanted: the Handle A Sale SOP

The owner asked in the same breath for "a Sale SOP for this handle a sale, and
templates section". Build it the same way so it cannot go stale:
`src/lib/sales/sop.ts` reads `src/lib/sales/guide.ts` and produces one step
per page the desk sees (plain heading, one sentence of 12 words or fewer, what
fills itself, which paper it makes); a test fails when a guide step has no SOP
step or an SOP step has no guide step. Screen `/admin/templates/sop`
("How To Sell A Car"), first row of Templates and a tile on Start Here, path
filter tiles (Cash / Our note / Business / Co-buyer), a picture per step, a
Print view, and a generated `docs/SOP-sale.md`.

## Done means

Follow `CLAUDE.md` exactly:
- Full `npx vitest run` green, `npx tsc --noEmit`, eslint on changed files,
  `next build` (node_modules is a symlink in worktrees: build on a hard-linked
  copy and restore the symlink; cap the heap with
  `NODE_OPTIONS=--max-old-space-size=3072`).
- Word budget green on one clean run: dev server `LOCAL_ADMIN_PREVIEW=true
  npx next dev --webpack -p <port>`, warm routes with curl first, then
  `WORD_BUDGET=1 BASE=http://localhost:<port> npx vitest run src/__tests__/word-budget.test.ts`.
- Playwright at 390x844 and 1440x900 of every new screen, after stopping the
  dev server, `rm -rf .next` and restarting, with one computed-style assertion
  that throws before each screenshot. Show the owner the screenshots.
- Ship: PR, merge to `main`, confirm the Vercel production deploy is READY.
  The Vercel free plan caps deployments at 100 a day; push at most twice per
  branch, and if production is capped, create the deployment from the Vercel
  API when the window rolls over and confirm it.
- Tell the owner in plain words what she can now do, and name anything he
  must do by hand (the migration, inviting her).

## Questions to put to the owner, not to guess

- Does she file for dealers that are not on this platform today, and how many
  (sizes the New intake)?
- Should a dealer see her progress on their sales (a read-only link), or is
  the app hers alone?
- Who pays for it, and does she bill dealers per title (a per-title count by
  dealer by month is cheap to add later)?
