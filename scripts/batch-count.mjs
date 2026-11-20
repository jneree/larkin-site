// Founder batch counter. Run by .github/workflows/batch-count.yml.
// reserved = base + every paid $10 reservation on the Stripe payment link since `since`.
// base, since and size are read from batch.json and kept; only paid, reserved and updated change.
// Needs STRIPE_KEY: a restricted live key with "Checkout Sessions: read" only.
import { readFile, writeFile } from 'node:fs/promises';

const LINK = 'plink_1UKykLHdUP5dvvmEN18O4EXF';   // buy.stripe.com/fZu8wP69373l4bx0uCfYY00
const FILE = new URL('../batch.json', import.meta.url);
const key = process.env.STRIPE_KEY;
if (!key) { console.log('STRIPE_BATCH_KEY secret not set yet: batch.json left as it is.'); process.exit(0); }

const cur = JSON.parse(await readFile(FILE, 'utf8'));
const since = Math.floor(Date.parse(cur.since) / 1000);

let paid = 0, after = null;
do {
  const q = new URLSearchParams({ payment_link: LINK, status: 'complete', 'created[gte]': String(since), limit: '100' });
  if (after) q.set('starting_after', after);
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions?' + q, { headers: { Authorization: 'Bearer ' + key } });
  if (!res.ok) throw new Error('Stripe ' + res.status + ': ' + (await res.text()));
  const page = await res.json();
  paid += page.data.filter((s) => s.payment_status === 'paid').length;   // "unpaid" = bank payment still pending
  after = page.has_more ? page.data[page.data.length - 1].id : null;
} while (after);

const reserved = Math.min(cur.size, cur.base + paid);
if (paid === cur.paid && reserved === cur.reserved) { console.log('no change:', reserved); process.exit(0); }
const next = { ...cur, paid, reserved, updated: new Date().toISOString().replace(/\.\d+Z$/, 'Z') };
await writeFile(FILE, JSON.stringify(next, null, 2) + '\n');
console.log('reserved:', cur.reserved, '->', reserved);
