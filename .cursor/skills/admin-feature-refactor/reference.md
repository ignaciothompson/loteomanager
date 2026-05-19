# Admin feature refactor — reference snippets

Source of truth: `apps/admin/src/app/features/unidades/`.

---

## Global layout classes (`assets/layout/_utils.scss`)

| Class | Use |
|-------|-----|
| `.card` | White/surface panel, padding, radius |
| `.default-height` | Flex column; filter card + fixed-viewport table card |
| `.default-height__header` | Non-scrolling title/toolbar row |
| `.default-height__scroll` | Table scrollport |
| `.buttons-col` | Actions column: `text-align: right`, `width: 110px` on `th`/`td` |
| `.button-input-label` | Icon button flush with field label (`padding: 0`) |

---

## Filter card template

```html
<div class="card">
  <div class="<entidad>-filters">
    <!-- p-autocomplete / p-select columns -->
    <div class="<entidad>-filters__actions">
      @if (hasActiveFilters()) {
        <button pButton type="button" label="Limpiar" icon="pi pi-filter-slash"
          class="p-button-text" (click)="clearFilters()" />
      }
    </div>
  </div>
</div>
```

```css
.<entidad>-filters {
  display: grid;
  grid-template-columns: 14rem 10rem 12rem minmax(0, 1fr);
  gap: 0.75rem;
  align-items: end;
}
.<entidad>-filters__actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}
```

---

## Table actions column

```html
<ng-template pTemplate="header">
  <tr>
    <th>Nombre</th>
    <th>Cantidad</th>   <!-- numeric: no text-right -->
    <th class="buttons-col"></th>
  </tr>
</ng-template>
<ng-template pTemplate="body" let-row>
  <tr>
    <td>{{ row.nombre }}</td>
    <td>{{ row.cantidad }}</td>
    <td class="buttons-col">
      <button pButton type="button" icon="pi pi-pencil"
        class="p-button-secondary p-button-text mr-2"
        [attr.aria-label]="'Editar'" (click)="edit(row)" />
      <button pButton type="button" icon="pi pi-trash"
        class="p-button-danger p-button-text"
        [attr.aria-label]="'Eliminar'" (click)="delete(row)" />
    </td>
  </tr>
</ng-template>
```

---

## Parent ↔ form dialog wiring

```html
<app-unidad-form-dialog
  [visible]="displayDialog()"
  (visibleChange)="displayDialog.set($event)"
  [isEdit]="isEdit()"
  [currentUnidad]="currentUnidad"
  [barrios]="barrios()"
  [(extras)]="extrasModel"
  (save)="onUnidadFormSave($event)"
  (cancel)="displayDialog.set(false)"
  (newBarrio)="openNewBarrio()"
/>
```

```typescript
@ViewChild(UnidadFormDialogComponent)
private formDialog?: UnidadFormDialogComponent;

async onUnidadFormSave(event: UnidadFormSavePayload) {
  try {
    const body = { ...event.unidad, extras: sanitizeExtrasPayload(event.extras) } as Partial<UnidadesResponse>;
    // merge files if needed
    if (this.isEdit()) await this.service.update(this.currentId, body);
    else await this.service.create(body);
    this.displayDialog.set(false);
    this.list = this.service.list(); // refresh signal
  } catch (err) {
    this.formDialog?.stopSaving();
    // toast error
  }
}
```

---

## `lm-*` form classes (dialog SCSS)

| Class | Role |
|-------|------|
| `lm-dialog-body` | Scrollable body `max-height: calc(100vh - 12rem)` |
| `lm-section` | Bordered section block |
| `lm-section-header` | Uppercase section title row |
| `lm-section-header--sticky` | Sticky header inside scroll (extras + search) |
| `lm-field` | Field stack (label + control + messages) |
| `lm-field-label` | Label typography |
| `lm-required` | Red asterisk |
| `lm-error` / `lm-hint` | Validation / help text |
| `lm-toggle-row` | Toggle with label + description |
| `lm-dialog-footer` | Sticky footer actions |
| `lm-footer-hint` | "Revisá los campos marcados" |
| `lm-estado-dot` | Colored dot in estado `p-select` templates |

Copy SCSS from `unidad-form-dialog.component.scss` when starting a new large form; trim unused rules.

---

## Estado select with color dot

```html
<ng-template let-estado #item>
  <div class="flex items-center gap-2">
    <span class="lm-estado-dot" [style.background-color]="estado.color"></span>
    <span>{{ estado.nombre }}</span>
  </div>
</ng-template>
```

Options from `definicionesCache.estadosActivosPara('<entidad>')`.

---

## Inline table edit (single row)

```typescript
editingRowId = signal<string | null>(null);
isEditingRow = (id: string) => this.editingRowId() === id;
startInlineEdit = (id: string) => this.editingRowId.set(id);
cancelInlineEdit = () => this.editingRowId.set(null);
```

Template: `@if (!isEditingRow(row.id)) { display } @else { p-select + cancel button }`.

---

## Commit message (suggested)

```
refactor(<feature>): align <screen> with admin list/dialog patterns
```
