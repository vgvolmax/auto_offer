#!/usr/bin/env node
import { generateKits } from './lib/annotation-kits.mjs';

const { manifest } = await generateKits();
console.log(`Generated catalog and request annotation kits (${manifest.kits.catalog.schema_count}/${manifest.kits.request.schema_count} schemas).`);
