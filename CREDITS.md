# Credits

## Characters and logo

Dendi, Memo, Octa, Syno, Lumi and the Medulla logo were **created by the Medulla
team**.

- **Characters (2.2):** the team generated every expression with **Google
  Gemini** from its own character line-up (October 2026), on a green
  background with a white sticker border (sheets: `assets/source/gemini/`).
  `tools/cutout.mjs` only removed the green, separated the poses and scaled
  them to the same size; the drawings were not changed. In one sheet two Memo
  poses overlapped, so three small spark lines drawn over "curious" Memo's legs
  were painted out with the leg colour. The colouring pages are traced
  automatically from the "hello" poses.
- **Logo (2.3):** the team's wireframe brain wrapped in a network, white on
  transparent (`assets/source/logo-network.png`, sent by the team on
  13 October 2026; the same design as `assets/source/logo-original.png`).
  It is used as drawn: `tools/logo.mjs` only trims, centres and resizes it,
  makes the thin lines a little more opaque in the small sizes so they stay
  visible, and places it on the purple-to-navy tile for icons.
- **Browser-tab icon (2.5):** the team's original drawing, a dark wireframe
  brain in a navy network on light paper (`assets/source/logo-original.png`),
  on its own paper colour; the thin lines are darkened in the small sizes.
- **Avatars (2.5):** `tools/avatars.mjs` crops square avatars, with the whole
  character in view, from the normal images and the expression poses; the
  drawings are not changed.
- **Earlier art:** the team's Canva cut-outs (2.1, `assets/source/cutouts/`) and
  the first AI-generated poses (`assets/source/poses/`) are kept as source
  material only; the site no longer uses them.

## Generated images (2.1)

Four decorative images were generated with **Canva's AI image generator** in
the team's Canva account (October 2026) and are labelled here because they are
not photographs or the team's own drawings:

| File | Prompt in short | Used on |
|---|---|---|
| `assets/img/brain-glass.webp` | translucent glass brain with violet pathways and orange sparks (background removed with Canva) | home hero, share image |
| `assets/img/neurons.webp` | network of glass neurons, lavender | home, "Why Medulla" |
| `assets/img/night.webp` | calm night hills with fireflies | home, Lumi's sleep chapter |
| `assets/img/waves.webp` | abstract violet glass waves | closing band, Partners, share image |

Originals: `assets/source/generated/`. They show no people and no real places.
The share image (`assets/brand/og-image.jpg`) is composed from the glass brain,
the waves and the character cut-outs (`tools/og.html`, exported by
`tools/export-png.mjs`).

## Fonts

- **Sora** (headings), by Jonathan Barnbrook and Julián Moncada, SIL Open Font License 1.1.
- **Manrope** (Cyrillic headings), by Mikhail Sharanda, SIL Open Font License 1.1.
- **Atkinson Hyperlegible**, by the Braille Institute of America, SIL Open Font
  License 1.1. Loaded from Google Fonts only when someone chooses the
  "Hyperlegible" font in Accessibility & comfort.
- Sora and Manrope load from Google Fonts. Body text uses the visitor's system font.
  The dyslexia-friendly mode uses Verdana or Tahoma from the device.

## Sound

There are **no sound files**. Every sound (taps, correct and wrong answers,
badges, the breathing tones and Lumi's night ambience) is synthesized live in
the browser with the Web Audio API by `js/sound.js`, written for this site.
Sound is off until the visitor switches it on, and every sound has a visual
equivalent.

## Icons and illustrations

- The interface icons are simple inline SVG line icons drawn for this site
  (`js/main.js` → `ICONS`), in the common 24-pixel outline style.
- The neuron network, the story explainers (neuron firing, sleep cycle, memory
  steps, pupil) and the printable worksheets are SVG and canvas drawings made
  for this site.

## Facts

Every fact names its source on its page and in `data/facts.json`: NINDS, NIMH,
NHLBI, NEI and MedlinePlus (US National Institutes of Health), the NHS, the
World Health Organization, StatPearls, and peer-reviewed papers (Xie et al.
2013; Raichle & Gusnard 2002; Azevedo et al. 2009; Roediger & Karpicke 2006;
Dunlosky et al. 2013; Nielsen et al. 2013; Simons et al. 2016). The wording is
Medulla's own summary. All facts are marked **"Pending expert review"** until
a specialist signs them off.

## Activities

- **Stroop test:** after J. R. Stroop (1935).
- **Digit span and sequence memory:** classic short-term memory tasks, here
  with a simple adaptive staircase.
- **Breathing with Syno:** the in for 5 / out for 5 pattern from the NHS
  "Breathing exercises for stress" page.
- **Lumi's wind-down:** general sleep-hygiene advice from the NHS and NHLBI.

These are for curiosity and learning, not diagnosis.

## Hard words (glossary)

`data/glossary.json`: plain-language definitions written by Medulla from the
same sources as the facts (NINDS, NIMH, NEI, MedlinePlus, StatPearls, CDC and
the papers named in each entry). All are **"Pending expert review"**.

## Third-party code

None is bundled. The only outside script is Telegram's official
`telegram-web-app.js`, and it is loaded only when the site is opened inside
Telegram.
