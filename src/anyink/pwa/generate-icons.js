// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
import sharp from 'sharp';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = new URL('../../common/graphics/anyink-icon.svg', import.meta.url);
const destination = new URL('../../public/icons/', import.meta.url);
await mkdir(destination, { recursive: true });
for (const size of [48, 72, 96, 144, 180, 192, 256, 384, 512]) {
	await sharp(await readFile(source))
		.resize(size, size)
		.png()
		.toFile(fileURLToPath(new URL(`icon-${size}.png`, destination)));
}
const tokens = await readFile(new URL('../theme/tokens.css', import.meta.url), 'utf8');
const background = tokens.match(/--chrome-bg:\s*([^;]+);/)[1];
const inset = await sharp(await readFile(source))
	.resize(384, 384)
	.png()
	.toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background } })
	.composite([{ input: inset, gravity: 'centre' }])
	.png()
	.toFile(fileURLToPath(new URL('maskable-512.png', destination)));
