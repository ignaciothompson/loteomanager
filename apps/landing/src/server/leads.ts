import type { Request, Response } from 'express';
import type PocketBase from 'pocketbase';
import type { ComparativasResponse } from '@loteomanager/shared-types';
import { getPocketBaseClient } from './pocketbase.client';
import { verifyTurnstileToken } from './turnstile';

export type LeadBody = {
  nombre?: unknown;
  email?: unknown;
  telefono?: unknown;
  mensaje?: unknown;
  barrio_id?: unknown;
  unidad_id?: unknown;
  comparativa_id?: unknown;
  website?: unknown;
  'cf-turnstile-response'?: unknown;
};

type LeadCreatePayload = {
  nombre: string;
  email?: string;
  telefono?: string;
  mensaje?: string;
  barrio_id?: string;
  unidad_id?: string;
  comparativa_id?: string;
};

/** Honeypot + Turnstile. Returns true if request should continue. */
export async function passLeadAntiSpam(
  body: LeadBody,
  res: Response,
): Promise<boolean> {
  const token = body['cf-turnstile-response'];
  const secret = process.env['TURNSTILE_SECRET_KEY'];
  const nodeEnv = process.env['NODE_ENV'] ?? 'undefined';

  console.log('[leads] antiSpam start', {
    nodeEnv,
    hasSecret: !!secret,
    token: token ? String(token).slice(0, 24) : null,
    honeypot: body.website ? 'SET' : 'empty',
  });

  if (body.website && String(body.website).length > 0) {
    console.log('[leads] antiSpam honeypot tripped → silent ok');
    res.json({ ok: true });
    return false;
  }

  // Local / non-prod: honeypot only. Turnstile opcional (prod).
  if (!secret || nodeEnv !== 'production') {
    console.log('[leads] antiSpam skip Turnstile (non-prod or no secret)');
    return true;
  }

  if (String(token ?? '') === 'dev-bypass') {
    console.warn('[leads] antiSpam reject dev-bypass in production');
    res.status(400).json({ error: 'Validación fallida' });
    return false;
  }

  if (!token || !(await verifyTurnstileToken(String(token)))) {
    console.warn('[leads] antiSpam Turnstile verify failed');
    res.status(400).json({ error: 'Validación fallida' });
    return false;
  }

  console.log('[leads] antiSpam ok');
  return true;
}

function hasContact(email: unknown, telefono: unknown): boolean {
  return (!!email && String(email).trim().length > 0) || (!!telefono && String(telefono).trim().length > 0);
}

/** Shared create path for POST /api/leads (and aliases). */
export async function handleCreateLead(
  body: LeadBody,
  res: Response,
  opts: {
    /** Alias from-comparativa requires email + comparativa_id. */
    requireEmail?: boolean;
    requireComparativaId?: boolean;
    requireUnidadId?: boolean;
    logTag: string;
  },
): Promise<void> {
  console.log(`[${opts.logTag}] handleCreateLead`, {
    nombre: body.nombre,
    email: body.email ? '(set)' : null,
    telefono: body.telefono ? '(set)' : null,
    barrio_id: body.barrio_id ?? null,
    unidad_id: body.unidad_id ?? null,
    comparativa_id: body.comparativa_id ?? null,
  });

  if (!(await passLeadAntiSpam(body, res))) {
    console.log(`[${opts.logTag}] stopped at antiSpam`);
    return;
  }

  const {
    nombre,
    email,
    telefono,
    mensaje,
    barrio_id,
    unidad_id,
    comparativa_id,
  } = body;

  if (!nombre || String(nombre).trim().length === 0) {
    console.warn(`[${opts.logTag}] missing nombre`);
    res.status(400).json({ error: 'Faltan campos requeridos' });
    return;
  }

  if (opts.requireEmail && !email) {
    console.warn(`[${opts.logTag}] missing email (alias requires it)`);
    res.status(400).json({ error: 'Faltan campos requeridos' });
    return;
  }
  if (opts.requireComparativaId && !comparativa_id) {
    console.warn(`[${opts.logTag}] missing comparativa_id`);
    res.status(400).json({ error: 'Faltan campos requeridos' });
    return;
  }
  if (opts.requireUnidadId && !unidad_id) {
    console.warn(`[${opts.logTag}] missing unidad_id`);
    res.status(400).json({ error: 'Faltan campos requeridos' });
    return;
  }
  if (!opts.requireEmail && !hasContact(email, telefono)) {
    console.warn(`[${opts.logTag}] missing email and telefono`);
    res.status(400).json({ error: 'Faltan campos requeridos' });
    return;
  }

  console.log(`[${opts.logTag}] getting PB client...`);
  const pb = await getPocketBaseClient();
  console.log(`[${opts.logTag}] PB auth valid=`, pb.authStore.isValid);

  try {
    const payload: LeadCreatePayload = {
      nombre: String(nombre),
      email: email ? String(email) : undefined,
      telefono: telefono ? String(telefono) : undefined,
      mensaje: mensaje ? String(mensaje) : undefined,
      barrio_id: barrio_id ? String(barrio_id) : undefined,
      unidad_id: unidad_id ? String(unidad_id) : undefined,
      comparativa_id: comparativa_id ? String(comparativa_id) : undefined,
    };

    if (payload.comparativa_id) {
      const comp = (await pb
        .collection('comparativas')
        .getOne(payload.comparativa_id)) as ComparativasResponse;
      if (comp.expira_en && new Date(comp.expira_en) < new Date()) {
        console.warn(`[${opts.logTag}] comparativa expired`);
        res.status(410).json({ error: 'Comparativa expirada' });
        return;
      }
      if (!payload.unidad_id && comp.unidades_ids?.length === 1) {
        payload.unidad_id = comp.unidades_ids[0];
      }
    }

    const ctxError = await validateLeadContext(pb, payload);
    if (ctxError) {
      console.warn(`[${opts.logTag}] context not_found`, payload);
      res.status(404).json({ error: 'not_found' });
      return;
    }

    console.log(`[${opts.logTag}] creating interesado...`, {
      barrio_id: payload.barrio_id,
      unidad_id: payload.unidad_id,
      comparativa_id: payload.comparativa_id,
    });
    const created = await pb.collection('interesados').create({
      nombre: payload.nombre,
      email: payload.email,
      telefono: payload.telefono,
      mensaje: payload.mensaje,
      barrio_id: payload.barrio_id,
      unidad_id: payload.unidad_id,
      comparativa_id: payload.comparativa_id,
      origen: 'web',
      estado: 'nuevo',
      sync_status: 'pending',
    });
    console.log(`[${opts.logTag}] created id=`, (created as { id?: string }).id);

    res.json({ ok: true, message: 'Gracias, te contactaremos pronto.' });
  } catch (err) {
    console.error(`[${opts.logTag}] create failed`, err);
    res.status(500).json({ error: 'Error interno' });
  }
}

async function validateLeadContext(
  pb: PocketBase,
  payload: LeadCreatePayload,
): Promise<'not_found' | null> {
  if (payload.unidad_id) {
    try {
      const unidad = await pb.collection('unidades').getOne(payload.unidad_id);
      if (!unidad || unidad['web_visible'] === false) return 'not_found';

      const barrioId =
        payload.barrio_id ?? (unidad['barrio_id'] as string | undefined);
      if (barrioId) {
        const barrio = await pb.collection('barrios').getOne(barrioId);
        if (!barrio || barrio['publicado'] !== true) return 'not_found';
        if (!payload.barrio_id) payload.barrio_id = barrioId;
      }
    } catch {
      return 'not_found';
    }
    return null;
  }

  if (payload.barrio_id) {
    try {
      const barrio = await pb.collection('barrios').getOne(payload.barrio_id);
      if (!barrio || barrio['publicado'] !== true) return 'not_found';
    } catch {
      return 'not_found';
    }
  }

  return null;
}

/** Express handler for POST /api/leads */
export async function postLeads(req: Request, res: Response): Promise<void> {
  await handleCreateLead(req.body ?? {}, res, { logTag: 'api/leads' });
}

export async function postLeadsFromComparativa(
  req: Request,
  res: Response,
): Promise<void> {
  await handleCreateLead(req.body ?? {}, res, {
    requireEmail: true,
    requireComparativaId: true,
    logTag: 'api/leads/from-comparativa',
  });
}

export async function postLeadsFromUnidad(
  req: Request,
  res: Response,
): Promise<void> {
  await handleCreateLead(req.body ?? {}, res, {
    requireEmail: true,
    requireUnidadId: true,
    logTag: 'api/leads/from-unidad',
  });
}
