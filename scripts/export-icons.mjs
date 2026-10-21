#!/usr/bin/env node
/**
 * Rasterize resources/icons/accessradar-rovo-v2.svg (a copy of the STANDARD logo brand/accessradar-logo.svg; no small/bold variant at any size).
 *
 * Module `icon` properties use the SVG (Forge resource path). These PNGs are
 * the same mark at the sizes a raster slot may ask for: 512, 144, 64, 32, 24, 16.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const root = join(import.meta.dirname, '..');
const svgPath = join(root, 'resources/icons/accessradar-rovo-v2.svg');
const sizes = [512, 144, 64, 32, 24, 16];
const svg = readFileSync(svgPath);

for (const size of sizes) {
  const out = join(root, 'resources/icons', `accessradar-${size}.png`);
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(out);
  console.log(`wrote resources/icons/accessradar-${size}.png`);
}
