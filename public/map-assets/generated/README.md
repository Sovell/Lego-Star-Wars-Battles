# Generated map art pack

This directory contains project-owned terrain art generated on 2026-08-14 and 2026-08-15 with the built-in OpenAI image generation tool. No reference images were supplied.

Each theme contains five transparent terrain sprites and one opaque open-ground texture, all as 256×256 PNG files:

- `open-ground.png`
- `light-cover.png`
- `heavy-cover.png`
- `rough-terrain.png`
- `building.png`
- `high-ground.png`

Runtime map definitions use these files first. The earlier CC0 and project vector packs remain in their original directories as retained fallback/source material.

## Construction-brick refresh (`brick-v2`)

Every theme also contains a 512×512 `*-brick-v2.png` set generated on 2026-08-15. These files reinterpret the existing terrain silhouettes as original models made from generic interlocking bricks, plates, tiles and visible studs. They do not reproduce official kits and contain no logos, trademarks or brand markings. Runtime map definitions now use the `brick-v2` files; the original six images in each directory remain preserved.

The complete reusable prompt set is recorded in [`../GENERATED_ASSET_PROMPTS.md`](../GENERATED_ASSET_PROMPTS.md).
