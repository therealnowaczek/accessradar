#!/usr/bin/env node
/**
 * Rasterize resources/icons/accessradar-apps-rovo.svg (tightened glyph; Apps/Forge use *-apps-nav-tight.png).
 *
 * Module `icon` properties use the 144 PNG. Other sizes are Marketplace/legacy exports: 512, 144, 64, 32, 24, 16.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const root = join(import.meta.dirname, '..');
const svgPath = join(root, 'resources/icons/accessradar-apps-rovo.svg');
const sizes = [512, 144, 64, 32, 24, 16];
const svg = readFileSync(svgPath);

for (const size of sizes) {
  const out = join(root, 'resources/icons', `accessradar-${size}.png`);
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(out);
  console.log(`wrote resources/icons/accessradar-${size}.png`);
}

const navTight = join(root, 'resources/icons', 'accessradar-apps-nav-tight.png');
await sharp(svg, { density: 384 }).resize(144, 144).png().toFile(navTight);
console.log('wrote resources/icons/accessradar-apps-nav-tight.png');
