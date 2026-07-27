import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPocketBaseClient } from './server/pocketbase.client';
import { hashIp } from './server/ip-hash';
import { buildSnapshot } from './server/snapshot-builder';
import {
  postLeads,
  postLeadsFromComparativa,
  postLeadsFromUnidad,
} from './server/leads';
import type {
  BarrioWebSnapshot,
  BarriosResponse,
  ComparativasResponse,
  ComparativaSnapshot,
  ConfigResponse,
} from '@loteomanager/shared-types';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const app = express();
app.use(express.json());

app.get('/healthz', (_req, res) => {
  res.status(200).send('ok');
});

// ── /api/config-publica ──────────────────────────────────────────────────────
app.get('/api/config-publica', async (_req, res) => {
  const fallback = {
    nombreInmobiliaria: process.env['INMOBILIARIA_NOMBRE'] ?? 'LoteoManager',
    logoUrl: process.env['LOGO_URL'] ?? process.env['INMOBILIARIA_LOGO_URL'] ?? null,
    mensajeBienvenida: null as string | null,
    turnstileSiteKey: process.env['TURNSTILE_SITE_KEY'] ?? null,
  };

  try {
    const pb = await getPocketBaseClient();
    const config = await pb.collection('config').getFirstListItem('') as ConfigResponse;
    res.json({
      nombreInmobiliaria: config.nombre_inmobiliaria || fallback.nombreInmobiliaria,
      logoUrl: config.logo_url || fallback.logoUrl,
      mensajeBienvenida: config.mensaje_bienvenida_landing || fallback.mensajeBienvenida,
      turnstileSiteKey: fallback.turnstileSiteKey,
    });
  } catch (err) {
    console.error('[api/config-publica]', err);
    res.json(fallback);
  }
});

// ── /api/catalogo/meta ───────────────────────────────────────────────────────
// Permite a la landing detectar nuevas publicaciones sin recargar manualmente.
app.get('/api/catalogo/meta', async (_req, res) => {
  try {
    const pb = await getPocketBaseClient();
    const result = await pb.collection('barrios').getList(1, 1, {
      filter: 'publicado = true',
      sort: '-publicado_at',
      fields: 'publicado_at',
    });
    const lastPublishedAt = (result.items[0]?.['publicado_at'] as string | undefined) ?? null;
    res.json({ lastPublishedAt });
  } catch (err) {
    console.error('[api/catalogo/meta]', err);
    res.json({ lastPublishedAt: null });
  }
});

// ── /api/catalogo/barrios ────────────────────────────────────────────────────
// Catálogo público derivado del snapshot ya publicado — evita exponer PB directo al browser.
app.get('/api/catalogo/barrios', async (_req, res) => {
  try {
    const pb = await getPocketBaseClient();
    const pbUrl = resolvePublicPbUrl();
    const barrios = await pb.collection('barrios').getFullList({
      filter: 'publicado = true',
      sort: 'nombre',
    }) as BarriosResponse[];

    const catalogo = barrios
      .map((b) => buildCatalogoBarrio(b, pbUrl))
      .filter((b): b is NonNullable<typeof b> => b != null);

    res.json({ barrios: catalogo });
  } catch (err) {
    console.error('[api/catalogo/barrios]', err);
    res.status(500).json({ error: 'internal' });
  }
});

// Inyecta site key pública en runtime (Docker / SSR con env).
app.get('/env.js', (_req, res) => {
  const pbUrl =
    process.env['POCKETBASE_PUBLIC_URL'] ??
    process.env['POCKETBASE_URL'] ??
    'http://localhost:8090';
  const turnstile = process.env['TURNSTILE_SITE_KEY'] ?? '';
  res.type('application/javascript');
  res.send(`window.__env = window.__env || {};
window.__env.POCKETBASE_URL = window.__env.POCKETBASE_URL || ${JSON.stringify(pbUrl)};
window.__env.TURNSTILE_SITE_KEY = window.__env.TURNSTILE_SITE_KEY || ${JSON.stringify(turnstile)};
`);
});

// ── /api/comparativas/:token ─────────────────────────────────────────────────
app.get('/api/comparativas/:token', async (req, res) => {
  const { token } = req.params;
  const pb = await getPocketBaseClient();
  // URL pública del PB para que las URLs de archivos del snapshot las pueda
  // resolver el browser. Si no está seteada, fallback a la interna (asume
  // que el deploy expone PB en la misma red que el browser, p.ej. dev).
  const pbUrl =
    process.env['POCKETBASE_PUBLIC_URL'] ??
    process.env['PB_INTERNAL_URL'] ??
    process.env['POCKETBASE_URL'] ??
    'http://localhost:8090';

  try {
    const comp = await pb.collection('comparativas').getFirstListItem(
      `token_publico = "${token}"`,
    ) as ComparativasResponse;

    if (comp.expira_en && new Date(comp.expira_en) < new Date()) {
      return res.status(410).json({ error: 'expirada' });
    }

    // Use stored snapshot only if it's in the current format (has 'unidades[].codigoInterno').
    // Old snapshots use snake_case keys from a previous admin implementation — rebuild live.
    const storedSnap = comp.contenido_snapshot as ComparativaSnapshot | null;
    const snapIsValid =
      storedSnap != null &&
      Array.isArray(storedSnap.unidades) &&
      storedSnap.unidades.every(u => u.codigoInterno !== undefined);

    let snapshot: ComparativaSnapshot;
    if (snapIsValid && storedSnap) {
      snapshot = storedSnap;
    } else {
      snapshot = await buildLiveSnapshot(comp, pb, pbUrl);
    }

    return res.json({ comparativa: comp, snapshot });
  } catch (err: unknown) {
    const code = (err as { status?: number })?.status;
    if (code === 404) {
      return res.status(404).json({ error: 'not_found' });
    }
    console.error('[api/comparativas/:token]', err);
    return res.status(500).json({ error: 'internal' });
  }
});

// ── /api/leads (genérico) + alias retrocompatibles ───────────────────────────
app.post('/api/leads', postLeads);
app.post('/api/leads/from-comparativa', postLeadsFromComparativa);
app.post('/api/leads/from-unidad', postLeadsFromUnidad);

// ── /api/comparativas/:token/pdf ─────────────────────────────────────────────
app.get('/api/comparativas/:token/pdf', async (req, res) => {
  const { token } = req.params;
  const pb = await getPocketBaseClient();

  try {
    const comp = await pb.collection('comparativas').getFirstListItem(
      `token_publico = "${token}"`,
    ) as ComparativasResponse;

    if (comp.expira_en && new Date(comp.expira_en) < new Date()) {
      return res.status(410).json({ error: 'Comparativa expirada' });
    }

    // Use cached PDF if available and comparativa hasn't been updated since
    if (comp.pdf_generado) {
      // Fetch server-side, así que usamos la URL interna preferentemente.
      const pbUrl =
        process.env['PB_INTERNAL_URL'] ??
        process.env['POCKETBASE_PUBLIC_URL'] ??
        process.env['POCKETBASE_URL'] ??
        'http://localhost:8090';
      const pdfUrl = `${pbUrl}/api/files/comparativas/${comp.id}/${comp.pdf_generado}`;
      const cached = await fetch(pdfUrl);
      if (cached.ok) {
        const buf = await cached.arrayBuffer();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="propuesta-${token}.pdf"`);
        return res.send(Buffer.from(buf));
      }
    }

    // Generate fresh PDF
    // Playwright is NOT bundled by Angular's esbuild. pdf-generator.ts
    // must be compiled separately (tsc) and available at runtime.
    // In Docker: COPY --from=builder the compiled file + npx playwright install chromium.
    // For local dev: compile with `tsc --module nodenext --target es2022 pdf-generator.ts`
    // and run with: node dist/server/pdf-generator.js (used as lib via require).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfModule = await (Function('m', 'return import(m)') as (m: string) => Promise<any>)(
      './server/pdf-generator.js'
    );
    const pdfBuffer: Buffer = await pdfModule.generarPdfComparativa(token);

    // Cache in PocketBase as file upload
    try {
      const formData = new FormData();
      const blob = new Blob([pdfBuffer.buffer as ArrayBuffer], { type: 'application/pdf' });
      formData.append('pdf_generado', blob, `propuesta-${token}.pdf`);
      await pb.collection('comparativas').update(comp.id, formData);
    } catch (cacheErr) {
      console.error('[pdf/cache]', cacheErr);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="propuesta-${token}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err: unknown) {
    const code = (err as { status?: number })?.status;
    if (code === 404) return res.status(404).json({ error: 'not_found' });
    console.error('[api/comparativas/:token/pdf]', err);
    return res.status(500).json({ error: 'PDF generation failed' });
  }
});

// ── /sitemap.xml ─────────────────────────────────────────────────────────────
app.get('/sitemap.xml', async (_req, res) => {
  const base = process.env['PUBLIC_BASE_URL'] ?? 'https://loteomanager.com';
  const now = new Date().toISOString();

  let barrioUrls = '';
  let loteUrls = '';

  try {
    const pb = await getPocketBaseClient();
    const barrios = await pb.collection('barrios').getFullList({
      filter: 'publicado = true',
      fields: 'id,slug,updated,snapshot',
    });
    const withSnap = barrios.filter((b) => b['snapshot'] != null);
    barrioUrls = withSnap
      .map((b) => `  <url>
    <loc>${base}/barrios/${b['slug']}</loc>
    <lastmod>${now}</lastmod>
    <priority>0.8</priority>
  </url>`)
      .join('\n');

    const loteLocs: string[] = [];
    for (const b of withSnap) {
      const snap = b['snapshot'] as { unidades?: Array<{ id: string }> } | null;
      for (const u of snap?.unidades ?? []) {
        if (!u?.id) continue;
        loteLocs.push(`  <url>
    <loc>${base}/lotes/${u.id}</loc>
    <lastmod>${now}</lastmod>
    <priority>0.6</priority>
  </url>`);
      }
    }
    loteUrls = loteLocs.join('\n');
  } catch (err) {
    console.error('[sitemap.xml]', err);
  }

  res.type('text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${base}/</loc>
    <lastmod>${now}</lastmod>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${base}/contacto</loc>
    <lastmod>${now}</lastmod>
    <priority>0.7</priority>
  </url>
${barrioUrls}
${loteUrls}
</urlset>`);
});

// ── /robots.txt ──────────────────────────────────────────────────────────────
app.get('/robots.txt', (_req, res) => {
  const base = process.env['PUBLIC_BASE_URL'] ?? 'https://loteomanager.com';
  res.type('text/plain');
  res.send(`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml`);
});

// ── Static files ─────────────────────────────────────────────────────────────
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

// ── Angular SSR ──────────────────────────────────────────────────────────────
const angularApp = new AngularNodeAppEngine();

app.use('/**', async (req, res, next) => {
  const isPdfMode = req.query['pdf'] === '1';

  // Track view for comparativa pages (skip PDF renders)
  if (!isPdfMode && req.path.startsWith('/c/')) {
    const token = req.path.split('/c/')[1]?.split('/')[0];
    if (token) {
      trackView(token, req.ip, req.headers['user-agent']).catch(err =>
        console.error('[tracking]', err),
      );
    }
  }

  angularApp
    .handle(req)
    .then(response =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function resolvePublicPbUrl(): string {
  return (
    process.env['POCKETBASE_PUBLIC_URL'] ??
    process.env['PB_INTERNAL_URL'] ??
    process.env['POCKETBASE_URL'] ??
    'http://localhost:8090'
  );
}

/** Deriva el card de catálogo (id/nombre/slug/stats) del snapshot congelado de un barrio. */
function buildCatalogoBarrio(b: BarriosResponse, pbUrl: string) {
  const snap = b.snapshot as BarrioWebSnapshot | null;
  if (!snap || !Array.isArray(snap.unidades)) return null;

  const disponibles = snap.unidades.filter((u) => u.estado === 'disponible');
  let precioDesde: number | null = null;
  let moneda: string | null = null;
  let areaMin: number | null = null;
  let areaMax: number | null = null;
  for (const u of disponibles) {
    if (u.precio != null && (precioDesde == null || u.precio < precioDesde)) {
      precioDesde = u.precio;
      moneda = u.moneda ?? 'USD';
    }
    if (u.area != null) {
      areaMin = areaMin == null ? u.area : Math.min(areaMin, u.area);
      areaMax = areaMax == null ? u.area : Math.max(areaMax, u.area);
    }
  }

  const imagen = snap.barrio.imagen_portada ?? b.imagen_portada ?? null;

  return {
    id: b.id,
    nombre: snap.barrio.nombre || b.nombre,
    slug: snap.barrio.slug || b.slug,
    ubicacionTexto: snap.barrio.ubicacion_texto ?? b.ubicacion_texto ?? null,
    imagenPortadaUrl: imagen ? `${pbUrl}/api/files/barrios/${b.id}/${imagen}` : null,
    lat: snap.barrio.lat ?? b.lat ?? null,
    lng: snap.barrio.lng ?? b.lng ?? null,
    stats: {
      unidadesCount: disponibles.length,
      precioDesde,
      moneda,
      areaMin,
      areaMax,
    },
  };
}

async function buildLiveSnapshot(
  comp: ComparativasResponse,
  pb: Awaited<ReturnType<typeof getPocketBaseClient>>,
  pbUrl: string,
): Promise<ComparativaSnapshot> {
  if (!comp.unidades_ids?.length) {
    return buildSnapshot(comp, [], new Map(), pbUrl);
  }

  const idsFilter = comp.unidades_ids.map(id => `id = "${id}"`).join(' || ');
  const unidades = await pb.collection('unidades').getFullList({ filter: idsFilter });

  const barrioIds = [...new Set(unidades.map(u => u.barrio_id).filter((id): id is string => Boolean(id)))];
  const barriosMap = new Map<string, BarriosResponse>();

  if (barrioIds.length) {
    const bFilter = barrioIds.map(id => `id = "${id}"`).join(' || ');
    const barrios = await pb.collection('barrios').getFullList({ filter: bFilter }) as BarriosResponse[];
    barrios.forEach(b => barriosMap.set(b.id, b));
  }

  return buildSnapshot(comp, unidades, barriosMap, pbUrl);
}

async function trackView(token: string, ip: string | undefined, userAgent: string | undefined) {
  const pb = await getPocketBaseClient();
  try {
    const comp = await pb.collection('comparativas').getFirstListItem(`token_publico = "${token}"`);
    await Promise.all([
      pb.collection('comparativa_vistas').create({
        comparativa_id: comp.id,
        ip_hash: hashIp(ip),
        user_agent: userAgent ?? '',
        accessed_at: new Date().toISOString(),
      }),
      pb.collection('comparativas').update(comp.id, {
        vistas_count: (comp.vistas_count ?? 0) + 1,
      }),
    ]);
  } catch {
    // Non-critical — don't propagate
  }
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
