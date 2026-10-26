# Integrating max7219-georgian into Esphome-Max7219-Matrix-Clock

Follow these steps after extracting the ZIP at the repository root:

1. **Extract the ZIP at the root of Esphome-Max7219-Matrix-Clock.**
   The extracted layout adds `fonts/max7219-georgian/`, `packages/fonts/max7219-georgian.yaml`,
   `font-manifest.json`, `EXPORT-REPORT.md`, `INTEGRATION.md` and an `integration/` folder.

2. **Apply the three snippets from `integration/`** to the target repo:
   - Add the entry from `integration/configurator-fontMetadata.json` under the `fontMetadata` key in `packages/configurator.json`.
   - Add the guarded C++ block from `integration/display-snippet.txt` inside the SourceFont selection block in `packages/display.yaml`, following the existing SourceFont pattern.
   - Add the mapping line from `integration/test-mapping.txt` to `FONT_OPTION_BY_ID` in `tests/test_config.py`.
   - Add the Markdown row from `integration/fonts-readme-row.md` to the font table in `fonts/README.md`.

3. **Regenerate generated files** by running, from the repository root:

   ```
   python scripts/generate_firmware_contract.py
   python web-configurator/scripts/generate_glyphs.py
   python scripts/check_code.py
   ```

4. **Firmware compilation / flashing** remains a separate ESPHome step (compile and flash your node through the ESPHome dashboard or CLI as usual). Repository maintainers handle the version bump and `CHANGELOG.md` entry.

## Use your larger digits for the clock time

The clock generates time text with ASCII digits `0`–`9`; it will not automatically call the private-use alternative digits (U+E000–U+E009 by default). In Pixeel, use **Use large digits for time…** in the MAX7219 export panel to add ASCII `0`–`9` as mappings of the ten large glyphs. Confirm taking those code points from the current standard-digit glyphs; those glyphs stay in the font, but become unmapped at `0`–`9`. The large glyphs keep their private-use mappings too.

After remapping, re-open Font → Export, run **Export & validate** again and build a fresh ZIP. Complete the integration steps above, then choose the exported display label in Home Assistant’s **Clock font** selector. The default MAX7219 glyph list already includes ASCII digits, so no special message string or Unicode escape is needed.
