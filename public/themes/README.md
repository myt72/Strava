# Themes

Default lives in `public/styles.css` and is never edited for a theme. Every other theme is one CSS file in this folder, registered in `THEMES` in `themes.js` and loaded by `applyTheme()`. Default is the only theme with the light/dark toggle.

## Rules

- Every selector is scoped under `body[data-theme="<id>"]`.
- Each theme overrides the same CSS variables Default uses (`--bg-2`, `--surface*`, `--text*`, `--border`, `--accent*`, `--distance`, `--time`, `--elevation`, `--danger`, `--success`, `--warning`, `--shadow*`, `--radius*`, `--glass`) and also overrides hard-coded colors in `styles.css` (tone gradients, `.menu-trigger`, `.segmented-btn.active`, `.bar-fill`, `.stack-list-fill`, `.annual-strip-fill`, `.hero-main::before`, `.brand-orb`, `.kpi-card::after`, `.spinner-wheel`) so Default colors never leak.
- Same markup and data in every theme. Do not hide filters, charts, records, bikes or the advanced actions dropdown.
- Charts: `.timeline-bar-value/label`, `.annual-strip-top/label/sub` and `.bar-value/label` get explicit colors with at least 4.5:1 contrast on `--surface-muted`. Never put a gradient on `.timeline-bars-wrap.tone-*` (it sits behind the text); style `.timeline-bar-fill` instead.
- CSS only (gradients, pseudo-elements, inline SVG data URIs), system font stacks with fallbacks, animations wrapped in `prefers-reduced-motion: no-preference`.
- Themes are self-contained. Share a file only between specific themes, and never load it for Default.
- Decorative DOM, if ever needed, must carry `data-theme-decor` so `applyTheme()` removes it on switch.

## Adding a theme

1. Create `themes/<id>.css`.
2. Add it to `THEMES` in `themes.js` with a `group` index (into `THEME_GROUPS`).
3. Add it to the list below.

## Themes

Default (first in the picker)

**Sci-Fi / Retro-Tech**: `lcars`, `cyberpunk` (neon-cyberpunk.css), `synthwave`, `aero-instrumentation`, `green-terminal`, `blueprint`, `hud`, `anime-hud`, `sharper-image`, `retro-os`

**Editorial / Minimal**: `ft-salmon`, `swiss-minimal`, `nyt-data`, `nord`

**Print / Vintage**: `googie`, `vintage-cartoon`, `ledger-1920s`, `pulp-tabloid`, `yellow-pages`, `catalog-midcentury`

**Playful / Bold**: `neo-brutalist`, `dark-pop`, `comic-letters`
