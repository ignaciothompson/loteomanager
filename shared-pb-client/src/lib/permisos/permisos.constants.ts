export type Permiso =
  | 'unidades.read'
  | 'unidades.read_all'
  | 'unidades.create'
  | 'unidades.update'
  | 'unidades.update_estado'
  | 'unidades.delete'
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
  | 'users.assign_barrios'
  | 'importador.use'
  | 'importador.view_history'
  | 'dashboard.full'
  | 'dashboard.personal';

export type Role = 'admin' | 'vendedor';

const ADMIN_WILDCARD = '*' as unknown as Permiso;

export const PERMISOS_POR_ROL: Record<Role, Permiso[]> = {
  // admin wildcard — checked via includes('*') in PermisosService
  admin: [ADMIN_WILDCARD],
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
    'dashboard.personal',
  ],
};
