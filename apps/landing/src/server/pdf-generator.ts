/**
 * Generates a PDF for a comparativa page using Playwright (dynamic import — server only).
 * Resource cost: ~1-2s CPU + ~200MB RAM per generation.
 */
export async function generarPdfComparativa(token: string): Promise<Buffer> {
  // Dynamic import avoids bundling playwright into the Angular build
  const { chromium } = await import('playwright');
  const baseUrl = process.env['PUBLIC_BASE_URL'] ?? 'http://localhost:4000';
  const url = `${baseUrl}/c/${token}?pdf=1`;

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForLoadState('networkidle');

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', bottom: '15mm', left: '10mm', right: '10mm' },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
