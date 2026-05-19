---
name: admin-feature-refactor
description: >-
  Refactors LoteoManager admin feature screens (list + dialogs) to match the
  unidades reference: default-height layout, optional filter card, separate
  dialog files, global buttons-col/button-input-label classes, lm-* form sections,
  signals, PrimeNG 21, Tailwind. Use when refactoring apps/admin/src/app/features/*,
  CRUD pages, modals, or when the user asks to align a screen with unidades patterns.
---

# Admin feature refactor (LoteoManager)

Golden reference: `apps/admin/src/app/features/unidades/` (list + `dialogs/`).

Stack: Angular 21 standalone, PrimeNG 21, Tailwind v4 (`assets/tailwind.css`), global layout SCSS (`assets/layout/_utils.scss`, `_main.scss`), PocketBase via `@loteomanager/shared-pb-client`, shared UI via `@loteomanager/shared-ui`.

**Do not** change PocketBase migrations, service business rules, or add npm deps unless the user explicitly asks.

---

## When to apply

- Refactoring a legacy Sakai CRUD page into `features/<entidad>/`
- Splitting inline `p-dialog` into `dialogs/*`
- Aligning list tables, filters, or form modals with unidades
- User says "same pattern as unidades" or "admin feature refactor"

---

## Target file layout

```
features/<entidad>/
├── <entidad>.component.ts          # list / page container
├── <entidad>.component.html
├── <entidad>.component.css         # page-only layout (filters grid, host flex)
└── dialogs/
    ├── <entidad>-form-dialog.component.ts
    ├── <entidad>-form-dialog.component.html
    ├── <entidad>-form-dialog.component.scss   # ok when many lm-* rules
    └── <entidad>-<aux>-dialog.component.*     # small secondary modals
```

Rules:

- **Never** inline `template` / `styles` in `@Component` — use `templateUrl` + `styleUrl` / `styleUrls`.
- **Dialogs always** in `dialogs/`, one concern per file.
- Page stays thin: table, filters, open/close dialogs, call services on save/delete.
- Export shared types from dialog TS (e.g. `XxxFormSavePayload`) when parent needs them.

---

## Refactor workflow

Copy checklist and tick as you go:

```
- [ ] Read reference: unidades.component.* + dialogs/unidad-form-dialog.*
- [ ] Map current feature: list fields, filters needed?, dialogs, services
- [ ] Create/move files under features/<entidad>/
- [ ] List page: default-height + table card + optional filter card
- [ ] Extract dialogs; wire inputs/outputs on parent
- [ ] TS: signals, computed filters, inject(), OnPush on dialogs
- [ ] Apply global classes (buttons-col, button-input-label)
- [ ] Form dialog: lm-* sections if create/edit is large
- [ ] Remove dead imports, empty ngOnInit, unused template props
- [ ] nx build admin && eslint on touched paths
- [ ] Manual smoke: create, edit, filters, save error, scroll
```

---

## List page (container)

### Shell

```html
<div class="default-height">
  @if (needsFilters) {
    <div class="card">...</div>
  }
  <div class="card">
    <p-toast />
    <div class="default-height__header flex justify-between items-center mb-4">...</div>
    <div class="default-height__scroll">
      <p-table [scrollable]="true" scrollHeight="flex" ... />
    </div>
  </div>
</div>
<app-*-form-dialog ... />
```

- Wrapper: `class="default-height"` on root.
- **Filters optional**: first `.card` only if the screen needs them; skip entire block if not.
- Second `.card`: title row + scrollable table.
- Dialog components **after** closing `default-height`, siblings not nested inside cards.

### Page `:host` (component CSS)

```css
:host {
  display: block;
  flex: 1 1 auto;
  min-height: 0;
}
```

Required so `layout-main:has(.default-height)` flex chain works (`_main.scss`).

### Filters (optional)

- Grid class per feature: `.<entidad>-filters` with fixed columns + `minmax(0, 1fr)` actions column.
- Last column: `.<entidad>-filters__actions` with `justify-content: flex-end`.
- Show **Limpiar** only when `hasActiveFilters()` computed is true.
- Filter state: `signal` + `computed` client-side filter (no extra PB call unless already required).
- Controls: `styleClass="w-full"`, `appendTo="body"` on overlays.
- Deep width: `.<entidad>-filters ::ng-deep .p-autocomplete, .p-select { width: 100%; }`

Reference grid: `14rem 10rem 12rem minmax(0, 1fr)` in `unidades.component.css`.

### Table header row

```html
<div class="default-height__header flex justify-between items-center mb-4">
  <h5 class="m-0">Título</h5>
  <button pButton ... label="Nuevo ..." class="p-button-success" (click)="openNew()" />
</div>
```

### Table

| Rule | Detail |
|------|--------|
| Scroll | `[scrollable]="true"` `scrollHeight="flex"` inside `default-height__scroll` |
| Data | Prefer `computed()` filtered list, e.g. `rowsFiltradas()` |
| Actions column | `<th class="buttons-col">` / `<td class="buttons-col">` (global `_utils.scss`) |
| Numeric columns | **Left-aligned** (default). Do **not** use `!text-right` on numbers/currency. Fix legacy right-align on refactor. |
| Text columns | Default alignment |
| Empty state | `pTemplate="emptymessage"`; different copy if filters active |
| Row actions | `p-button-text`, `icon` only or icon+label; always `[attr.aria-label]` |
| Inline edit | One row at a time via id signal (see `editingEstadoUnidadId` in unidades) |

Global class name is **`buttons-col`** (plural), defined in `apps/admin/src/assets/layout/_utils.scss`.

### Tailwind on list pages

Use utilities for flex/gap/capitalize: `flex`, `justify-between`, `items-center`, `gap-2`, `mb-4`, `m-0`, `w-full`, `w-14rem`, etc. Prefer Tailwind over PrimeFlex.

Override PrimeNG table header alignment only when necessary; for numeric left-align, **omit** `text-right` classes.

---

## Dialogs

### Small confirm / quick-create dialog

Reference: `dialogs/barrio-rapido-dialog.component.*`

- `visible = input(false)`, `visibleChange = output<boolean>()`
- `save` / `cancel` outputs; cancel closes and emits `visibleChange false`
- Minimal PrimeNG imports only

### Large create/edit dialog (form)

Reference: `dialogs/unidad-form-dialog.component.*`

**`p-dialog` settings:**

| Prop | Value |
|------|--------|
| `[style]` | `{ width: '90vw', maxWidth: '900px' }` |
| `[modal]` | `true` |
| `[draggable]` / `[resizable]` | `false` |
| `[dismissableMask]` | `false` |
| `[closable]` / `[closeOnEscape]` | `!saving()` |
| `appendTo` | `"body"` |

**Form:**

- `ChangeDetectionStrategy.OnPush`
- `FormBuilder.nonNullable.group(...)` + `ReactiveFormsModule`
- `FormsModule` only for standalone `ngModel` (extras search, autocomplete display model)
- Conditional blocks: `@if` / `@for` — not `*ngIf` / `*ngFor`
- `showError(control)`: `invalid && (dirty || touched)`
- Labels: `lm-field-label`, required: `<span class="lm-required">*</span>`
- Errors: `lm-error`, hints: `lm-hint`
- Grids: `grid grid-cols-1 lg:grid-cols-3 gap-4`
- Toggles: `p-toggleSwitch` inside `lm-toggle-row` (not checkbox)
- Footer sticky pattern: `lm-dialog-footer` + hint when `form.invalid && form.touched`

**Section anatomy:**

```html
<section class="lm-section">
  <header class="lm-section-header">
    <span class="lm-section-header-title">
      <i class="pi pi-*" aria-hidden="true"></i>
      SECCIÓN
    </span>
  </header>
  <div class="grid ...">
    <div class="lm-field">...</div>
  </div>
</section>
```

Sticky subheader + search (extras): `lm-section-header--sticky`, `lm-extras-search`.

**Label + action button** (e.g. "Nuevo barrio"):

```html
<div class="flex justify-between items-center">
  <label for="..." class="lm-field-label">...</label>
  <button pButton type="button" icon="pi pi-plus"
    class="p-button-text p-button-sm button-input-label"
    pTooltip="..." (click)="..." tabindex="-1" />
</div>
```

Global class **`button-input-label`** removes extra padding (`_utils.scss`).

**Dark mode:** `:host-context(.app-dark)` in dialog SCSS; use `var(--p-surface-*)`, `var(--p-text-muted-color)`.

**Save flow:**

- Dialog emits typed payload (`save = output<FormSavePayload>()`); parent calls service.
- `saving` signal true on submit; parent calls `stopSaving()` on error; close dialog resets via `visibleChange`.
- `@ViewChild(FormDialog)` only when parent must reset saving on failed HTTP.

**Reuse:**

- `lib-estado-badge`, `lm-extras-editor` / `ExtrasEditorComponent` with `[filterQuery]` when applicable
- `DefinicionesCacheService` for estados/extras — not hardcoded option lists

---

## TypeScript conventions

| Topic | Pattern |
|-------|---------|
| DI | `inject()` private services |
| List data | `entity = this.service.list()` signal from PB client |
| UI state | `signal`, `computed`, `model` for two-way child state |
| Dialog inputs | `input()`, `output()`, `model()`; `@Input` only if legacy interop |
| PrimeNG events | Import types: `AutoCompleteCompleteEvent`, etc. |
| Types | No `any`; export payload interfaces from dialog file |
| Messages | Spanish copy; `MessageService` in page `providers` |
| Lint | No empty functions; no unused imports; avoid `!` non-null assertions |

---

## `default-height` tuning

Global in `_utils.scss`:

- `--default-height-offset` (unidades uses `200px`) — raise if filter card + header consume more viewport.
- Last `.card` gets min/max height = `calc(100vh - offset)`; only `default-height__scroll` body scrolls.

Adjust offset per screen when table footer is clipped.

---

## Anti-patterns (remove on refactor)

- Monolithic TS with 200+ line inline template
- `*ngIf` / `*ngFor` in new code
- Dialog markup inside list `.component.html`
- `p-tabView` for long forms when section layout fits
- Checkbox for boolean flags that should be toggle rows
- Passing `tipos` / `monedas` / `estadoOpts` from parent when dialog can use cache
- PrimeFlex classes (`flex align-items-center`) in new code — use Tailwind
- Right-aligned numeric columns
- Closing modal on mask click for large forms
- Committing `.env` or `pb_data`

---

## Verification

```bash
cd loteomanager   # repo root with nx.json
npx nx build admin
npx eslint "apps/admin/src/app/features/<entidad>/**/*.{ts,html}"
```

Fix all errors in touched files. Warnings in unrelated admin files can remain unless the user wants full lint green.

---

## Additional reference

- Section/form CSS catalog and HTML snippets: [reference.md](reference.md)
- Workspace: `.cursor/rules/loteomanager-workspace.mdc`, `.cursor/rules/angular-apps.mdc`
