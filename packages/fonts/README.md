# Optional Font Packages

Each file in `packages/fonts/` compiles one external font and appends its
option to the `Clock font`, `Date font`, `Temperature font`, and `Message font`
selects in Home Assistant.

* `packages/fonts/max7219.yaml` — **max7219** (default unified face: standard
  ASCII `0–9`, custom big `0–9` at `U+E000–U+E009`, English `A–Z`/`a–z`,
  Georgian Mkhedruli `ა–ჰ`, and punctuation)

`Compact 5x7` is built into `packages/max7219_clock_renderer.h` and is always
available without any font package.

Every screen (Clock, Date, Temperature, and Messages/Countdown) can select its
own font, digit set (`Standard 0-9` vs `Custom big 0-9`), and letter set
(`English` vs `Georgian`) independently in the Web Configurator and at runtime
in Home Assistant.

## Make your own face

Draw one in the
[Pixeel font editor](https://sandro-defender.github.io/Pixeel-font-editor/) and
export a package for this clock; see
[docs/PIXEEL_FONTS.md](../../docs/PIXEEL_FONTS.md) for the export contract and
both installation paths.
