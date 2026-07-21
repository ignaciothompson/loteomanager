export type Permiso =
  | 'unidades.read'
  | 'unidades.read_all'
  | 'unidades.create'
  | 'unidades.update'
  | 'unidades.update_estado'
  | 'unidades.delete'
  | 'unidades.bulk_edit'
  | 'barrios.read'
  | 'barrios.create'
  | 'barrios.update'
  | 'barrios.delete'
  | 'interesados.read_propios'
  | 'interesados.read_all'
  | 'interesados.create'
  | 'interesados.update_propios'
  | 'interesados.update_all'
  | 'interesados.assign'
  | 'interesados.delete'
  | 'comparativas.create'
  | 'comparativas.read_propias'
  | 'comparativas.read_all'
  | 'comparativas.update_propias'
  | 'comparativas.delete'
  | 'arquitectos.read'
  | 'arquitectos.crud'
  | 'config.read'
  | 'config.update'
  | 'extras.crud'
  | 'estados.crud'
  | 'users.read'
  | 'users.crud'
  | 'users.manage'
  | 'users.assign_barrios'
  | 'departamentos.manage'
  | 'zonas.manage'
  | 'web.publish'
  | 'seguimiento.view'
  | 'seguimiento.manage'
  | 'importador.use'
  | 'importador.view_history'
  | 'dashboard.full'
  | 'dashboard.personal';

export type Role = 'admin' | 'supervisor' | 'vendedor';

const ADMIN_WILDCARD = '*' as unknown as Permiso;

export const PERMISOS_POR_ROL: Record<Role, Permiso[]> = {
  admin: [ADMIN_WILDCARD],
  supervisor: [
    'unidades.read',
    'unidades.read_all',
    'unidades.create',
    'unidades.update',
    'unidades.update_estado',
    'unidades.bulk_edit',
    'barrios.read',
    'barrios.create',
    'barrios.update',
    'interesados.read_all',
    'interesados.create',
    'interesados.update_all',
    'interesados.assign',
    'comparativas.create',
    'comparativas.read_all',
    'comparativas.update_propias',
    'arquitectos.read',
    'config.read',
    'zonas.manage',
    'extras.crud',
    'estados.crud',
    'seguimiento.view',
    'seguimiento.manage',
    'importador.use',
    'importador.view_history',
    'dashboard.full',
  ],
  vendedor: [
    'unidades.read',
    'unidades.update_estado',
    'barrios.read',
    'interesados.read_propios',
    'interesados.create',
    'interesados.update_propios',
    'comparativas.create',
    'comparativas.read_propias',
    'comparativas.update_propias',
    'arquitectos.read',
    'seguimiento.view',
    'dashboard.personal',
  ],
};

/** Permisos reservados solo para admin (no incluidos en supervisor). */
export const PERMISOS_SOLO_ADMIN: Permiso[] = [
  'users.manage',
  'users.crud',
  'departamentos.manage',
  'web.publish',
];
