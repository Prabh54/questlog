/**
 * Writes the generated OpenAPI document to docs/openapi.json.
 * CI re-runs this and fails if the committed file is out of date.
 *
 *   npm run openapi -w @questlog/backend
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildOpenApiDocument } from './spec';

const out = resolve(__dirname, '../../../docs/openapi.json');
writeFileSync(out, `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`);
console.info(`Wrote ${out}`);
