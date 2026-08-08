import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { AREAS, AREA_SLUGS, UsageError, isAreaSlug } from '../core/areas';
import { Recorder } from '../core/fs';
import { MANIFEST, addAreaLine } from '../core/manifest';
import { readDocTemplate, readProjectTemplate } from '../core/templates';

export interface AddAreaResult {
  readonly code: 0 | 1;
  readonly out: string[];
  readonly err: string[];
}

export function addArea(slug: string, flags: { seed?: boolean; root?: string }): AddAreaResult {
  const out: string[] = [];
  const err: string[] = [];
  const root = resolve(flags.root ?? '.');

  if (!isAreaSlug(slug)) {
    throw new UsageError(`unknown area '${slug}'. Known: ${AREA_SLUGS.join(', ')}`);
  }

  const manifestPath = join(root, MANIFEST);
  if (!existsSync(manifestPath)) {
    err.push(`error: no ${MANIFEST} — run \`msg init\` first`);
    return { code: 1, out, err };
  }

  const area = AREAS[slug];
  const manifest = readFileSync(manifestPath, 'utf8');
  const updated = addAreaLine(manifest, slug);

  const rec = new Recorder(root);
  if (updated === null) {
    out.push(`  kept    ${MANIFEST} — ${area.label} is already listed`);
  } else {
    writeFileSync(manifestPath, updated, 'utf8');
    out.push(`  updated ${MANIFEST} — added ${area.label}`);
  }

  const doc = flags.seed
    ? readDocTemplate(area.seed)
    : readProjectTemplate('rule-doc.md')
        .replaceAll('{{Label}}', area.label)
        .replaceAll('{{label}}', area.label.toLowerCase());

  rec.writeIfAbsent(join(root, area.doc), doc);
  for (const change of rec.changes) {
    out.push(
      change.action === 'created' ? `  created ${change.path}` : `  kept    ${change.path} (yours)`,
    );
  }

  return { code: 0, out, err };
}
