# Tarea: Gestión de usuarios, permisos y asignación de barrios — LoteoManager

Sos el agente principal encargado de implementar el **módulo de usuarios y permisos** del sistema. El sistema base ya está funcionando con login, CRUDs de entidades principales, sistema de extras y estados configurables.

## Contexto del estado actual

- **Stack:** Angular 21 + PrimeNG 21 + Sakai-NG + PocketBase v0.23.
- **Convención del repo:** todo bajo `apps/admin/src/app/features/`.
- **Lo que ya existe:**
  - Sistema de auth con login y JWT funcional.
  - `AuthService` con signals `currentUser`, `isAuthenticated`.
  - `AuthGuard` y `RoleGuard` básicos.
  - Directiva `*hasRole` en `shared-ui`.
  - Tabla `users` con campo `role` (admin | vendedor).
  - Tabla `vendedor_barrios` (pivot N:N) con asignación directa.
  - Hooks que validan permisos por campo en `unidades` (vendedor solo modifica estados).
  - Sistema de extras y estados configurables ya operativo.

## Alcance de esta tarea

### Incluye

1. **Sistema de permisos granular** basado en constantes (no configurable por admin todavía, pero arquitectura preparada para migrar después).
2. **Asignación por zona** además de la asignación directa actual.
3. **CRUD de usuarios** completo (crear, editar, desactivar).
4. **Componente "Mi Perfil"** para usuarios logueados.
5. **Flujo de reset de password por mail** (configurar SMTP + endpoints + páginas).
6. **Refactor de guards y directiva** para usar el nuevo sistema de permisos en lugar de validar role directamente.
7. **Hook de validación en backend** que respete la lógica de asignación directa + zona.
8. Tests de los hooks de permisos críticos.

### NO incluye

- Rol "supervisor" (queda para después, pero estructura preparada).
- RBAC configurable por admin desde UI (queda para futuro).
- Auditoría avanzada de accesos (el audit_log básico ya existe).
- 2FA o login social.

---

## Modelo de datos

### Modificación a `barrios`

Agregar campo:

```
- zona (Text, nullable)  // ej: "Norte", "Sur", "Costa", etc.
```

Texto libre para flexibilidad. El admin escribe la zona al crear/editar el barrio.

### Modificación a `users`

Agregar campos:

```
- activo (Bool, default true)  // soft delete, ya existía
- ultimo_acceso (Date, nullable)  // se actualiza al login
- reset_token (Text, nullable, indexed)  // para reset por mail
- reset_token_expires (Date, nullable)
```

Verificar si `whatsapp`, `telefono`, `avatar`, `leads_visibility` ya existen del prompt anterior. Si no, agregarlos según el spec.

### Nueva colección: `vendedor_zonas`

```
- id (autogen)
- vendedor_id (Relation → users, required)
- zona (Text, required)  // debe coincidir exactamente con barrios.zona
- created (autogen)
- UNIQUE (vendedor_id, zona)

INDEX (vendedor_id)
INDEX (zona)
```

### Tabla existente `vendedor_barrios`

Sin cambios, sigue siendo la asignación directa.

---

## Sistema de permisos

### Definición en código

Crear `libs/shared-pb-client/src/lib/permisos/permisos.constants.ts`:

```typescript
export type Permiso = 
  // Unidades
  | 'unidades.read'
  | 'unidades.read_all'              // ver todas, ignorar asignaciones
  | 'unidades.create'
  | 'unidades.update'                // editar todos los campos
  | 'unidades.update_estado'         // solo cambiar estado y fechas comerciales
  | 'unidades.delete'
  // Barrios
  | 'barrios.read'
  | 'barrios.create'
  | 'barrios.update'
  | 'barrios.delete'
  // Interesados
  | 'interesados.read_propios'
  | 'interesados.read_all'
  | 'interesados.create'
  | 'interesados.update_propios'
  | 'interesados.update_all'
  | 'interesados.assign'             // asignar/reasignar responsable
  | 'interesados.delete'
  // Comparativas
  | 'comparativas.create'
  | 'comparativas.read_propias'
  | 'comparativas.read_all'
  | 'comparativas.update_propias'
  | 'comparativas.delete'
  // Arquitectos
  | 'arquitectos.read'
  | 'arquitectos.crud'
  // Configuración del sistema
  | 'config.read'
  | 'config.update'
  | 'extras.crud'
  | 'estados.crud'
  // Usuarios
  | 'users.read'
  | 'users.crud'
  | 'users.assign_barrios'
  // Importador
  | 'importador.use'
  | 'importador.view_history'
  // Dashboard
  | 'dashboard.full'
  | 'dashboard.personal';

export type Role = 'admin' | 'vendedor';
// Nota: 'supervisor' queda preparado para agregar después sin cambiar la arquitectura

export const PERMISOS_POR_ROL: Record<Role, Permiso[]> = {
  admin: ['*' as any],  // wildcard, tiene todo
  vendedor: [
    'unidades.read',
    'unidades.update_estado',
    'barrios.read',
    'interesados.read_propios',
    'interesados.update_propios',
    'comparativas.create',
    'comparativas.read_propias',
    'comparativas.update_propias',
    'arquitectos.read',
    'dashboard.personal'
  ]
};
```

### Servicio `PermisosService`

`libs/shared-pb-client/src/lib/permisos/permisos.service.ts`:

```typescript
@Injectable({ providedIn: 'root' })
export class PermisosService {
  private auth = inject(AuthService);
  
  /**
   * Verifica si el usuario actual tiene un permiso específico.
   * Admin con '*' siempre devuelve true.
   */
  can(permiso: Permiso): boolean {
    const user = this.auth.currentUser();
    if (!user) return false;
    
    const permisosRol = PERMISOS_POR_ROL[user.role as Role] ?? [];
    return permisosRol.includes('*' as any) || permisosRol.includes(permiso);
  }
  
  /**
   * Versión reactiva, devuelve Signal.
   */
  canSignal(permiso: Permiso): Signal<boolean> {
    return computed(() => this.can(permiso));
  }
  
  /**
   * Helper para chequear múltiples permisos (AND).
   */
  canAll(...permisos: Permiso[]): boolean {
    return permisos.every(p => this.can(p));
  }
  
  /**
   * Helper para chequear múltiples permisos (OR).
   */
  canAny(...permisos: Permiso[]): boolean {
    return permisos.some(p => this.can(p));
  }
}
```

### Directiva `*hasPermiso`

Crear nueva, mantener `hasRole` por retrocompatibilidad pero marcarla como `@deprecated`:

```typescript
@Directive({ standalone: true, selector: '[hasPermiso]' })
export class HasPermisoDirective {
  // Uso: *hasPermiso="'unidades.create'"
  // O:   *hasPermiso="['unidades.update', 'unidades.delete']"  (AND)
}
```

### Refactor de `RoleGuard` → `PermisoGuard`

```typescript
export function permisoGuard(...permisos: Permiso[]): CanActivateFn {
  return () => {
    const permisosService = inject(PermisosService);
    const router = inject(Router);
    
    if (permisosService.canAll(...permisos)) return true;
    
    router.navigate(['/forbidden']);
    return false;
  };
}
```

Uso en rutas:
```typescript
{
  path: 'usuarios',
  canActivate: [authGuard, permisoGuard('users.crud')],
  loadChildren: () => import('./features/usuarios/usuarios.routes')
}
```

**Mantener `RoleGuard` existente** marcado como deprecated por compatibilidad mientras se refactorea progresivamente.

---

## Lógica de barrios visibles por vendedor

### En frontend (`UnidadesService`, `BarriosService`, etc.)

Crear método helper en un nuevo servicio `VendedorAccesoService`:

```typescript
@Injectable({ providedIn: 'root' })
export class VendedorAccesoService {
  /**
   * Devuelve los IDs de barrios visibles para el vendedor actual.
   * Combina asignación directa + zonas asignadas.
   * Para admin devuelve null (significa "todos").
   */
  async barriosVisiblesIds(): Promise<string[] | null> {
    const user = this.auth.currentUser();
    if (user.role === 'admin') return null;
    
    // 1. Barrios asignados directamente
    const directos = await this.pb.collection('vendedor_barrios')
      .getFullList({ filter: `vendedor_id="${user.id}"` });
    
    // 2. Zonas asignadas
    const zonas = await this.pb.collection('vendedor_zonas')
      .getFullList({ filter: `vendedor_id="${user.id}"` });
    
    // 3. Barrios de esas zonas
    const zonasFilter = zonas.map(z => `zona="${z.zona}"`).join(' || ');
    const porZona = zonasFilter 
      ? await this.pb.collection('barrios').getFullList({ filter: zonasFilter })
      : [];
    
    // Union de IDs
    const idsDirectos = new Set(directos.map(d => d.barrio_id));
    const idsPorZona = new Set(porZona.map(b => b.id));
    return [...new Set([...idsDirectos, ...idsPorZona])];
  }
  
  /**
   * Cache el resultado en un signal, se invalida cuando cambia el usuario logueado.
   */
  readonly barriosVisibles = signal<string[] | null>(null);
  
  async loadCache(): Promise<void> { ... }
  async refresh(): Promise<void> { ... }
}
```

**Cargar el cache al login** (junto con DefinicionesCacheService).

### En backend (PocketBase hook)

Sobre `onRecordBeforeUpdateRequest` y `onRecordBeforeDeleteRequest` para `unidades`, **antes del hook existente de permisos por campo**:

```javascript
// Si el usuario es vendedor, validar que la unidad pertenece a un barrio visible
if (user.role === 'vendedor') {
  const unidad = e.record;
  const barrio_id = unidad.get('barrio_id');
  
  if (barrio_id) {
    // Buscar si tiene acceso directo o por zona
    const tieneAccesoDirecto = $app.dao().findFirstRecordByFilter(
      'vendedor_barrios',
      `vendedor_id="${user.id}" && barrio_id="${barrio_id}"`
    );
    
    if (!tieneAccesoDirecto) {
      const barrio = $app.dao().findRecordById('barrios', barrio_id);
      const zona = barrio.get('zona');
      
      const tieneAccesoPorZona = zona 
        ? $app.dao().findFirstRecordByFilter(
            'vendedor_zonas',
            `vendedor_id="${user.id}" && zona="${zona}"`
          )
        : null;
      
      if (!tieneAccesoPorZona) {
        throw new BadRequestError('No tenés acceso a este barrio');
      }
    }
  }
  // Si la unidad no tiene barrio_id (independiente), solo admin puede tocarla
  else {
    throw new BadRequestError('Solo admin puede modificar unidades independientes');
  }
}

// Continuar con el hook existente de permisos por campo (estado vs datos)
```

---

## Reset de password

### Backend

PocketBase soporta nativamente reset por mail. Solo hay que:

1. **Configurar SMTP** en PocketBase Settings (sección Mail Settings). Usar Resend o Brevo (Sendinblue) free tier.
2. **Personalizar el template** del email de reset (subject, body con branding).
3. **Habilitar el endpoint** `POST /api/collections/users/request-password-reset` (ya viene activo por default si está configurado SMTP).

### Frontend

Crear:

**`features/auth/recuperar-password/recuperar-password.component.ts`** — formulario con input de email, dispara `pb.collection('users').requestPasswordReset(email)`. Muestra mensaje "Si el email existe, recibirás un link en tu correo" (sin confirmar existencia, por seguridad).

**`features/auth/resetear-password/resetear-password.component.ts`** — toma el token de la URL (`/auth/reset?token=xxx`), pide nueva password 2 veces, valida coincidencia y fortaleza mínima (8 chars), llama `pb.collection('users').confirmPasswordReset(token, password, passwordConfirm)`.

**Rutas en `app.routes.ts`:**
```typescript
{ path: 'auth/recuperar', component: RecuperarPasswordComponent },
{ path: 'auth/reset', component: ResetearPasswordComponent }
```

**Link en login:** agregar "¿Olvidaste tu contraseña?" debajo del form que navega a `/auth/recuperar`.

---

## Componentes Angular nuevos

### `features/usuarios/`

#### `usuarios-list.component.ts`

- p-table con columnas: nombre, email, role (con badge de color), activo (toggle), último_acceso, acciones.
- Filtros: por role, por estado activo.
- Botón "Nuevo Usuario" (solo si `permisos.can('users.crud')`).
- Acciones por fila: Editar, Asignar Barrios/Zonas, Desactivar/Activar, Resetear Password (admin envía link).
- Solo visible para admin (permiso `users.crud`).

#### `usuario-form.component.ts`

Form para crear/editar:
- Nombre, email.
- Role (select: admin | vendedor).
- Teléfono, WhatsApp.
- Avatar (upload).
- `leads_visibility` (select, solo visible si role = vendedor): `solo_mios`, `mios_mas_sin_asignar`, `todos_mis_barrios`, `todos`.
- Activo (toggle).

**Al crear:** se setea password temporal random y se envía link de "establecer contraseña" al email. **No mostrar la password en pantalla.**

**Al editar:** solo se pueden modificar los campos. La password se cambia con flujo separado de reset.

#### `usuario-asignaciones.component.ts`

Pantalla que se abre al hacer click en "Asignar Barrios/Zonas" desde el listado. Tabs o secciones:

**Tab 1 — Asignación directa:**
- Lista de barrios disponibles (los que el vendedor NO tiene asignados).
- Lista de barrios asignados.
- Drag & drop o transfer list de PrimeNG (`p-pickList`) para mover entre ambos.
- Al confirmar, hace los inserts/deletes en `vendedor_barrios`.

**Tab 2 — Asignación por zona:**
- Multi-select de zonas existentes (extraídas de `barrios.zona` con `DISTINCT`).
- Permitir agregar zona nueva tipeando.
- Al confirmar, hace los inserts/deletes en `vendedor_zonas`.

**Sección informativa:**
- Mostrar resumen: "Este vendedor tiene acceso a N barrios (X directos + Y por zona)".

#### `mi-perfil.component.ts`

Accesible para CUALQUIER usuario logueado en `/mi-perfil`:

- Datos personales editables: nombre, teléfono, WhatsApp, avatar.
- Cambio de password (form con password actual + nueva 2x).
- Email NO editable (gestionado por admin).
- Role NO editable (informativo).
- Si es vendedor, muestra resumen de sus asignaciones (barrios directos + zonas).

### Página de error de permisos: `forbidden.component.ts`

Pantalla simple "No tenés permiso para acceder a esta sección" con botón "Volver al dashboard". Se navega a esta ruta cuando `permisoGuard` falla.

### Integración en `app.menu.ts`

Agregar al menú lateral (solo visible si admin):

```typescript
{
  label: 'Administración',
  icon: 'pi pi-cog',
  visible: () => permisos.can('users.crud'),
  items: [
    { label: 'Usuarios', icon: 'pi pi-users', routerLink: ['/usuarios'] },
    { label: 'Extras', icon: 'pi pi-tags', routerLink: ['/admin/extras'] },
    { label: 'Estados', icon: 'pi pi-flag', routerLink: ['/admin/estados'] }
  ]
}
```

Y agregar acceso a "Mi Perfil" desde el avatar del topbar (todos los usuarios).

---

## Hooks de PocketBase nuevos

### Hook 1 — Validación de acceso a unidad por vendedor

Descripto arriba en "Lógica de barrios visibles por vendedor → En backend".

### Hook 2 — Update de `ultimo_acceso` al login

Sobre `onRecordAuthRequest` para `users`:

```javascript
e.record.set('ultimo_acceso', new Date().toISOString());
$app.dao().saveRecord(e.record);
e.next();
```

### Hook 3 — Protección de role en updates

Sobre `onRecordBeforeUpdateRequest` para `users`:

```javascript
// Solo admin puede cambiar el role de un usuario
if (e.requestInfo.authRecord.role !== 'admin' && e.record.get('role') !== e.record.original().get('role')) {
  throw new ForbiddenError('No podés cambiar tu propio role');
}

// Ningún usuario puede desactivarse a sí mismo
if (e.record.id === e.requestInfo.authRecord.id && e.record.get('activo') === false) {
  throw new BadRequestError('No podés desactivarte a vos mismo');
}
```

### Hook 4 — Validación de zona al crear vendedor_zonas

Sobre `onRecordBeforeCreateRequest` para `vendedor_zonas`:

```javascript
// Validar que la zona realmente existe en al menos un barrio
const zona = e.record.get('zona');
const existe = $app.dao().findFirstRecordByFilter('barrios', `zona="${zona}"`);
if (!existe) {
  throw new BadRequestError(`La zona '${zona}' no existe en ningún barrio. Asigná la zona a un barrio primero.`);
}
```

---

## API Rules

```
users:
  List/View:    @request.auth.id != ""
  Create:       @request.auth.role = "admin"
  Update:       @request.auth.id = id || @request.auth.role = "admin"  // hook valida cambios de role
  Delete:       @request.auth.role = "admin"

vendedor_barrios:
  List/View:    @request.auth.id != "" && (@request.auth.role = "admin" || vendedor_id = @request.auth.id)
  Create:       @request.auth.role = "admin"
  Update:       @request.auth.role = "admin"
  Delete:       @request.auth.role = "admin"

vendedor_zonas:
  List/View:    @request.auth.id != "" && (@request.auth.role = "admin" || vendedor_id = @request.auth.id)
  Create:       @request.auth.role = "admin"
  Update:       @request.auth.role = "admin"
  Delete:       @request.auth.role = "admin"
```

---

## Migraciones nuevas

Crear migraciones en `pb_migrations/`:

- `1700000030_add_zona_to_barrios.js` — agrega campo `zona` a barrios.
- `1700000031_create_vendedor_zonas.js` — nueva colección + API rules.
- `1700000032_add_ultimo_acceso_to_users.js` — agrega `ultimo_acceso`, `reset_token`, `reset_token_expires`. Solo si no existen ya.

Cada una con su `down` para rollback.

---

## Plan de ejecución con subagentes

### FASE 0 — Preparación (vos directamente)

1. Branch `feat/usuarios-y-permisos`.
2. Backup de `pb_data/` por si la migración rompe algo.
3. Configurar SMTP en PocketBase Settings (Resend o Brevo free tier). Necesario antes de testear reset de password.

### FASE 1 — Backend (2 subagentes en paralelo)

**Subagente A: Migraciones**
- 3 migraciones nuevas (zona, vendedor_zonas, campos en users).
- Verificar que no rompen los hooks existentes.

**Subagente B: Hooks**
- Hook de validación de acceso por vendedor (combina directa + zona).
- Hook de `ultimo_acceso`.
- Hook de protección de role.
- Hook de validación de zona.
- Tests en `pb_hooks/_tests/`.

### FASE 2 — Sistema de permisos en frontend (1 subagente)

**Subagente C:**
- Crear `permisos.constants.ts`, `PermisosService`, directiva `hasPermiso`, `permisoGuard`.
- Refactorear las rutas existentes para usar `permisoGuard` en lugar de `RoleGuard` donde aplique. Mantener `RoleGuard` como deprecated.
- Crear `VendedorAccesoService` con el cache de barrios visibles.
- Integrar carga del cache en `AuthService.login()`.
- Actualizar `BarriosService` y `UnidadesService` para filtrar por `barriosVisibles()` cuando el usuario es vendedor.

### FASE 3 — Componentes de usuarios (1 subagente)

**Subagente D:**
- `usuarios-list.component.ts`.
- `usuario-form.component.ts`.
- `usuario-asignaciones.component.ts` (tabs de directa y por zona).
- `mi-perfil.component.ts`.
- `forbidden.component.ts`.
- Integración en menú lateral y topbar.

### FASE 4 — Reset de password (1 subagente)

**Subagente E:**
- `recuperar-password.component.ts`.
- `resetear-password.component.ts`.
- Rutas y link desde login.
- Verificar que el flujo end-to-end funciona con SMTP configurado.
- Personalizar template del email en PocketBase admin UI.

### FASE 5 — Verificación integral (vos directamente)

Smoke tests:

1. Crear vendedor desde admin. Verificar que recibe email con link.
2. El nuevo vendedor establece password via link y loguea.
3. Asignar al vendedor 2 barrios directamente. Verificar que solo ve esos.
4. Crear zona "Norte" en 3 barrios. Asignar al vendedor la zona "Norte". Verificar que ahora ve 5 barrios (2 directos + 3 por zona).
5. Vendedor intenta editar precio de unidad → bloqueado.
6. Vendedor cambia estado de unidad → OK.
7. Vendedor intenta cambiar estado de unidad de un barrio NO asignado → bloqueado.
8. Admin intenta cambiarse a sí mismo el role → bloqueado.
9. Admin intenta desactivarse → bloqueado.
10. Usuario olvida password, pide reset, recibe mail, restablece, loguea con nueva.
11. Vendedor entra a "Mi Perfil", cambia su teléfono. Funciona.
12. Vendedor intenta acceder a `/usuarios` por URL directa → redirigido a `/forbidden`.

---

## Reglas de implementación

- **TypeScript strict.** Sin `any` (la única excepción justificada es el wildcard `'*'` en `PERMISOS_POR_ROL.admin`, comentado).
- **Signals para reactividad.** Especialmente `currentUser`, `barriosVisibles`, `permisos`.
- **No exponer datos sensibles en cliente.** El backend SIEMPRE valida permisos aunque el frontend ya lo haya hecho.
- **Mensajes de error claros pero no informativos para atacantes.** "Si el email existe, recibirás un link" en lugar de "Email no encontrado".
- **El refactor de RoleGuard a permisoGuard debe ser gradual.** No romper rutas existentes que ya usan RoleGuard. Cambiar a permisoGuard en las rutas nuevas y migrar progresivamente las viejas.
- **Documentar en `docs/permisos.md`**:
  - Lista completa de permisos disponibles.
  - Tabla de qué role tiene qué permisos.
  - Cómo agregar un nuevo permiso (3 lugares: types, constante, lugar donde se chequea).
  - Cómo agregar el rol "supervisor" en el futuro (instrucciones explícitas).

## Coordinación entre subagentes

- Antes de cada fase, mostrame el plan de delegación.
- Después de cada fase, reporte consolidado.
- Subagentes A y B en paralelo OK (uno toca solo `pb_migrations/`, el otro solo `pb_hooks/`).
- Subagentes C, D y E son secuenciales NO paralelos: C define las primitivas que D y E usan.
- Si un hook de validación de acceso tiene problemas de performance (muchos lookups por cada request), reportarlo. Hay opciones de cacheo a nivel hook que podemos discutir.

## Preguntas previas

Si al leer el prompt hay algo ambiguo, especialmente en:
- API exacta de hooks v0.23 para `onRecordAuthRequest`.
- Cómo hacer `findFirstRecordByFilter` con seguridad de tipos.
- Si PocketBase v0.23 permite custom endpoints registrados sin reiniciar.

Hacelas antes de empezar.

¿Listo para arrancar la Fase 0?
