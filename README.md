# larkin-site

Static landing site for **Larkin**, the AI memory wristband. Served by GitHub Pages from `main` at **https://getlarkin.com**.

## The homepage is the V5 design (live since 7 October 2026)

`index.html` now links `v5.css` and `v5.js` at the root; `larkin.css`/`larkin.js` stay for `/how-it-works/` and `/v4/`. The same design is kept at `v5/` (`index.html`, `v5.css`, `v5.js`), sharing the root `/media/` and `/fonts/`. Same copy, headline and brand system as `/`; the finish is turned up: an ink curtain with the wordmark that lifts off the hero film (once per visit), the headline rising line by line, the film shrinking into a card as you scroll, the read-along statement on ink with the key phrase turning lime, a pinned close-up of the module scrubbed by scroll (39 frames cut from the hero film's 4K master into `media/ring/`, landscape plus a portrait crop for phones), hairline section rules with their index, spec numbers that count themselves in, grain on the dark surfaces, and the wordmark as a full-width signature in the footer. `noindex`, disallowed in `robots.txt`; its checkout links carry `client_reference_id=v5`.

## 2026 redesign (branch `redesign`)

The homepage is rebuilt for the new band and the new app, in the app's own design language: DM Sans, white canvas, `#151515` ink and feature cards, `#F0F0F0` cards, lime `#DEFA55` for the one thing to press.

- `index.html` — the new homepage, same storyline as before: hero film → read-along statement → how it works → the app (Chronicles, Day, Insights, Topics, Mirror) → use cases → privacy → reserve → compare → the device and specs → FAQ.
- `larkin.css`, `larkin.js` — its styles and progressive enhancement. The hero film plays once over its own last frame, and the copy flips between ink and white with the footage (dark from 0.7 s to 5.1 s, measured from `media/hero-*.mp4`: re-measure if the film changes). In the read-along statement, a lime highlighter sweeps across the phrase in `<mark class="marker">` once the reading reaches it.
- `media/` — the new photos, app screenshots and hero film (1080p and 720p H.264, no audio), each image as `.webp` with a `.jpg` fallback.
- Hero loading: the film is requested as soon as `larkin.js` runs, not after the load event. Portrait screens get `media/hero-0928-phone.mp4` (a 720×1080 crop around the wrist, 1.5 MB) and `hero-0928-poster-phone.webp`; wide screens get 1080p (720p below 1100 px or on save-data). DM Sans is self-hosted in `fonts/` because the Google Fonts stylesheet blocked first paint. On a simulated 4G connection the film starts about 0.5 s after opening, down from about 9 s.

The audience pages (`leaders/`, `adhd/`, `parents/`, `journal/`), `thanks/` and `404.html` still use the older `styles.css` and `site.js` below until they move over.

## Structure

Three audience-targeted pages sharing one poster-style design system:

| Path | File | Audience | Palette |
|---|---|---|---|
| `/` | `index.html` | general | cobalt `#1B44E5` |
| `/adhd/` | `adhd/index.html` | ADHD | coral `#F0402F` |
| `/parents/` | `parents/index.html` | parents | leaf `#9CC17B` |

- `styles.css` — the whole design system, shared by all three pages
- `site.js` — progressive enhancement only (nav disclosure, sticky-header state, checkout tracking)
- `assets/` — shared images, each as `.avif` + `.jpg` at several widths
- `favicon.svg`, `404.html`, `CNAME`, `robots.txt`, `sitemap.xml`

No build step, no framework. Type is Anton (display) + DM Sans (body) from Google Fonts; ADHD adds Knewave, parents adds Newsreader italic.

## How theming works

Each page sets `data-theme` on `<html>` (`general` / `adhd` / `parents`). `styles.css` defines one custom-property block per theme — `--hero-field`, `--piles-rule`, `--res-cta-bg` and so on — and every rule below reads those. **The three pages share one class vocabulary and differ only in `data-theme` and their copy.** To restyle a section across all three audiences, edit the rule once; to change one audience's colour, edit that theme block.

## Responsive

Mobile-first, real breakpoints — no fixed-width viewport. Verified with no horizontal overflow at 390 / 500 / 768 / 900 / 1440px.

- **600px** — brand tagline appears
- **700px** — three piles go 3-up
- **900px** — desktop nav replaces the disclosure menu; hero becomes the overlay composition; `#how` becomes the 2×2×2 checkerboard; stats go 4-up
- **1000px** — features card sits beside its grid; reserve gallery moves alongside the copy

Below 900px the hero stacks photo-over-copy and `#how` alternates copy/photo so two photos never sit together. The hero is `clamp(560px, 75vw, 1080px)` tall, so it reproduces the approved 1440×1080 composition exactly at the design width.

Fluid type uses `clamp()` throughout, with each maximum matching the approved 1440px value.

## Performance

Images are served as AVIF with a JPEG fallback via `<picture>`, at multiple widths with `srcset`/`sizes`. A 390px phone downloads roughly **150KB of imagery for the whole page** — the hero alone used to be 1.79MB. Hero images are preloaded with `fetchpriority="high"`; everything below the fold is `loading="lazy"` with explicit `width`/`height` to avoid layout shift.

Two notes for anyone touching `assets/`: `<source>` is given `display: none` in the stylesheet because `picture { display: contents }` would otherwise let it consume a grid cell, and `overflow-x` on `body` is `clip` rather than `hidden` because `hidden` silently breaks the sticky header.

## Section order (identical on all three pages)

Header → hero (1080px, full-bleed audience photo) → "Nothing to press" strip → three piles → how it works (`#how`, 2×2×2 checkerboard) → features → hardware (`#hardware`) → statement band → reserve (`#reserve`) → footer.

## Checkout

All three reserve CTAs point at the Shopify cart permalink:

```
https://getlarkin.myshopify.com/cart/48311739383947:1
```

Planned: swap to a **distinct Stripe Payment Link per segment page**, so conversion is attributable per audience.

## Tracking

Meta Pixel `1033614279315561` fires `PageView` on all three pages, and `site.js` fires
`InitiateCheckout` on any click through to Shopify, tagged with `content_category` =
the page's segment. That is what makes the three audiences distinguishable in Meta
reporting while they share one checkout URL.

`InitiateCheckout` deliberately sends **no** `value`/`currency` — see below.

## Known gaps

- **Checkout currency is SGD while the pages say "$10".** Four things must agree before
  ads run: on-page copy, the Shopify market, the pixel's `currency`, and any future
  `Offer` structured data. Until then `site.js` omits value/currency rather than
  reporting a figure that does not match the charge.
- **The header and hero CTAs scroll to `#reserve`; only the reserve CTA leaves for
  Shopify.** That is the approved design, but on mobile `#reserve` is many screens down.
  Worth an A/B test against sending them straight to checkout.
- **JSON-LD is `Organization` only.** `Product`/`Offer` markup is deliberately omitted
  until the currency question is settled, so the page never publishes a price that
  disagrees with the charge.
- Fonts still load from Google. Self-hosting would remove two external origins and one
  render-blocking stylesheet from the critical path.
- Hero source images are 1200×896, so they upscale slightly on wide desktop displays.

## History

The previous blue/navy single-page design is preserved on the `old-blue-site` branch.
