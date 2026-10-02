/** The release asset and validation fixtures use the exact browser YAML generator. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { FIRMWARE } from "../src/firmware";
import { sanitizeConfig } from "../src/storage";
import { buildYaml } from "../src/yaml";

const [tag, output, ...flags] = process.argv.slice(2);
if (!tag || !output) throw new Error("Usage: npm run installer -- TAG OUTPUT [--all-fonts] [--config JSON]");
const position = flags.indexOf("--config");
const overrides = position < 0 ? {} : JSON.parse(readFileSync(flags[position + 1], "utf8"));
const config = sanitizeConfig({ ...overrides,
  ...(flags.includes("--all-fonts") ? { fonts: FIRMWARE.fonts.filter((font) => font.package).map((font) => font.id) } : {}),
});
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, buildYaml(config, tag));
console.log(`Generated ${output} for ${tag} (local !secret references only)`);
