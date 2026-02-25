import { chromium, type Browser } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// Chrome flags required inside Docker / Railway containers
const LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage', // prevents /dev/shm OOM in constrained containers
  '--disable-gpu',
];

let _browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!_browser || !_browser.isConnected()) {
    _browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });
  }
  return _browser;
}

/**
 * Fetch the fully JS-rendered HTML of a page using a shared Chromium instance.
 * Opens a fresh page per call (isolated), then closes it.
 * Writes a snapshot of the last rendered page to logs/playwright-latest.html
 * so you can open it in a browser to inspect what Playwright actually sees.
 */
export async function getRenderedHtml(url: string): Promise<string> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  const t0 = Date.now();
  console.log(`  [playwright] → ${url}`);

  try {
    // 'domcontentloaded' fires as soon as the HTML shell is parsed (near-instant
    // for SPAs). We then give the JS framework 3 s to execute and render.
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    console.log(`  [playwright] domcontentloaded in ${Date.now() - t0} ms | HTTP ${response?.status() ?? '?'}`);

    await page.waitForTimeout(3_000);

    const title = await page.title();
    // String-form evaluate runs in browser context; avoids DOM lib requirement in tsconfig
    const bodyPreview = await page.evaluate(
      `(document.body?.innerText ?? '').replace(/\\s+/g, ' ').trim().slice(0, 400)`,
    ) as string;
    const html = await page.content();

    console.log(`  [playwright] +3 s | title: "${title}" | HTML: ${html.length} bytes`);
    console.log(`  [playwright] body text preview: ${bodyPreview || '(empty)'}`);

    // Save snapshot so you can open logs/playwright-latest.html to inspect
    try {
      const logsDir = join(__dirname, '../../../../logs');
      mkdirSync(logsDir, { recursive: true });
      writeFileSync(join(logsDir, 'playwright-latest.html'), html);
    } catch { /* non-fatal */ }

    return html;
  } catch (err) {
    console.log(`  [playwright] FAILED after ${Date.now() - t0} ms: ${(err as Error).message.split('\n')[0]}`);
    throw err;
  } finally {
    await page.close();
  }
}

/**
 * Close the shared browser. Call this at the end of each pipeline run.
 * Safe to call even if no JS rendering was done.
 */
export async function closeBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close();
    _browser = null;
  }
}
