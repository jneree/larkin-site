# Larkin — landing page

A responsive, static landing page built from your Figma design, ready to go live on GitHub Pages and connect to Shopify for pre-orders.

Everything is plain HTML/CSS — no build step. The whole `larkin-site/` folder is the website.

```
larkin-site/
├── index.html      ← the page (copy + structure)
├── styles.css      ← all styling (colors, spacing, responsive rules)
├── assets/         ← all images/icons
├── .nojekyll       ← tells GitHub Pages to serve files as-is (don't delete)
└── README.md       ← this file
```

---

## 3 things you MUST fill in before launch

All three are marked with clear comments at the top of `index.html`.

1. **Facebook Pixel** — in `index.html`, find `YOUR_PIXEL_ID` (2 places) and replace with your Pixel ID from Meta Events Manager.
2. **Shopify Buy Button** — in the `#preorder` section, replace `<div id="product-component-XXXX"></div>` with the embed code Shopify gives you (see below).
3. **Fallback checkout link** — in the same section, replace `YOUR-STORE.myshopify.com` and `VARIANT_ID` so the "Pre-order now" button works even before the embed is pasted.

---

## Step 1 — Put it on GitHub and go live (GitHub Pages)

**Easiest path (no git knowledge needed):**

1. On github.com, create a new repository (Public), e.g. `larkin-site`.
2. On the repo page, click **Add file → Upload files**, then drag in the *contents* of the `larkin-site` folder (the `index.html`, `styles.css`, `assets/` folder, and `.nojekyll`). Commit.
3. Go to **Settings → Pages**. Under "Build and deployment", set Source = **Deploy from a branch**, Branch = **main**, folder = **/ (root)**. Save.
4. Wait ~1–2 minutes. Your live URL appears at the top of that Pages screen: `https://<your-username>.github.io/larkin-site/`.

**For ongoing edits + your friend collaborating + versions:** install **GitHub Desktop** (desktop.github.com), clone the repo, and edit files locally. This gives you version history and lets a friend contribute (see Step 4).

---

## Step 2 — Shopify pre-order + Buy Button

1. In Shopify admin: **Products → Add product**. Set title (Larkin Wristband), price ($59), image.
2. Make it a pre-order: on the variant, check **"Continue selling when out of stock"** and set inventory to 0. (Optional: install a pre-order app so the button reads "Pre-order" and shows the ship date.)
3. Add the **Buy Button** sales channel: **Settings → Apps and sales channels → Shopify App Store → search "Buy Button" → add**.
4. **Buy Button channel → Create a Buy Button → Product → select Larkin → Next**. Copy the generated embed code.
5. Paste it over `<div id="product-component-XXXX"></div>` in `index.html`. Clicking it opens Shopify's secure checkout.

> Shopify owns the checkout and payment — you never handle card data. The website just hands the buyer to Shopify.

---

## Step 3 — Facebook Pixel (two places)

1. In **Meta Events Manager**, create a Pixel and copy its ID.
2. Put it in `index.html` (replace `YOUR_PIXEL_ID`, 2 places). This tracks PageView, and you can add `fbq('track', ...)` on the pre-order button for add-to-cart.
3. **The purchase event happens on Shopify's checkout**, not your page — so also connect the **Meta (Facebook & Instagram) sales channel** in Shopify and link the same Pixel there. Without this, you'll see visits but not completed sales.

---

## Step 4 — Let a friend edit the site

In your GitHub repo: **Settings → Collaborators → Add people** and invite them by username. They can then clone it in GitHub Desktop and push changes.

## Making new versions / iterations

Use **branches**. In GitHub Desktop: Branch → New Branch (e.g. `v2-hero-test`), make changes, and you keep the original `main` intact. This is also where switching to **Vercel** later pays off — Vercel gives every branch its own preview URL automatically, so you can see a new version live before merging it.

---

## Notes on what was changed from the raw Figma export

The page was rebuilt (not pixel-exported) for a clean, maintainable, responsive result: consistent spacing scale, fluid `clamp()` typography, a centered max-width container instead of fixed 1440px positions, mobile-first breakpoints so everything stacks cleanly on phones, lazy-loaded images with alt text, and accessible focus/contrast. Ship date was standardized to **Q1 2027** (the Figma had two conflicting dates).
