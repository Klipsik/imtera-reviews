import express from 'express';
import { chromium } from 'playwright';
import { parseOrgPage, streamReviewsPage } from './lib/extractors.mjs';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: '1mb' }));

let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browserPromise;
}

function streamTimeoutMs(expectedTotal) {
  const total = Number(expectedTotal) || 400;

  return Math.max(180_000, Math.min(900_000, 120_000 + total * 250));
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/parse/org', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'url is required' });
  }

  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'ru-RU',
  });
  const page = await context.newPage();

  try {
    const data = await parseOrgPage(page, url);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    await context.close();
  }
});

app.post('/parse/reviews/stream', async (req, res) => {
  const { url, expected_total: expectedTotal = null } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'url is required' });
  }

  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'ru-RU',
  });
  const page = await context.newPage();

  let finished = false;

  const writeChunk = (obj) => {
    if (finished) {
      return;
    }

    res.write(`${JSON.stringify(obj)}\n`);
  };

  const timeout = setTimeout(() => {
    if (finished) {
      return;
    }

    writeChunk({ error: 'Превышено время ожидания парсера' });
    finished = true;
    res.end();
    context.close().catch(() => {});
  }, streamTimeoutMs(expectedTotal));

  try {
    const result = await streamReviewsPage(page, url, {
      expectedTotal: expectedTotal ? Number(expectedTotal) : null,
      onBatch: async (reviews) => {
        writeChunk({ type: 'batch', reviews, count: reviews.length });
      },
      onProgress: async (collected, expected) => {
        writeChunk({ type: 'progress', collected, expected });
      },
    });

    writeChunk({
      type: 'done',
      total: result.total,
      expected_total: result.expectedTotal,
      source: result.source,
    });
  } catch (e) {
    writeChunk({ error: e.message });
  } finally {
    finished = true;
    clearTimeout(timeout);
    await context.close().catch(() => {});

    if (!res.writableEnded) {
      res.end();
    }
  }
});

const server = app.listen(PORT, () => {
  console.log(`Parser service listening on :${PORT}`);
});

process.on('SIGTERM', async () => {
  server.close();
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
  }
  process.exit(0);
});
