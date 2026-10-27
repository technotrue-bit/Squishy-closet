// Slims a raw AI model download (Hi3D and the like: 0.5 to 2 million
// triangles and 4K to 8K textures) down to something a phone draws at 60fps.
//
//   node tools/slim-model.mjs raw.glb public/models/thing.glb [triangles] [texture size]
//
// Defaults: 4000 triangles and a 512px texture, about right for a hat or a
// prop. Uses the gltf-transform command line through npx, so nothing new is
// added to the game's own packages. Output is meshopt compressed with a WebP
// texture; the game loads it with the meshopt decoder (see modelTest.ts).

import { readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";

const [input, output, trisArg = "4000", sizeArg = "512"] = process.argv.slice(2);
if (!input || !output) {
  console.error("Usage: node tools/slim-model.mjs raw.glb out.glb [triangles] [texture size]");
  process.exit(1);
}

/** Counts the triangles in a .glb by reading its JSON chunk (no packages needed). */
function countTriangles(file) {
  const buf = readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file} is not a .glb`);
  const json = JSON.parse(buf.toString("utf8", 20, 20 + buf.readUInt32LE(12)));
  let tris = 0;
  for (const mesh of json.meshes ?? [])
    for (const p of mesh.primitives ?? []) {
      if (p.mode !== undefined && p.mode !== 4) continue;
      const acc = json.accessors[p.indices ?? p.attributes.POSITION];
      tris += acc.count / 3;
    }
  return tris;
}

const before = countTriangles(input);
const target = Number(trisArg);
const ratio = Math.min(1, target / before);
const run = spawnSync(
  "npx",
  [
    "--yes",
    "@gltf-transform/cli@4.5.1",
    "optimize",
    input,
    output,
    "--simplify-ratio",
    ratio.toFixed(5),
    "--simplify-error",
    "0.01",
    "--texture-size",
    sizeArg,
    "--texture-compress",
    "webp",
    "--compress",
    "meshopt",
  ],
  { stdio: "inherit" },
);
if (run.status !== 0) process.exit(run.status ?? 1);

const kb = (f) => Math.round(statSync(f).size / 1024);
console.log(`\n${Math.round(before)} triangles, ${kb(input)} KB  ->  slimmed to ${kb(output)} KB (aim ${target} triangles)`);
