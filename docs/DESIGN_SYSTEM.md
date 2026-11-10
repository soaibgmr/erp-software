# Automobile.In ERP — Design System v2

> Navy carries structure, yellow marks where you are and the one action that matters on a screen. Everything else is neutral, dense and quiet so the data reads first.

Source: *Design system@1x.png* and the screen designs (Dashboard, POS billing, New job card, Invoice A4, Sidebar, Top bar, States). Implement these as CSS variables in `ui/src/styles/tokens.css` and map them into the Tailwind theme. Components must not use raw hex values.

---

## 1. Color tokens

### Brand

| Token | Hex | Use |
|---|---|---|
| `--navy-900` | `#0B1F3A` | Sidebar, headings, invoice total bar, toast background |
| `--navy-700` | `#1A3A6B` | Primary buttons, selected chips/segments |
| `--navy-600` | `#2A5191` | Focus ring, links, today's bar in charts |
| `--navy-50` | `#F3F6FB` | Row hover, table header background |
| `--yellow-500` | `#F5B800` | Accent / CTA — the single money action (Charge, Collect payment), logo tile, labour series |
| `--yellow-400` | `#FFC929` | Active item text/icon on navy (sidebar) |
| `--yellow-100` | `#FFF1C2` | Highlight, warning callout background |
| `--yellow-700` | `#8A5A00` | Text on yellow tint |

### Neutrals

| Token | Hex | Use |
|---|---|---|
| `--ink` | `#0F1B2D` | Body text |
| `--slate` | `#4A5A70` | Secondary text, labels, table headers |
| `--border` | `#DDE3EC` | Card borders, dividers, inputs |
| `--canvas` | `#F4F6FA` | App background |
| `--surface` | `#FFFFFF` | Cards, inputs, modals |

### Status

| Token | Hex | Use |
|---|---|---|
| `--success` | `#15803D` | Paid, in stock, returning customer |
| `--warning` | `#B45309` | Due, low stock (*Only 2 left*) |
| `--danger` | `#B91C1C` | Overdue, errors, destructive actions, out of stock |
| `--info` | `#1D4ED8` | In service |

Badges use a light tint of the status colour as background and the status colour for text and dot.

## 2. Typography — Inter

| Style | Size / line | Weight | Use |
|---|---|---|---|
| Page title | 24 / 32 | 700, −0.01em | *Dashboard*, *New job card* |
| Section heading | 18 / 26 | 600 | Card groups |
| Card title | 16 / 24 | 600 | *Vehicle & customer*, *Summary* |
| Body / table | 14 / 20 | 400 | Default text, table cells |
| Secondary / helper | 13 / 20 | 400 | Sub-text, hints, helper text |
| Table header / overline | 12 / 16 | 600, +0.04em, uppercase | `INVOICE`, `CUSTOMER`, `SALES` |
| KPI | 28 / 34 | 700, tabular | `₹2,48,560` |

Numbers are tabular (`font-variant-numeric: tabular-nums`) and right-aligned in tables.

## 3. Spacing, radius, elevation

- **Spacing scale (4 px base):** 4, 8, 12, 16, 24, 32, 48.
- **Page padding:** 24 px. **Card padding:** 20–24 px. **Grid gap:** 16–24 px.
- **Radius:** 6 px inputs/buttons · 10 px cards · 14 px modals. Chips and badges are pills.
- **Elevation:** cards use a 1 px `--border`, **no shadow**. Only menus and modals have a shadow.
- **Icons:** lucide, 18 px, 2 px stroke, one set across the app.

## 4. Buttons

| Variant | Look | Use |
|---|---|---|
| Primary | Navy 700 fill, white text | Save (*Save customer*, *Create job card*). One primary per view. |
| Accent | Yellow 500 fill, navy text | The single money action (*Charge ₹4,718*). |
| Outline | White, border, navy text | Secondary (*Export*, *Save draft*, *Add part*). |
| Ghost | No border, navy text | Cancel. |
| Danger | Danger fill, white text | *Delete*, *Cancel invoice* (confirm step). |
| Icon | Outline square | Overflow `⋯`, bell. |

Sizes: **Small 32**, **Default 40**, **Large 48** (POS Charge). States: hover, focus (navy-600 ring), disabled (grey fill, muted text), loading (spinner + *Saving…*, width preserved).

## 5. Status badges

| Badge | Tone |
|---|---|
| Paid | success |
| Partially paid | warning |
| Overdue | danger |
| Draft | neutral (slate) |
| In service | info |
| Ready for delivery | success (teal-green) |
| Low stock | warning (yellow tint) |

Pill, 12–13 px text, leading dot.

## 6. Form fields

- Label above the field, 6 px gap; 16 px between rows. Required marker `*` in danger.
- Two columns on desktop, one column below 640 px.
- Height 40 px; 6 px radius; 1 px border; focus = navy ring.
- Helper text 13 px slate below the field. **Errors replace helper text** (danger border + message, e.g. *Enter a 10-digit mobile number*) and never shift layout.
- Inline suffix for units (`km`), right-aligned numbers for amounts and odometer.
- Segmented control (fuel level E ¼ ½ ¾ F; Today / 7 days / 30 days) and selectable chips (service types, POS categories): selected = navy fill, white text.

## 7. Dropdown menu & modal

- **Menu:** 36 px rows, 8 px radius, hover row in navy-50, destructive item last, in danger, after a divider (*View invoice · Print · Send on WhatsApp — Cancel invoice*).
- **Modal:** max 480 px, 14 px radius, title as a question (*Cancel invoice INV-24-01873?*), body states the consequence (*Stock for 3 items will be returned to inventory. This can't be undone.*), verb-labelled buttons, destructive action on the right (*Keep invoice* · **Cancel invoice**).

## 8. Layout components

### Sidebar (248 px, navy-900)
- Header: yellow logo tile + *Automobile.In* + branch (*Kochi · Main branch*).
- Groups with overline labels: **Sales** (Dashboard, POS billing `F2`, Invoices, Customers) · **Stock** (Inventory, Purchases, Suppliers) · **Admin** (Reports, Settings).
- Active item: subtle lighter navy background, yellow-400 icon and text. Count badge: navy pill.
- Footer user card: avatar initials, name, role · shift.

### Top bar (64 px, white, bottom border)
- Search field (*Search invoices, parts, vehicle no…*) with `Ctrl K` hint.
- Right: **New bill** (primary, plus icon), bell with yellow unread dot, avatar (yellow initials on navy) with chevron menu.

### POS header (navy-900, full width)
- *‹ Exit POS* · logo · *POS billing · Counter 1 · Anil Nair* · right side: *Shift opened 9:00 AM*, key hints `F3 Search`, `F8 Hold`, `F12 Charge`.

### Cards
- KPI card: label, optional tone badge top-right (*+12%*, *3 delayed*), KPI value, 13 px sub-text.
- Data card: title row with right-aligned link (*View board*, *All invoices*) or count badge.

### Tables
- Header row: overline style, navy-50 background on documents; body rows 48–56 px with 1 px dividers; primary column as navy link (invoice number) with secondary line beneath.

## 9. States

| State | Pattern |
|---|---|
| Empty (first use) | Centered icon in a navy-50 tile, title (*No job cards yet*), one-line explanation, one primary action (*New job card*). |
| Loading | Skeleton rows at real row height so nothing jumps; spinners only inside buttons. |
| Error (failed to load) | Danger-tint banner: icon, title (*Couldn't load stock levels*), explanation with last sync time, **Try again** (danger) + *View cached data* (outline). |
| No search results | Title quoting the query (*No parts match "brake pad swift 2019"*), a hint, *Clear filters*. |
| Success toast | Navy-900 bar, yellow check, message (*Invoice INV-24-01874 saved*), yellow action (*Print*). |

## 10. Charts

- Sales chart: stacked bars, **Parts = navy-700**, **Labour = yellow-500**, today's bar in navy-600; light gridlines; legend top-right; axis labels 12 px slate.
- Proportion bar (Workshop today): segments slate (waiting), navy-700 (in service), navy-600 (quality check), yellow-500 (ready).

## 11. Print — Tax invoice (A4)

- Yellow 4 px top rule; logo tile + business block left; *TAX INVOICE / Original for recipient* right.
- Three-column bordered info box: Bill to · Vehicle · Invoice meta (no., date, job card, place of supply).
- Line table with navy-50 header and ink top rule; bold taxable value column.
- Left: amount in words, payment details, *Next service due* chip. Right: taxable value, CGST, SGST, round off, **Total** in a navy-900 bar with white text, Paid, Balance due.
- Footer: terms, customer signature, *For [Business name]*, *Thank you for your business.*, *Computer-generated invoice · Page 1 of 1*.

## 12. Rules of thumb

1. One primary action per view; yellow only for the money action and "you are here".
2. Cards: 1 px border, no shadow.
3. Numbers tabular and right-aligned; ₹ with Indian grouping.
4. Labels above fields; errors replace helper text.
5. Destructive actions last, in red, behind a question-titled modal.
6. Every data view designs its empty, loading, error and no-results states.
