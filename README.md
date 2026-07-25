# larkin-site

Static landing site for **Larkin**, the AI memory wristband. Served by GitHub Pages from `main` at **https://getlarkin.com**.

## Structure

Three audience-targeted pages sharing one poster-style design system:

| Path | File | Audience | Palette |
|---|---|---|---|
| `/` | `index.html` | general | cobalt `#1B44E5` |
| `/adhd/` | `adhd/index.html` | ADHD | coral `#F0402F` |
| `/parents/` | `parents/index.html` | parents | leaf `#9CC17B` |

- `assets/` — shared images (heroes, product renders, lifestyle photography)
- `CNAME` — custom domain (`getlarkin.com`)
- `robots.txt`, `sitemap.xml`

No build step, no framework. Styles are inline; type is Anton (display) + DM Sans (body), loaded from Google Fonts. ADHD adds Knewave, parents adds Newsreader italic.

## Section order (identical on all three pages)

Header → hero (1080px, full-bleed audience photo) → "Nothing to press" strip → three piles → how it works (`#how`, 2×2×2 checkerboard) → features → hardware (`#hardware`) → statement band → reserve (`#reserve`) → footer.

## Checkout

All three reserve CTAs point at the Shopify cart permalink:

```
https://getlarkin.myshopify.com/cart/48311739383947:1
```

Planned: swap to a **distinct Stripe Payment Link per segment page**, so conversion is attributable per audience.

## Tracking

Meta Pixel `1033614279315561` fires `PageView` on all three pages.

## Known gaps

- **Not responsive yet.** Pages are authored at a fixed 1440px; `<meta name="viewport" content="width=1440">` scales the layout down on mobile as a stopgap. Real breakpoints still to be implemented (heroes stack, checkerboard collapses to one column, stat row 4→2, statement type ~50%, gallery becomes a horizontal scroller).
- Checkout currency is SGD; page copy says "$10".

## History

The previous blue/navy single-page design is preserved on the `old-blue-site` branch.
