# Tarea: Páginas públicas de Comparativas — LoteoManager

Sos el agente principal encargado de implementar las **páginas públicas de Comparativas** (propuesta individual y comparación múltiple). Estas son las primeras páginas que ven los CLIENTES FINALES del cliente (los prospectos inmobiliarios), no el admin. La calidad visual y de UX son críticas.

## Contexto del estado actual

- **Stack:** Angular 21 + PrimeNG 21 + Sakai-NG (admin) + PocketBase v0.23.
- **Monorepo Nx** con `apps/admin` y `apps/landing`.
- **`apps/landing`** tiene SSR habilitado, scaffolding básico, server routes vacías de placeholders.
- **Backend listo:**
  - Tabla `comparativas` con `tipo`, `token_publico`, `unidades_ids` (multi-relation), `cliente_destinatario_nombre/email`, `expira_en`, `contenido_snapshot` (JSON con datos congelados al momento de creación), `vistas_count`, `pdf_generado` (file nullable).
  - Tabla `comparativa_vistas` para tracking.
  - Tabla `config` (singleton) con `mensaje_bienvenida_landing` y otros settings globales.
  - Tabla `interesados` con campo `comparativa_id` para vincular leads provenientes de comparativas.
- **Sakai en `apps/admin`:** sistema de tema claro/oscuro via `LayoutService` + variables CSS. **NO usar el layout de Sakai en la landing**, solo reutilizar los tokens de diseño y la lógica de tema.

## Alcance de esta tarea

### Incluye

1. **Página pública de comparativa:** ruta `/c/:token` en `apps/landing`. Detecta el tipo (individual o múltiple) y renderiza el layout correspondiente.
2. **Página de expiración/invalidez** para tokens vencidos o inexistentes.
3. **Componente "Propuesta Individual":** stack vertical responsive con imagen hero → datos → mapa → plano → galería → CTA contacto.
4. **Componente "Comparación Múltiple":** cards sticky arriba con imagen+precio, tabla comparativa detallada abajo.
5. **Botón flotante "Contactar"** que abre modal con form (Turnstile + honeypot).
6. **Server route `/api/leads/from-comparativa`** que valida y guarda el lead en `interesados` con `comparativa_id` y `origen='comparativa'`.
7. **Server route `/api/comparativas/:token/pdf`** que genera PDF on-demand con Playwright, lo cachea en `comparativas.pdf_generado`, y lo devuelve.
8. **Tracking de vistas:** cada acceso a la página crea un registro en `comparativa_vistas` con IP hasheada y user-agent.
9. **Branding configurable** leído de `config` (logo + nombre).
10. **Sistema de tema claro/oscuro** con detección automática + toggle visible.
11. **Page metadata** (Open Graph, Twitter Card) para que el link compartido en WhatsApp/email muestre preview rico.
12. **Sin sidebar admin, sin topbar admin** — la landing es independiente visualmente.

### NO incluye

- Página de búsqueda de unidades disponibles (eso es la Landing propiamente dicha, fase posterior).
- Home de la inmobiliaria (link "Esta propuesta expiró" apunta a placeholder).
- Optimización avanzada de imágenes (WebP, lazy loading) — usar comportamiento default de Angular.
- E2E tests automatizados — smoke tests manuales alcanzan.

---

## Arquitectura visual

### Stack tecnológico de la landing pública

- **Angular 21 SSR** (ya configurado).
- **Tailwind CSS** (preset compartido del monorepo).
- **PrimeNG**: solo componentes específicos necesarios (Dialog, Toast, Button, InputText, Textarea). **NO importar el theme completo de Sakai**, solo los CSS de componentes individuales.
- **Leaflet** + tiles de CARTO Voyager para mapas.
- **PrimeIcons** para iconografía (consistencia con admin).
- **NO usar:** AppLayout, AppTopbar, AppSidebar de Sakai. La landing tiene layout propio.

### Sistema de tema claro/oscuro

Crear `apps/landing/src/app/services/theme.service.ts`:

```typescript
@Injectable({ providedIn: 'root' })
export class ThemeService {
  // 1. Lee preferencia del visitante: localStorage > prefers-color-scheme > default light
  // 2. Aplica clase 'dark' al <html>
  // 3. Expone signal `currentTheme` y método `toggle()`
  // 4. Sincroniza con localStorage al cambiar
}
```

Las variables CSS deben **coincidir con las que usa Sakai** para consistencia visual:

```css
/* En apps/landing/src/styles.scss */
:root {
  --surface-0: #ffffff;
  --surface-50: #f8fafc;
  /* etc. */
  --text-color: #0f172a;
  --primary: #6366f1;
}

.dark {
  --surface-0: #0f172a;
  --surface-50: #1e293b;
  /* etc. */
  --text-color: #f1f5f9;
}
```

Toggle visible en el topbar minimalista de la landing (esquina superior derecha, icono sol/luna).

### Topbar minimalista de la landing

Crear `apps/landing/src/app/layout/landing-topbar/`:

- Logo (de `config.logo`) + nombre (de `config.nombre_inmobiliaria`) a la izquierda.
- Toggle de tema a la derecha.
- **Sin menú de navegación** (las comparativas son páginas standalone).
- Sticky al hacer scroll.
- Padding consistente: `px-4 lg:px-8 py-3`.
- Border bottom sutil en light mode, sin border en dark mode.

### Footer minimalista

Crear `apps/landing/src/app/layout/landing-footer/`:

- Nombre de la inmobiliaria + año + texto "Todos los derechos reservados".
- Centrado, padding generoso, separador visual sutil.

---

## Rutas y server routes

### Cliente

```typescript
// apps/landing/src/app/app.routes.ts
[
  { path: '', loadComponent: () => import('./pages/home/home.component') },
  { path: 'c/:token', loadComponent: () => import('./pages/comparativa-publica/comparativa-publica.component') },
  { path: 'expirada', loadComponent: () => import('./pages/expirada/expirada.component') },
  { path: '404', loadComponent: () => import('./pages/not-found/not-found.component') },
  { path: '**', redirectTo: '404' }
]
```

### Server routes

```typescript
// apps/landing/src/server.ts o donde corresponda en Angular 21 SSR

// GET /api/comparativas/:token → devuelve los datos para el render SSR
// Llamado server-side por el componente comparativa-publica al cargar

// POST /api/leads/from-comparativa
// Body: { nombre, email, telefono, mensaje, comparativa_id, cf-turnstile-response, honeypot }
// Validaciones:
//   1. Honeypot vacío → si no, descartar silenciosamente con 200
//   2. Turnstile token válido (POST a siteverify de Cloudflare)
//   3. Campos requeridos
//   4. Comparativa existe y no expiró
// Si todo OK: crear interesado en PocketBase con token de servicio
// Response: { ok: true, message: "..." }

// GET /api/comparativas/:token/pdf
// 1. Si comparativa.pdf_generado existe y comparativa NO se modificó después, devolver desde cache
// 2. Si no, llamar a Playwright para generar PDF de la URL pública /c/:token?pdf=1
// 3. Guardar PDF en comparativas.pdf_generado
// 4. Devolver PDF con Content-Type: application/pdf

// GET /sitemap.xml — actualizar si todavía es placeholder
// GET /robots.txt — actualizar si todavía es placeholder
```

### Cliente PocketBase del SSR

Usar **token de servicio** (user `landing-ssr@interno.local` con permisos read-only sobre comparativas + create sobre interesados). El token se guarda en variable de entorno `PB_SERVICE_TOKEN`.

```typescript
// apps/landing/src/server/pocketbase.client.ts
export function getPocketBaseClient() {
  const pb = new PocketBase(process.env['PB_INTERNAL_URL'] ?? 'http://localhost:8080');
  pb.authStore.save(process.env['PB_SERVICE_TOKEN'] ?? '', null);
  return pb;
}
```

**Nunca exponer este cliente al browser.** Solo se usa server-side.

---

## Componente "Propuesta Individual"

### Estructura del template

```
<landing-topbar />

<main class="max-w-5xl mx-auto px-4 lg:px-0">
  
  <!-- Hero: imagen principal + precio destacado superpuesto -->
  <section class="hero relative h-[60vh] min-h-[400px] rounded-b-3xl overflow-hidden">
    <img [src]="imagenHero" class="w-full h-full object-cover" />
    <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6 lg:p-8 text-white">
      <div class="flex flex-col gap-1">
        <span class="text-sm opacity-80">{{ tipoUnidadLabel }}</span>
        <h1 class="text-3xl lg:text-5xl font-semibold">{{ codigoInterno }}</h1>
        <div class="mt-2 text-2xl lg:text-3xl font-bold">{{ precioFormateado }}</div>
        <div *ngIf="enOferta" class="text-sm opacity-90 line-through">{{ precioOriginalFormateado }}</div>
      </div>
    </div>
  </section>

  <!-- Mensaje personalizado del vendedor (si existe) -->
  <section *ngIf="mensajePersonalizado" class="mt-8 lg:mt-12 p-6 bg-surface-50 rounded-2xl border border-surface-200">
    <h2 class="text-sm uppercase tracking-wide text-surface-500 mb-2">Mensaje</h2>
    <div class="text-base leading-relaxed" [innerHTML]="mensajePersonalizado | sanitizeHtml"></div>
  </section>

  <!-- Datos principales: grid responsive -->
  <section class="mt-8 lg:mt-12">
    <h2 class="text-2xl font-semibold mb-6">Características</h2>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- Cada card: icono PrimeIcons + label + valor -->
      <div class="dato-card">
        <i class="pi pi-th-large text-2xl text-primary mb-2"></i>
        <div class="text-sm text-surface-500">Superficie</div>
        <div class="text-lg font-medium">{{ metrosCuadrados }} m²</div>
      </div>
      <!-- ... más cards: ambientes, antigüedad, cocheras, etc. -->
    </div>
  </section>

  <!-- Extras visibles en comparativa -->
  <section *ngIf="extrasVisibles.length > 0" class="mt-8 lg:mt-12">
    <h2 class="text-2xl font-semibold mb-6">Detalles adicionales</h2>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div *ngFor="let extra of extrasVisibles" class="flex justify-between p-4 bg-surface-50 rounded-lg">
        <span class="text-surface-600">{{ extra.nombre }}</span>
        <span class="font-medium">{{ extra.valor | extraValueFormat:extra.tipo }}</span>
      </div>
    </div>
  </section>

  <!-- Mapa (si hay barrio_lat/lng) -->
  <section *ngIf="tieneCoordenadas" class="mt-8 lg:mt-12">
    <h2 class="text-2xl font-semibold mb-6">Ubicación</h2>
    <div class="text-surface-600 mb-3">{{ barrioNombre }} — {{ ubicacionTexto }}</div>
    <div class="rounded-2xl overflow-hidden h-[400px] border border-surface-200">
      <landing-mapa [lat]="lat" [lng]="lng" [titulo]="barrioNombre"></landing-mapa>
    </div>
  </section>

  <!-- Plano de la unidad (si existe) -->
  <section *ngIf="urlPlano" class="mt-8 lg:mt-12">
    <h2 class="text-2xl font-semibold mb-6">Plano</h2>
    <div class="rounded-2xl overflow-hidden border border-surface-200 bg-surface-50 p-4">
      <img [src]="urlPlano" class="w-full h-auto" alt="Plano de la unidad" />
    </div>
  </section>

  <!-- Galería (si hay más imágenes además del hero) -->
  <section *ngIf="galeriaAdicional.length > 0" class="mt-8 lg:mt-12 mb-16">
    <h2 class="text-2xl font-semibold mb-6">Galería</h2>
    <div class="grid grid-cols-2 lg:grid-cols-3 gap-3">
      <img *ngFor="let img of galeriaAdicional" 
           [src]="img" 
           (click)="abrirLightbox(img)"
           class="aspect-[4/3] object-cover rounded-xl cursor-pointer hover:opacity-90 transition" />
    </div>
  </section>

  <!-- Espaciador final para que el botón flotante no tape contenido -->
  <div class="h-32"></div>
</main>

<landing-footer />

<!-- Botón flotante de contacto -->
<contactar-fab [comparativaId]="comparativaId"></contactar-fab>

<!-- Botón flotante de "Descargar PDF" (esquina inferior izquierda) -->
<descargar-pdf-fab [token]="token"></descargar-pdf-fab>
```

### Detalles de implementación

**Card de dato (componente reutilizable):**

```scss
.dato-card {
  @apply flex flex-col items-start p-4 bg-surface-50 rounded-xl border border-surface-200 transition;
  &:hover { @apply border-primary/30; }
}
```

**Pipe `extraValueFormat`:**

Transforma el valor según el tipo del extra:
- `booleano`: `true` → "Sí", `false` → "No"
- `fecha`: formato corto local
- `numero`: con separador de miles
- `opciones`: el valor como string
- `texto`: el valor como string

**Lightbox:**

Usar PrimeNG Galleria o componente simple custom con backdrop. No hace falta nada lujoso.

---

## Componente "Comparación Múltiple"

### Estructura del template

```
<landing-topbar />

<main class="max-w-7xl mx-auto px-4 lg:px-8 mt-8 lg:mt-12">
  
  <!-- Header de la comparativa -->
  <header class="mb-8 lg:mb-12">
    <h1 class="text-3xl lg:text-4xl font-semibold">{{ titulo }}</h1>
    <p class="text-surface-600 mt-2">Comparación de {{ unidades.length }} opciones</p>
    <div *ngIf="mensajePersonalizado" class="mt-4 p-4 bg-surface-50 rounded-xl text-sm leading-relaxed" 
         [innerHTML]="mensajePersonalizado | sanitizeHtml"></div>
  </header>

  <!-- Cards horizontales con imagen + precio -->
  <section class="cards-section">
    <!-- Mobile: scroll horizontal con snap -->
    <!-- Desktop: grid -->
    <div class="flex lg:grid lg:grid-cols-{{ unidades.length }} gap-4 overflow-x-auto lg:overflow-visible snap-x snap-mandatory pb-4">
      <div *ngFor="let u of unidades" 
           class="card-unidad flex-shrink-0 w-[280px] lg:w-auto snap-start bg-surface-0 rounded-2xl overflow-hidden border border-surface-200 hover:border-primary/40 transition">
        <img [src]="u.imagenHero" class="aspect-[4/3] object-cover w-full" />
        <div class="p-4">
          <div class="text-xs text-surface-500 uppercase">{{ u.tipoUnidadLabel }}</div>
          <div class="font-semibold mt-1">{{ u.codigoInterno }}</div>
          <div *ngIf="u.barrioNombre" class="text-sm text-surface-600">{{ u.barrioNombre }}</div>
          <div class="mt-3 text-xl font-bold text-primary">{{ u.precioFormateado }}</div>
          <div *ngIf="u.enOferta" class="text-xs text-surface-500 line-through">{{ u.precioOriginalFormateado }}</div>
        </div>
      </div>
    </div>
  </section>

  <!-- Tabla comparativa detallada -->
  <section class="mt-12 lg:mt-16">
    <h2 class="text-2xl font-semibold mb-6">Comparación detallada</h2>
    
    <!-- Desktop: tabla normal -->
    <div class="hidden lg:block overflow-x-auto rounded-2xl border border-surface-200">
      <table class="w-full">
        <thead class="bg-surface-50">
          <tr>
            <th class="text-left p-4 font-medium text-surface-600">Característica</th>
            <th *ngFor="let u of unidades" class="text-left p-4 font-medium">{{ u.codigoInterno }}</th>
          </tr>
        </thead>
        <tbody>
          <!-- Filas dinámicas: precio, m², ambientes, etc. -->
          <tr *ngFor="let row of filasComparativa" class="border-t border-surface-200">
            <td class="p-4 text-surface-600">{{ row.label }}</td>
            <td *ngFor="let valor of row.valores" class="p-4">{{ valor }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Mobile: cards apiladas -->
    <div class="lg:hidden space-y-3">
      <details *ngFor="let u of unidades" class="rounded-xl border border-surface-200 overflow-hidden">
        <summary class="p-4 bg-surface-50 cursor-pointer font-medium flex justify-between items-center">
          {{ u.codigoInterno }}
          <i class="pi pi-chevron-down"></i>
        </summary>
        <div class="p-4 space-y-2">
          <!-- key-value pairs -->
        </div>
      </details>
    </div>
  </section>

  <!-- Mapa mostrando todas las ubicaciones -->
  <section *ngIf="hayCoordenadas" class="mt-12 lg:mt-16">
    <h2 class="text-2xl font-semibold mb-6">Ubicaciones</h2>
    <div class="rounded-2xl overflow-hidden h-[400px] border border-surface-200">
      <landing-mapa [marcadores]="marcadores"></landing-mapa>
    </div>
  </section>

  <div class="h-32"></div>
</main>

<landing-footer />

<contactar-fab [comparativaId]="comparativaId"></contactar-fab>
<descargar-pdf-fab [token]="token"></descargar-pdf-fab>
```

### Filas de la tabla comparativa

Generadas dinámicamente. Las filas base son:

```typescript
const filasBase = [
  { label: 'Tipo', extractor: u => u.tipoUnidadLabel },
  { label: 'Superficie', extractor: u => `${u.metrosCuadrados} m²` },
  { label: 'Precio', extractor: u => u.precioFormateado, highlight: true },
  { label: 'Barrio', extractor: u => u.barrioNombre ?? 'Independiente' },
  { label: 'Ambientes', extractor: u => u.ambientes ?? '—', condicional: hayAlgunaCasa },
  { label: 'Antigüedad', extractor: u => u.antiguedad ?? '—', condicional: hayAlgunaCasa },
  { label: 'Cocheras', extractor: u => u.cocheras },
  // ... más filas base
];
```

Después, **agregar filas dinámicas por cada extra** que aparezca en al menos una unidad y esté marcado como `visible_en_comparativa`.

Las celdas con valor diferente entre unidades pueden tener un sutil highlight visual.

---

## Componente "Mapa" (`landing-mapa`)

Crear `apps/landing/src/app/components/landing-mapa/landing-mapa.component.ts`:

- Input: `lat`, `lng`, `titulo` (modo single) o `marcadores: {lat, lng, titulo}[]` (modo multiple).
- Inicializa Leaflet con tiles de CARTO Voyager:
  ```
  https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png
  ```
- Attribution: `'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>'`.
- **Importante:** Leaflet **no funciona en SSR** porque depende de `window`. Importar dinámicamente solo en cliente:

```typescript
async ngAfterViewInit() {
  if (typeof window === 'undefined') return; // SSR safe
  const L = await import('leaflet');
  // ... inicializar mapa
}
```

- Marker custom con color del tema actual.
- Zoom inicial: 15 para single, ajuste automático (`fitBounds`) para multiple.
- Disable scroll wheel zoom por default (UX: el usuario no espera que scrollear la página haga zoom en el mapa). Usar `dragging` y `tap` solo.
- Si `lat`/`lng` no vienen → no renderizar el componente.

**Soporte de tema oscuro:** CARTO tiene `dark_all` tiles para dark mode. Cambiar la URL según el theme actual:

```typescript
const tileUrl = this.themeService.currentTheme() === 'dark'
  ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
  : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
```

Y re-renderizar cuando cambia el theme (effect sobre el signal).

---

## Botón flotante "Contactar" (`contactar-fab`)

### Estructura

```typescript
@Component({
  selector: 'contactar-fab',
  template: `
    <button (click)="abrirModal()"
            class="fixed bottom-6 right-6 lg:bottom-8 lg:right-8 z-50 
                   px-5 py-3 lg:px-6 lg:py-4
                   bg-primary text-white rounded-full shadow-2xl
                   flex items-center gap-2
                   hover:scale-105 transition">
      <i class="pi pi-comments"></i>
      <span class="font-medium">Contactar</span>
    </button>

    <p-dialog [(visible)]="modalAbierto" 
              [modal]="true" 
              [draggable]="false"
              [resizable]="false"
              styleClass="contactar-dialog"
              [style]="{ width: '90vw', maxWidth: '500px' }">
      <ng-template pTemplate="header">
        <h2 class="text-xl font-semibold">Solicitar más información</h2>
      </ng-template>
      
      <form (ngSubmit)="enviar()" [formGroup]="form" class="space-y-4">
        <!-- Honeypot (oculto) -->
        <input type="text" formControlName="website" tabindex="-1" 
               autocomplete="off" class="hidden" aria-hidden="true" />
        
        <div>
          <label class="block text-sm font-medium mb-1">Nombre</label>
          <input pInputText formControlName="nombre" class="w-full" />
          <small *ngIf="form.get('nombre')?.invalid && form.get('nombre')?.touched" 
                 class="text-red-500">Nombre requerido</small>
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1">Email</label>
          <input pInputText type="email" formControlName="email" class="w-full" />
          <small *ngIf="form.get('email')?.invalid && form.get('email')?.touched" 
                 class="text-red-500">Email inválido</small>
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1">Teléfono (opcional)</label>
          <input pInputText formControlName="telefono" class="w-full" />
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1">Mensaje</label>
          <textarea pInputTextarea formControlName="mensaje" rows="3" class="w-full"
                    placeholder="Contame qué te interesa..."></textarea>
        </div>
        
        <!-- Turnstile widget -->
        <div #turnstileContainer class="cf-turnstile"></div>
        
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" pButton severity="secondary" 
                  (click)="cerrarModal()" 
                  [disabled]="enviando">Cancelar</button>
          <button type="submit" pButton 
                  [disabled]="form.invalid || enviando" 
                  [loading]="enviando">Enviar</button>
        </div>
      </form>
    </p-dialog>

    <p-toast position="top-center"></p-toast>
  `
})
```

### Comportamiento

- Click → abre modal.
- Carga Turnstile dinámicamente solo cuando se abre el modal (no en SSR).
- Validaciones: nombre y email requeridos, email formato válido.
- Honeypot: si el campo `website` viene con valor → descartar silenciosamente con 200.
- Al enviar: POST a `/api/leads/from-comparativa` con `{nombre, email, telefono, mensaje, comparativa_id, cf-turnstile-response, honeypot}`.
- Loading state durante request.
- Éxito: toast "Gracias, te contactaremos pronto" + cierra modal + reset form.
- Error: toast "Hubo un problema, intentá de nuevo" sin cerrar modal.

### Server route

```typescript
// POST /api/leads/from-comparativa
async (req, res) => {
  const { nombre, email, telefono, mensaje, comparativa_id, ['cf-turnstile-response']: token, website } = req.body;
  
  // 1. Honeypot
  if (website && website.length > 0) {
    return res.json({ ok: true }); // silenciar bots
  }
  
  // 2. Turnstile
  const verifyResp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET!, response: token })
  });
  const verifyJson = await verifyResp.json();
  if (!verifyJson.success) {
    return res.status(400).json({ error: 'Validación fallida' });
  }
  
  // 3. Validar campos
  if (!nombre || !email || !comparativa_id) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }
  
  // 4. Verificar comparativa existe y no expiró
  const pb = getPocketBaseClient();
  const comp = await pb.collection('comparativas').getOne(comparativa_id);
  if (comp.expira_en && new Date(comp.expira_en) < new Date()) {
    return res.status(410).json({ error: 'Comparativa expirada' });
  }
  
  // 5. Crear interesado
  // Si la comparativa tiene 1 unidad, asociar también unidad_id
  await pb.collection('interesados').create({
    nombre, email, telefono, mensaje,
    comparativa_id,
    unidad_id: comp.unidades_ids?.length === 1 ? comp.unidades_ids[0] : null,
    origen: 'comparativa',
    estado: 'nuevo',
    sync_status: 'pending'
  });
  
  return res.json({ ok: true });
}
```

---

## Botón flotante "Descargar PDF" (`descargar-pdf-fab`)

```typescript
@Component({
  selector: 'descargar-pdf-fab',
  template: `
    <button (click)="descargar()"
            [disabled]="generando"
            class="fixed bottom-6 left-6 lg:bottom-8 lg:left-8 z-50 
                   p-3 lg:p-4
                   bg-surface-0 text-surface-700 rounded-full shadow-xl
                   border border-surface-200
                   flex items-center gap-2
                   hover:scale-105 transition
                   disabled:opacity-60">
      <i [class]="generando ? 'pi pi-spin pi-spinner' : 'pi pi-file-pdf'"></i>
      <span class="text-sm font-medium hidden lg:inline">
        {{ generando ? 'Generando...' : 'Descargar PDF' }}
      </span>
    </button>

    <p-toast position="top-center"></p-toast>
  `
})
export class DescargarPdfFabComponent {
  @Input({ required: true }) token!: string;
  generando = signal(false);
  
  async descargar() {
    this.generando.set(true);
    try {
      const resp = await fetch(`/api/comparativas/${this.token}/pdf`);
      if (!resp.ok) throw new Error('No se pudo generar el PDF');
      
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `propuesta-${this.token}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      this.toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo descargar el PDF' });
    } finally {
      this.generando.set(false);
    }
  }
}
```

### Generación del PDF con Playwright

```typescript
// apps/landing/src/server/pdf-generator.ts

import { chromium } from 'playwright';

export async function generarPdfComparativa(token: string): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const url = `${process.env.PUBLIC_BASE_URL}/c/${token}?pdf=1`;
    await page.goto(url, { waitUntil: 'networkidle' });
    
    // Esperar a que las imágenes y mapas estén cargados
    await page.waitForLoadState('networkidle');
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', bottom: '15mm', left: '10mm', right: '10mm' }
    });
    
    return pdf;
  } finally {
    await browser.close();
  }
}
```

**Modo `?pdf=1` en la página pública:**

Cuando la URL tiene `?pdf=1`, el componente:
- No muestra los botones flotantes.
- No muestra el toggle de tema (forzar light).
- Oculta interacciones (lightbox, etc.).
- Aplica una clase CSS `.pdf-mode` que ajusta tamaños para impresión.

**Estilos de PDF:**

```scss
.pdf-mode {
  .contactar-fab, .descargar-pdf-fab, .theme-toggle {
    display: none !important;
  }
  
  // Bordes más definidos para impresión
  .border-surface-200 {
    border-color: #cbd5e1 !important;
  }
}

@page { size: A4; margin: 15mm; }
```

### Cache del PDF

- Antes de regenerar, verificar si `comparativa.pdf_generado` existe.
- Si existe y la comparativa NO se modificó después de su generación, devolver el cache.
- Si la comparativa se modificó (campo `updated` > fecha de generación del PDF), regenerar.
- Después de generar, guardar el PDF en `comparativa.pdf_generado` (upload a PocketBase).

### Importante sobre Playwright

- Instalar: `npm install playwright`. Después `npx playwright install chromium` para descargar el binario.
- En Docker, agregar dependencias de sistema en el Dockerfile (`apt-get install -y libnss3 libatk1.0-0 libatk-bridge2.0-0 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2`).
- En el VPS, Chromium consume RAM y CPU al generar. Generar PDFs no es free; cada uno cuesta ~1-2 segundos de CPU y ~200MB de RAM mientras corre.
- **Alternativa más liviana si Playwright es muy pesado:** usar `puppeteer-core` con Chromium ya instalado en el sistema. Pero Playwright es más estable.

---

## Página de expiración (`/expirada`)

```typescript
@Component({
  selector: 'page-expirada',
  template: `
    <landing-topbar />
    
    <main class="max-w-2xl mx-auto px-4 py-20 lg:py-32 text-center">
      <i class="pi pi-clock text-6xl text-surface-400 mb-6"></i>
      <h1 class="text-3xl lg:text-4xl font-semibold mb-3">Esta propuesta expiró</h1>
      <p class="text-surface-600 mb-8">El link de la propuesta que estás buscando ya no está disponible.</p>
      <a [href]="urlInmobiliaria" pButton class="inline-flex">
        Visitar nuestra web
      </a>
    </main>
    
    <landing-footer />
  `
})
```

Detección de expiración en el componente `comparativa-publica`:
- Si el token no existe en DB → redirect a `/expirada`.
- Si la comparativa tiene `expira_en` y ya pasó → redirect a `/expirada`.
- Redirección server-side cuando es posible (mejor UX, sin flash de contenido).

---

## Tracking de vistas

En el SSR, al cargar exitosamente una comparativa válida:

```typescript
// Server-side, antes de renderizar
await pb.collection('comparativa_vistas').create({
  comparativa_id: comp.id,
  ip_hash: hashIp(req.ip),  // SHA-256 con un salt fijo
  user_agent: req.headers['user-agent'] ?? '',
  accessed_at: new Date().toISOString()
});

// Incrementar contador en la comparativa (atómico via hook o update)
await pb.collection('comparativas').update(comp.id, {
  vistas_count: comp.vistas_count + 1
});
```

**Importante:** no contar accesos en modo `?pdf=1` (el propio Playwright accede para generar el PDF).

---

## Metadata para preview en redes sociales

En el componente `comparativa-publica`, server-side:

```typescript
import { Meta, Title } from '@angular/platform-browser';

ngOnInit() {
  const titulo = `${this.snapshot.titulo} — ${this.config.nombre_inmobiliaria}`;
  const descripcion = this.snapshot.unidades.length === 1
    ? `${this.snapshot.unidades[0].tipoUnidad} en ${this.snapshot.unidades[0].barrioNombre}. ${this.snapshot.unidades[0].precio}`
    : `Comparación de ${this.snapshot.unidades.length} propiedades`;
  const imagen = this.snapshot.unidades[0].imagenHero;
  
  this.title.setTitle(titulo);
  this.meta.updateTag({ name: 'description', content: descripcion });
  this.meta.updateTag({ property: 'og:title', content: titulo });
  this.meta.updateTag({ property: 'og:description', content: descripcion });
  this.meta.updateTag({ property: 'og:image', content: imagen });
  this.meta.updateTag({ property: 'og:type', content: 'website' });
  this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
}
```

---

## Estructura de archivos final

```
apps/landing/src/app/
├── app.routes.ts
├── app.config.ts
├── layout/
│   ├── landing-topbar/
│   │   └── landing-topbar.component.ts
│   └── landing-footer/
│       └── landing-footer.component.ts
├── pages/
│   ├── home/
│   │   └── home.component.ts             # placeholder, ya existe
│   ├── comparativa-publica/
│   │   ├── comparativa-publica.component.ts  # router por tipo
│   │   ├── propuesta-individual/
│   │   │   └── propuesta-individual.component.ts
│   │   └── comparacion-multiple/
│   │       └── comparacion-multiple.component.ts
│   ├── expirada/
│   │   └── expirada.component.ts
│   └── not-found/
│       └── not-found.component.ts
├── components/
│   ├── contactar-fab/
│   │   └── contactar-fab.component.ts
│   ├── descargar-pdf-fab/
│   │   └── descargar-pdf-fab.component.ts
│   ├── landing-mapa/
│   │   └── landing-mapa.component.ts
│   ├── dato-card/
│   │   └── dato-card.component.ts
│   └── lightbox-galeria/
│       └── lightbox-galeria.component.ts
├── services/
│   ├── theme.service.ts
│   └── config-publica.service.ts          # carga config global desde PB
├── pipes/
│   ├── extra-value-format.pipe.ts
│   ├── precio-format.pipe.ts
│   └── sanitize-html.pipe.ts
└── server/
    ├── pocketbase.client.ts
    ├── pdf-generator.ts
    ├── turnstile.ts
    └── ip-hash.ts
```

---

## Plan de ejecución con subagentes

### FASE 0 — Preparación (vos directamente)

1. Branch `feat/comparativas-publicas`.
2. Crear cuenta en Cloudflare Turnstile (`https://dash.cloudflare.com/?to=/:account/turnstile`), obtener `site_key` y `secret_key`.
3. Actualizar `.env.example` del monorepo con las variables nuevas:
   - `PB_INTERNAL_URL`
   - `PB_SERVICE_TOKEN`
   - `TURNSTILE_SECRET_KEY`
   - `TURNSTILE_SITE_KEY` (también va al cliente Angular)
   - `PUBLIC_BASE_URL`
4. Crear user de servicio en PocketBase (`landing-ssr@interno.local` con role específico, password fuerte). Generar su JWT y guardarlo en `.env` local.

### FASE 1 — Infraestructura (1 subagente)

**Subagente A:**
- Setup de Tailwind + variables CSS de tema compartidas con admin.
- `ThemeService` con detección automática + toggle + persistencia en localStorage.
- `landing-topbar` + `landing-footer` minimalistas.
- `ConfigPublicaService` que carga `config` global (logo, nombre).
- Verificar que SSR funciona con todo lo anterior.

### FASE 2 — Server routes + cliente PocketBase (1 subagente)

**Subagente B:**
- `pocketbase.client.ts` con token de servicio.
- Server route `GET /api/comparativas/:token` (devuelve datos para SSR).
- Server route `POST /api/leads/from-comparativa` con Turnstile + honeypot.
- Server route `GET /api/comparativas/:token/pdf` (placeholder por ahora, devuelve 501).
- `turnstile.ts` con función `verifyTurnstileToken`.
- `ip-hash.ts` con SHA-256 + salt.
- Tracking de vistas en cada acceso.

### FASE 3 — Página comparativa pública core (1 subagente)

**Subagente C:**
- `comparativa-publica.component.ts` (router por tipo).
- Lógica de redirect a `/expirada` si token inválido o expirado.
- Setup de meta tags Open Graph.
- Página `/expirada` y `/404` con diseño consistente.

### FASE 4 — Componente Propuesta Individual (1 subagente)

**Subagente D:**
- `propuesta-individual.component.ts` con todas las secciones.
- `dato-card.component.ts` reutilizable.
- `extra-value-format.pipe.ts`, `precio-format.pipe.ts`, `sanitize-html.pipe.ts`.
- `lightbox-galeria.component.ts`.
- Responsive completo (mobile-first).
- Estilos para `?pdf=1` (clase `.pdf-mode`).

### FASE 5 — Componente Comparación Múltiple (1 subagente)

**Subagente E:**
- `comparacion-multiple.component.ts` con cards + tabla detallada.
- Generación dinámica de filas comparativas (incluyendo extras).
- Versión mobile con cards apiladas + `<details>`.
- Estilos para `?pdf=1`.

### FASE 6 — Mapa con Leaflet (1 subagente)

**Subagente F:**
- `landing-mapa.component.ts` con import dinámico de Leaflet (SSR-safe).
- Tiles de CARTO (light/dark según theme).
- Marker custom.
- Modos single y multiple.
- Tests de que NO rompe SSR.

### FASE 7 — Botones flotantes (1 subagente)

**Subagente G:**
- `contactar-fab.component.ts` con modal + form + Turnstile + honeypot.
- `descargar-pdf-fab.component.ts` con loading state.

### FASE 8 — PDF generation (1 subagente)

**Subagente H:**
- Instalación de Playwright.
- `pdf-generator.ts` con generación.
- Actualizar Server route `/api/comparativas/:token/pdf` con la lógica completa (cache + regeneración).
- Modificar Dockerfile de `landing` para incluir dependencias de Chromium.
- Documentar consumo de RAM en `docs/`.

### FASE 9 — Verificación integral (vos directamente)

Smoke tests críticos:

1. Crear comparativa individual desde admin con 1 unidad que tenga: imagen hero, galería de 3 imágenes, plano, barrio con lat/lng, 3 extras visibles.
2. Abrir el link público en el browser. Verificar:
   - Hero se ve bien.
   - Datos correctos.
   - Mapa carga y se posiciona.
   - Plano se muestra.
   - Galería abre lightbox.
   - Botón flotante "Contactar" abre modal.
3. Enviar lead desde modal. Verificar que:
   - Turnstile valida (probar con un honeypot lleno → debe descartar).
   - Toast de éxito aparece.
   - Lead aparece en admin como `origen=comparativa` con `comparativa_id` y `unidad_id` correctos.
4. Toggle de tema claro/oscuro: verificar mapa también cambia.
5. Compartir link en WhatsApp: verificar preview con título + imagen + descripción.
6. Click en "Descargar PDF": verificar que se descarga el PDF y se ve bien.
7. Modificar la comparativa en admin (cambiar título). Volver a descargar PDF → debe regenerar (no devolver cache viejo).
8. Crear comparativa múltiple con 3 unidades.
9. Abrir link público. Verificar:
   - Cards horizontales en mobile (scroll snap).
   - Tabla comparativa en desktop con todas las filas.
   - Mapa con 3 marcadores.
   - PDF descargable.
10. Setear `expira_en` en el pasado. Refresh. Verificar redirect a `/expirada`.
11. Acceder a un token aleatorio inválido. Verificar `/expirada`.
12. Mobile real (no emulador): verificar que todo se ve y funciona correctamente.

---

## Reglas de implementación

- **TypeScript strict.** Sin `any`.
- **SSR safe.** Cualquier código que use `window`, `document`, `localStorage`, `navigator`, `Leaflet` debe estar guardado con `typeof window !== 'undefined'` o ser importado dinámicamente en `ngAfterViewInit`.
- **Mobile first.** Diseñar primero para 375px de ancho, después escalar.
- **No usar el layout de Sakai.** Solo reutilizar variables CSS y lógica de tema.
- **PrimeNG selectivo:** importar solo los módulos necesarios, no el bundle completo.
- **Accesibilidad básica:** labels en inputs, alt en imágenes, `aria-label` en botones de solo icono, contraste de colores AA.
- **Performance:** lazy load de Leaflet, Turnstile y Playwright. Imágenes con `loading="lazy"` salvo el hero.
- **Sin animaciones llamativas.** Solo transiciones sutiles (hover, fade) y nada que distraiga del contenido. Sin scroll-driven animations.
- **El branding viene de `config` siempre**, no hardcoded.

## Coordinación entre subagentes

- Antes de cada fase, mostrame el plan.
- Después de cada fase, reporte consolidado.
- **Fases 1, 2 son secuenciales** (3 depende de ambas).
- **Fases 4 y 5 pueden ir en paralelo** (componentes independientes).
- **Fases 6, 7, 8 pueden ir en paralelo** (independientes entre sí, dependen de 3).
- Si Playwright es problemático en el entorno de desarrollo del agente, reportarlo. Hay alternativas (puppeteer, html2pdf.js client-side aunque más limitado).

## Preguntas previas

Si al leer el prompt hay algo ambiguo, hacelo antes. Especialmente:
- ¿El user de servicio del SSR ya existe y tiene los permisos correctos?
- ¿La variable `PUBLIC_BASE_URL` está definida para que el PDF generator sepa a qué URL navegar?
- ¿Las imágenes de unidades se sirven con URLs absolutas o relativas a PocketBase? Verificar antes de empezar.

¿Listo para arrancar la Fase 0?
