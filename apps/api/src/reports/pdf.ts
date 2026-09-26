import { chromium, type Browser } from 'playwright-core';

/**
 * Server-side PDF rendering with Chromium (Playwright). Chromium shapes Urdu (Nastaliq) correctly,
 * which PDF libraries without a shaping engine do not. In production the worker image installs
 * Chromium; locally, set PDF_BROWSER_CHANNEL=msedge or chrome, or PDF_BROWSER_PATH.
 */
export class PdfRenderer {
  private browser: Promise<Browser> | null = null;

  constructor(private readonly options: { channel?: string; executablePath?: string }) {}

  private launch() {
    this.browser ??= chromium
      .launch({
        headless: true,
        channel: this.options.channel,
        executablePath: this.options.executablePath,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      })
      .catch((e) => {
        this.browser = null;
        throw new Error(`PDF rendering is unavailable: ${e instanceof Error ? e.message : String(e)}`);
      });
    return this.browser;
  }

  async render(html: string, options: { landscape?: boolean } = {}): Promise<Buffer> {
    const browser = await this.launch();
    const context = await browser.newContext({ javaScriptEnabled: true });
    try {
      const page = await context.newPage();
      await page.setContent(html, { waitUntil: 'networkidle', timeout: 60_000 });
      // Wait for web fonts (Urdu Nastaliq) before printing. Runs in the page, so the DOM global exists there.
      await page.evaluate('document.fonts.ready.then(() => true)');
      const pdf = await page.pdf({
        format: 'A4',
        landscape: options.landscape ?? false,
        printBackground: true,
        margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' },
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate:
          '<div style="font-size:8px;width:100%;text-align:center;color:#666"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      });
      return Buffer.from(pdf);
    } finally {
      await context.close();
    }
  }

  async close() {
    if (this.browser) {
      const b = await this.browser.catch(() => null);
      this.browser = null;
      await b?.close();
    }
  }
}
