# Title Desk

A small app for one job: a contract title agent files Texas title and
registration in TxDMV webDEALER for many dealerships. Every dealer is a row
of data, not a code change.

## What she can do

- **Dealers.** Type a dealer's name, DBA, P number or city: every licensed
  Texas dealer (TxDMV's own GDN list, ~20,000 licensees) comes up with its
  P number, address and county. One tap adds it. Dealers she has used sit on
  top, most recent first, for one-tap reuse. Not on the list yet? Add by hand.
- **New Sale.** One question a page: dealer → VIN (decode fills year, make,
  model, body and usually the empty weight) → color → buyer → address (the
  Census geocoder fills city, ZIP and county) → ID → price and date →
  odometer → Real Number / Rolled Over / Not Real → title kind → title state
  → lien → weights only when they could not be found.
- **A sale.** Four rows: the filled official **130-U** (Open, Print), the
  **webDEALER** copy list in webDEALER's own page order (tap a box to copy),
  what to **Bring** in upload order, and **Filed** (the webDEALER receipt
  number stops the clock).
- **Title Work.** Tiles sorted by days left on the 30-day clock (45 when the
  dealer carries the note), each with one word: Ready, Waiting (and why), Filed.
- **How To File.** Her SOP, generated from the webDEALER page order. Printable.
- English and Spanish everywhere.

Title Desk never logs into webDEALER and never stores a webDEALER password.

## Run it

```
npm install
npm run dev
```

With no environment variables, everything is saved in the browser on this
device. To sign in by email and sync across devices, create a Supabase
project, run `supabase/migrations/20261014000000_title_desk.sql` in its SQL
editor, and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Refresh the Texas dealer list

```
npm run dealers:sync
```

Downloads TxDMV's daily list of active GDN licensees
(texasdmv.my.salesforce-sites.com/dealers) into `data/tx-dealers.json`.
Only the public business record is kept: licence number, names, address,
county, status, licence type. Phones, emails and bond data are dropped.

## Checks

```
npm test          # rules: clock, weights, webDEALER order, 130-U fill, search
npm run typecheck
npm run build
```

## Sources

The 130-U filler, the webDEALER copy list and the weight, plate-class,
emissions and county rules are ported from the Triple J platform, with the
dealer made a parameter. Legal sources are cited in the code
(`src/lib/title/clock.ts`, `src/lib/vehicles/weight-boxes.ts`,
`src/lib/title/facts.ts`).
