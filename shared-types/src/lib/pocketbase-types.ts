/**
* This file was @generated using pocketbase-typegen
*/

import type PocketBase from 'pocketbase'
import type { RecordService } from 'pocketbase'

export const Collections = {
	Authorigins: "_authOrigins",
	Externalauths: "_externalAuths",
	Mfas: "_mfas",
	Otps: "_otps",
	Superusers: "_superusers",
	Arquitectos: "arquitectos",
	AuditLog: "audit_log",
	Barrios: "barrios",
	ComparativaVistas: "comparativa_vistas",
	Comparativas: "comparativas",
	Config: "config",
	ImportacionFilas: "importacion_filas",
	Importaciones: "importaciones",
	Interesados: "interesados",
	Unidades: "unidades",
	Users: "users",
	VendedorBarrios: "vendedor_barrios",
} as const
export type Collections = typeof Collections[keyof typeof Collections]

// Alias types for improved usability
export type IsoDateString = string
export type IsoAutoDateString = string & { readonly autodate: unique symbol }
export type RecordIdString = string
export type FileNameString = string & { readonly filename: unique symbol }
export type HTMLString = string

type ExpandType<T> = unknown extends T
	? T extends unknown
		? { expand?: unknown }
		: { expand: T }
	: { expand: T }

// System fields
export type BaseSystemFields<T = unknown> = {
	id: RecordIdString
	collectionId: string
	collectionName: Collections
} & ExpandType<T>

export type AuthSystemFields<T = unknown> = {
	email: string
	emailVisibility: boolean
	username: string
	verified: boolean
} & BaseSystemFields<T>

// Record types for each collection

export type AuthoriginsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	fingerprint: string
	id: string
	recordRef: string
	updated: IsoAutoDateString
}

export type ExternalauthsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	provider: string
	providerId: string
	recordRef: string
	updated: IsoAutoDateString
}

export type MfasRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	method: string
	recordRef: string
	updated: IsoAutoDateString
}

export type OtpsRecord = {
	collectionRef: string
	created: IsoAutoDateString
	id: string
	password: string
	recordRef: string
	sentTo?: string
	updated: IsoAutoDateString
}

export type SuperusersRecord = {
	created: IsoAutoDateString
	email: string
	emailVisibility?: boolean
	id: string
	password: string
	tokenKey: string
	updated: IsoAutoDateString
	verified?: boolean
}

export type ArquitectosRecord = {
	email?: string
	id: string
	matricula?: string
	nombre: string
	notas?: HTMLString
	telefono?: string
}

export const AuditLogActionOptions = {
	"create": "create",
	"update": "update",
	"delete": "delete",
} as const
export type AuditLogActionOptions = typeof AuditLogActionOptions[keyof typeof AuditLogActionOptions]
export type AuditLogRecord<Tafter = unknown, Tbefore = unknown> = {
	action: AuditLogActionOptions
	after?: null | Tafter
	before?: null | Tbefore
	collection_name: string
	id: string
	record_id: string
	user_id?: RecordIdString
}

export type BarriosRecord<Textras = unknown> = {
	descripcion?: HTMLString
	destacado?: boolean
	extras?: null | Textras
	id: string
	imagen_portada?: FileNameString
	lat?: number
	lng?: number
	nombre: string
	plano_general?: FileNameString
	slug: string
	ubicacion_texto?: string
}

export type ComparativaVistasRecord = {
	accessed_at?: IsoDateString
	comparativa_id: RecordIdString
	id: string
	ip_hash?: string
	user_agent?: string
}

export const ComparativasTipoOptions = {
	"propuesta_individual": "propuesta_individual",
	"comparacion_multiple": "comparacion_multiple",
} as const
export type ComparativasTipoOptions = typeof ComparativasTipoOptions[keyof typeof ComparativasTipoOptions]
export type ComparativasRecord = {
	cliente_destinatario_email?: string
	cliente_destinatario_nombre?: string
	creado_por: RecordIdString
	expira_en?: IsoDateString
	id: string
	mensaje_personalizado?: HTMLString
	pdf_generado?: FileNameString
	tipo: ComparativasTipoOptions
	titulo: string
	token_publico: string
	unidades_ids: RecordIdString[]
	vistas_count?: number
}

export type ConfigRecord = {
	comparativa_expiracion_default_dias?: number
	email_notif_enabled?: boolean
	id: string
	mensaje_bienvenida_landing?: HTMLString
	responsable_default_id: RecordIdString
	whatsapp_notif_enabled?: boolean
}

export const ImportacionFilasEstadoFilaOptions = {
	"ok": "ok",
	"duplicado": "duplicado",
	"error": "error",
	"advertencia": "advertencia",
} as const
export type ImportacionFilasEstadoFilaOptions = typeof ImportacionFilasEstadoFilaOptions[keyof typeof ImportacionFilasEstadoFilaOptions]

export const ImportacionFilasDecisionUsuarioOptions = {
	"pendiente": "pendiente",
	"omitir": "omitir",
	"crear": "crear",
	"actualizar": "actualizar",
} as const
export type ImportacionFilasDecisionUsuarioOptions = typeof ImportacionFilasDecisionUsuarioOptions[keyof typeof ImportacionFilasDecisionUsuarioOptions]
export type ImportacionFilasRecord<Tdatos_normalizados = unknown, Tdatos_originales = unknown> = {
	aplicada?: boolean
	datos_normalizados?: null | Tdatos_normalizados
	datos_originales?: null | Tdatos_originales
	decision_usuario?: ImportacionFilasDecisionUsuarioOptions
	estado_fila: ImportacionFilasEstadoFilaOptions
	id: string
	importacion_id: RecordIdString
	mensaje?: string
	numero_fila: number
	registro_existente_id?: string
}

export const ImportacionesTipoOptions = {
	"barrios": "barrios",
	"unidades": "unidades",
	"barrios_con_unidades": "barrios_con_unidades",
} as const
export type ImportacionesTipoOptions = typeof ImportacionesTipoOptions[keyof typeof ImportacionesTipoOptions]

export const ImportacionesOrigenOptions = {
	"excel": "excel",
	"api": "api",
} as const
export type ImportacionesOrigenOptions = typeof ImportacionesOrigenOptions[keyof typeof ImportacionesOrigenOptions]

export const ImportacionesEstadoOptions = {
	"analizando": "analizando",
	"listo_para_confirmar": "listo_para_confirmar",
	"confirmada": "confirmada",
	"descartada": "descartada",
	"con_errores": "con_errores",
} as const
export type ImportacionesEstadoOptions = typeof ImportacionesEstadoOptions[keyof typeof ImportacionesEstadoOptions]
export type ImportacionesRecord = {
	archivo_origen?: FileNameString
	confirmada_en?: IsoDateString
	creado_por: RecordIdString
	estado: ImportacionesEstadoOptions
	filas_advertencia?: number
	filas_duplicado?: number
	filas_error?: number
	filas_ok?: number
	id: string
	origen: ImportacionesOrigenOptions
	tipo: ImportacionesTipoOptions
	total_filas?: number
}

export const InteresadosOrigenOptions = {
	"web": "web",
	"manual": "manual",
} as const
export type InteresadosOrigenOptions = typeof InteresadosOrigenOptions[keyof typeof InteresadosOrigenOptions]

export const InteresadosEstadoOptions = {
	"nuevo": "nuevo",
	"contactado": "contactado",
	"reunion": "reunion",
	"oferta": "oferta",
	"cerrado_ganado": "cerrado_ganado",
	"cerrado_perdido": "cerrado_perdido",
} as const
export type InteresadosEstadoOptions = typeof InteresadosEstadoOptions[keyof typeof InteresadosEstadoOptions]

export const InteresadosSyncStatusOptions = {
	"pending": "pending",
	"synced": "synced",
	"error": "error",
} as const
export type InteresadosSyncStatusOptions = typeof InteresadosSyncStatusOptions[keyof typeof InteresadosSyncStatusOptions]
export type InteresadosRecord = {
	comparativa_id?: RecordIdString
	email: string
	estado: InteresadosEstadoOptions
	hubspot_contact_id?: string
	hubspot_deal_id?: string
	id: string
	mensaje?: string
	nombre: string
	notas_internas?: HTMLString
	origen: InteresadosOrigenOptions
	responsable_id?: RecordIdString
	sync_error?: string
	sync_status?: InteresadosSyncStatusOptions
	synced_at?: IsoDateString
	telefono?: string
	unidad_id?: RecordIdString
}

export const UnidadesTipoUnidadOptions = {
	"lote": "lote",
	"casa": "casa",
	"departamento": "departamento",
} as const
export type UnidadesTipoUnidadOptions = typeof UnidadesTipoUnidadOptions[keyof typeof UnidadesTipoUnidadOptions]

export const UnidadesMonedaOptions = {
	"USD": "USD",
	"ARS": "ARS",
} as const
export type UnidadesMonedaOptions = typeof UnidadesMonedaOptions[keyof typeof UnidadesMonedaOptions]

export const UnidadesEstadoOptions = {
	"disponible": "disponible",
	"bloqueado": "bloqueado",
	"reservado": "reservado",
	"sena": "sena",
	"vendido": "vendido",
	"escriturado": "escriturado",
} as const
export type UnidadesEstadoOptions = typeof UnidadesEstadoOptions[keyof typeof UnidadesEstadoOptions]
export type UnidadesRecord = {
	ambientes?: number
	antiguedad_anios?: number
	arquitecto_id?: RecordIdString
	barrio_id?: RecordIdString
	cocheras?: number
	codigo_interno: string
	descripcion?: HTMLString
	destacado?: boolean
	direccion_propia?: string
	estado: UnidadesEstadoOptions
	fecha_bloqueo?: IsoDateString
	fecha_escritura?: IsoDateString
	fecha_ingreso?: IsoDateString
	fecha_reserva?: IsoDateString
	fecha_sena?: IsoDateString
	fecha_venta?: IsoDateString
	galeria?: FileNameString[]
	id: string
	interesado_comprador_id?: RecordIdString
	metros_construidos?: number
	metros_cuadrados: number
	moneda: UnidadesMonedaOptions
	numero_unidad?: string
	oferta?: boolean
	plano_unidad?: FileNameString
	precio: number
	precio_oferta?: number
	responsable_id: RecordIdString
	tipo_unidad: UnidadesTipoUnidadOptions
}

export const UsersRoleOptions = {
	"admin": "admin",
	"vendedor": "vendedor",
} as const
export type UsersRoleOptions = typeof UsersRoleOptions[keyof typeof UsersRoleOptions]

export const UsersLeadsVisibilityOptions = {
	"solo_mios": "solo_mios",
	"mios_mas_sin_asignar": "mios_mas_sin_asignar",
	"todos_mis_barrios": "todos_mis_barrios",
	"todos": "todos",
} as const
export type UsersLeadsVisibilityOptions = typeof UsersLeadsVisibilityOptions[keyof typeof UsersLeadsVisibilityOptions]
export type UsersRecord = {
	activo?: boolean
	avatar?: FileNameString
	created: IsoAutoDateString
	email: string
	emailVisibility?: boolean
	id: string
	leads_visibility?: UsersLeadsVisibilityOptions
	must_change_password?: boolean
	name?: string
	password: string
	role: UsersRoleOptions
	telefono?: string
	tokenKey: string
	updated: IsoAutoDateString
	verified?: boolean
	whatsapp?: string
}

export type VendedorBarriosRecord = {
	barrio_id: RecordIdString
	id: string
	vendedor_id: RecordIdString
}

// Response types include system fields and match responses from the PocketBase API
export type AuthoriginsResponse<Texpand = unknown> = Required<AuthoriginsRecord> & BaseSystemFields<Texpand>
export type ExternalauthsResponse<Texpand = unknown> = Required<ExternalauthsRecord> & BaseSystemFields<Texpand>
export type MfasResponse<Texpand = unknown> = Required<MfasRecord> & BaseSystemFields<Texpand>
export type OtpsResponse<Texpand = unknown> = Required<OtpsRecord> & BaseSystemFields<Texpand>
export type SuperusersResponse<Texpand = unknown> = Required<SuperusersRecord> & AuthSystemFields<Texpand>
export type ArquitectosResponse<Texpand = unknown> = Required<ArquitectosRecord> & BaseSystemFields<Texpand>
export type AuditLogResponse<Tafter = unknown, Tbefore = unknown, Texpand = unknown> = Required<AuditLogRecord<Tafter, Tbefore>> & BaseSystemFields<Texpand>
export type BarriosResponse<Textras = unknown, Texpand = unknown> = Required<BarriosRecord<Textras>> & BaseSystemFields<Texpand>
export type ComparativaVistasResponse<Texpand = unknown> = Required<ComparativaVistasRecord> & BaseSystemFields<Texpand>
export type ComparativasResponse<Texpand = unknown> = Required<ComparativasRecord> & BaseSystemFields<Texpand>
export type ConfigResponse<Texpand = unknown> = Required<ConfigRecord> & BaseSystemFields<Texpand>
export type ImportacionFilasResponse<Tdatos_normalizados = unknown, Tdatos_originales = unknown, Texpand = unknown> = Required<ImportacionFilasRecord<Tdatos_normalizados, Tdatos_originales>> & BaseSystemFields<Texpand>
export type ImportacionesResponse<Texpand = unknown> = Required<ImportacionesRecord> & BaseSystemFields<Texpand>
export type InteresadosResponse<Texpand = unknown> = Required<InteresadosRecord> & BaseSystemFields<Texpand>
export type UnidadesResponse<Texpand = unknown> = Required<UnidadesRecord> & BaseSystemFields<Texpand>
export type UsersResponse<Texpand = unknown> = Required<UsersRecord> & AuthSystemFields<Texpand>
export type VendedorBarriosResponse<Texpand = unknown> = Required<VendedorBarriosRecord> & BaseSystemFields<Texpand>

// Types containing all Records and Responses, useful for creating typing helper functions

export type CollectionRecords = {
	_authOrigins: AuthoriginsRecord
	_externalAuths: ExternalauthsRecord
	_mfas: MfasRecord
	_otps: OtpsRecord
	_superusers: SuperusersRecord
	arquitectos: ArquitectosRecord
	audit_log: AuditLogRecord
	barrios: BarriosRecord
	comparativa_vistas: ComparativaVistasRecord
	comparativas: ComparativasRecord
	config: ConfigRecord
	importacion_filas: ImportacionFilasRecord
	importaciones: ImportacionesRecord
	interesados: InteresadosRecord
	unidades: UnidadesRecord
	users: UsersRecord
	vendedor_barrios: VendedorBarriosRecord
}

export type CollectionResponses = {
	_authOrigins: AuthoriginsResponse
	_externalAuths: ExternalauthsResponse
	_mfas: MfasResponse
	_otps: OtpsResponse
	_superusers: SuperusersResponse
	arquitectos: ArquitectosResponse
	audit_log: AuditLogResponse
	barrios: BarriosResponse
	comparativa_vistas: ComparativaVistasResponse
	comparativas: ComparativasResponse
	config: ConfigResponse
	importacion_filas: ImportacionFilasResponse
	importaciones: ImportacionesResponse
	interesados: InteresadosResponse
	unidades: UnidadesResponse
	users: UsersResponse
	vendedor_barrios: VendedorBarriosResponse
}

// Utility types for create/update operations

type ProcessCreateAndUpdateFields<T> = Omit<{
	// Omit AutoDate fields
	[K in keyof T as Extract<T[K], IsoAutoDateString> extends never ? K : never]: 
		// Convert FileNameString to File
		T[K] extends infer U ? 
			U extends (FileNameString | FileNameString[]) ? 
				U extends any[] ? File[] : File 
			: U
		: never
}, 'id'>

// Create type for Auth collections
export type CreateAuth<T> = {
	id?: RecordIdString
	email: string
	emailVisibility?: boolean
	password: string
	passwordConfirm: string
	verified?: boolean
} & ProcessCreateAndUpdateFields<T>

// Create type for Base collections
export type CreateBase<T> = {
	id?: RecordIdString
} & ProcessCreateAndUpdateFields<T>

// Update type for Auth collections
export type UpdateAuth<T> = Partial<
	Omit<ProcessCreateAndUpdateFields<T>, keyof AuthSystemFields>
> & {
	email?: string
	emailVisibility?: boolean
	oldPassword?: string
	password?: string
	passwordConfirm?: string
	verified?: boolean
}

// Update type for Base collections
export type UpdateBase<T> = Partial<
	Omit<ProcessCreateAndUpdateFields<T>, keyof BaseSystemFields>
>

// Get the correct create type for any collection
export type Create<T extends keyof CollectionResponses> =
	CollectionResponses[T] extends AuthSystemFields
		? CreateAuth<CollectionRecords[T]>
		: CreateBase<CollectionRecords[T]>

// Get the correct update type for any collection
export type Update<T extends keyof CollectionResponses> =
	CollectionResponses[T] extends AuthSystemFields
		? UpdateAuth<CollectionRecords[T]>
		: UpdateBase<CollectionRecords[T]>

// Type for usage with type asserted PocketBase instance
// https://github.com/pocketbase/js-sdk#specify-typescript-definitions

export type TypedPocketBase = {
	collection<T extends keyof CollectionResponses>(
		idOrName: T
	): RecordService<CollectionResponses[T]>
} & PocketBase
