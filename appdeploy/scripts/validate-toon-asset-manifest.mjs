import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'public', 'toon-asset-manifest.json');

const EXPECTED_EXTERNAL_COVERS = {
  'cover-volcano-ignition':
    'https://raw.githubusercontent.com/harrisonjrubin7-cmyk/toon-platform/eaaf9264549f3ea0887b427bc1d43c9965ab1932/dist/assets/volcano.jpg',
  'cover-starfall-begin':
    'https://raw.githubusercontent.com/harrisonjrubin7-cmyk/toon-platform/eaaf9264549f3ea0887b427bc1d43c9965ab1932/dist/assets/starfall.jpg',
};

const EXPECTED_CATALOG_BOOKS = [
  { id: 'book-0', world: 'Volcano Racers', saga: 'The Ember Heart Saga', title: 'Ignition', kind: 'Main arc' },
  { id: 'book-1', world: 'Volcano Racers', saga: 'The Ember Heart Saga', title: 'The Great Ring Rally', kind: 'Main arc' },
  { id: 'book-2', world: 'Volcano Racers', saga: 'The Ember Heart Saga', title: 'Breakdown', kind: 'Main arc' },
  { id: 'book-3', world: 'Volcano Racers', saga: 'The Ember Heart Saga', title: 'Heart of the Mountain', kind: 'Main arc' },
  { id: 'book-4', world: 'Volcano Racers', saga: 'The Apex Saga', title: 'New Recruits', kind: 'Main arc' },
  { id: 'book-5', world: 'Volcano Racers', saga: 'The Apex Saga', title: 'The Food Chain', kind: 'Main arc' },
  { id: 'book-6', world: 'Volcano Racers', saga: 'The Apex Saga', title: 'Extinction Event', kind: 'Main arc' },
  { id: 'book-7', world: 'Volcano Racers', saga: 'The Apex Saga', title: 'Apex', kind: 'Main arc' },
  { id: 'book-8', world: 'Volcano Racers', saga: 'The Hive Saga', title: 'Perfect Lap', kind: 'Main arc' },
  { id: 'book-9', world: 'Volcano Racers', saga: 'The Hive Saga', title: 'The Feed', kind: 'Main arc' },
  { id: 'book-10', world: 'Volcano Racers', saga: 'The Hive Saga', title: 'Ghost Laps', kind: 'Main arc' },
  { id: 'book-11', world: 'Volcano Racers', saga: 'The Hive Saga', title: 'The Long Way Round', kind: 'Main arc' },
  { id: 'book-12', world: 'STARFALL', saga: 'STARFALL', title: 'Begin', kind: 'Main arc' },
  { id: 'book-13', world: 'STARFALL', saga: 'STARFALL', title: 'Fugitives', kind: 'Main arc' },
  { id: 'book-14', world: 'STARFALL', saga: 'STARFALL', title: 'Shadow Agencies', kind: 'Main arc' },
  { id: 'book-15', world: 'STARFALL', saga: 'STARFALL', title: 'The Meridian Circle', kind: 'Main arc' },
  { id: 'book-16', world: 'STARFALL', saga: 'STARFALL', title: 'Harvest', kind: 'Main arc' },
  { id: 'book-17', world: 'STARFALL', saga: 'Echoes', title: 'Afterglow', kind: 'Main arc' },
  { id: 'book-18', world: 'STARFALL', saga: 'Echoes', title: 'Registry', kind: 'Main arc' },
  { id: 'book-19', world: 'STARFALL', saga: 'Echoes', title: 'Mirror', kind: 'Main arc' },
  { id: 'book-20', world: 'STARFALL', saga: 'Echoes', title: 'Keystone', kind: 'Main arc' },
  { id: 'book-21', world: 'STARFALL', saga: 'Echoes', title: 'Signal', kind: 'Main arc' },
  { id: 'book-22', world: 'STARFALL', saga: 'Harrows', title: 'Three Stars', kind: 'Main arc' },
  { id: 'book-23', world: 'STARFALL', saga: 'Harrows', title: 'Surrender', kind: 'Main arc' },
  { id: 'book-24', world: 'STARFALL', saga: 'Harrows', title: 'Remnant', kind: 'Main arc' },
  { id: 'book-25', world: 'STARFALL', saga: 'Harrows', title: 'The First', kind: 'Main arc' },
  { id: 'book-26', world: 'STARFALL', saga: 'Harrows', title: 'Give Everything', kind: 'Main arc' },
  { id: 'book-27', world: 'Volcano Racers', saga: 'Proposed spin-off', title: 'Night Shift', kind: 'Spin-off' },
  { id: 'book-28', world: 'Volcano Racers', saga: 'Proposed spin-off', title: 'Dead Air', kind: 'Spin-off' },
  { id: 'book-29', world: 'STARFALL', saga: 'Proposed spin-off', title: 'After the Sirens', kind: 'Spin-off' },
  { id: 'book-30', world: 'STARFALL', saga: 'Proposed spin-off', title: 'The Person in the File', kind: 'Spin-off' },
];

const ALLOWED_STAGES = new Set(['development', 'proof', 'final']);
const ALLOWED_LOCATIONS = new Set(['local', 'external']);

function isOutsideRoot(relativePath) {
  return (
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  );
}

export function validateEvidencePath(rootDir, relPath) {
  if (typeof relPath !== 'string' || !relPath.trim()) {
    return 'path must be a non-empty string';
  }
  if (path.isAbsolute(relPath) || path.win32.isAbsolute(relPath)) {
    return 'absolute paths are not allowed';
  }
  if (relPath.split(/[\\/]+/).includes('..')) {
    return 'parent traversal segments are not allowed';
  }

  let realRoot;
  try {
    realRoot = fs.realpathSync(rootDir);
  } catch {
    return 'evidence root does not exist';
  }

  const resolved = path.resolve(realRoot, relPath);
  if (isOutsideRoot(path.relative(realRoot, resolved))) {
    return 'path escapes the evidence root';
  }

  let realTarget;
  try {
    realTarget = fs.realpathSync(resolved);
  } catch {
    return 'path does not exist';
  }
  if (isOutsideRoot(path.relative(realRoot, realTarget))) {
    return 'path resolves outside the evidence root';
  }

  try {
    if (!fs.statSync(realTarget).isFile()) {
      return 'path must resolve to a regular file';
    }
  } catch {
    return 'path cannot be inspected';
  }
  return null;
}

export function validateManifestObject(manifest, rootDir = ROOT_DIR) {
  const errors = [];

  if (!manifest || typeof manifest !== 'object') {
    return ['Manifest root must be a JSON object.'];
  }

  // 1. Environment & sandbox boundary checks
  if (
    !manifest.environment ||
    manifest.environment.role !== 'sandbox-candidate' ||
    manifest.environment.isCentralToon !== false ||
    manifest.environment.isRelease !== false
  ) {
    errors.push(
      '[boundary] Manifest must declare environment.role="sandbox-candidate", isCentralToon=false, and isRelease=false.'
    );
  }

  // 2. Duplicate ID check across all records
  const seenIds = new Set();
  function registerId(id, context) {
    if (!id || typeof id !== 'string') {
      errors.push(`[omission] Missing or non-string id in ${context}.`);
      return;
    }
    if (seenIds.has(id)) {
      errors.push(`[duplicate-id] Duplicate ID "${id}" detected in ${context}.`);
    }
    seenIds.add(id);
  }

  // Helper to validate common record fields (evidencePaths, localOrExternal, stage, dimensions, missingMetadata)
  function validateCommonFields(entry, context) {
    if (!ALLOWED_LOCATIONS.has(entry.localOrExternal)) {
      errors.push(
        `[omission] ${context} ("${entry.id}") must specify localOrExternal as "local" or "external".`
      );
    }

    if (!ALLOWED_STAGES.has(entry.stage)) {
      errors.push(
        `[omission] ${context} ("${entry.id}") must specify stage in ["development", "proof", "final"].`
      );
    }

    if (entry.stage === 'final') {
      errors.push(
        `[unsupported-final-art] ${context} ("${entry.id}") claims stage="final", which is unsupported in the Toon sandbox.`
      );
    }

    if (!Array.isArray(entry.evidencePaths) || entry.evidencePaths.length === 0) {
      errors.push(
        `[missing-evidence-path] ${context} ("${entry.id}") must include a non-empty evidencePaths array.`
      );
    } else {
      for (const relPath of entry.evidencePaths) {
        if (typeof relPath !== 'string' || !relPath.trim()) {
          errors.push(
            `[missing-evidence-path] ${context} ("${entry.id}") contains an empty or non-string evidence path.`
          );
          continue;
        }
        const evidencePathError = validateEvidencePath(rootDir, relPath);
        if (evidencePathError) {
          errors.push(
            `[missing-evidence-path] ${context} ("${entry.id}") references invalid evidence path "${relPath}": ${evidencePathError}.`
          );
        }
      }
    }

    if (!entry.dimensions || typeof entry.dimensions !== 'object') {
      errors.push(
        `[omission] ${context} ("${entry.id}") is missing dimensions object.`
      );
    } else {
      const { width, height, reason } = entry.dimensions;
      const widthOk = width === null || (typeof width === 'number' && width > 0);
      const heightOk = height === null || (typeof height === 'number' && height > 0);
      if (!widthOk || !heightOk) {
        errors.push(
          `[omission] ${context} ("${entry.id}") dimensions.width and dimensions.height must be positive numbers or null.`
        );
      }
      if ((width === null || height === null) && (typeof reason !== 'string' || reason.trim().length === 0)) {
        errors.push(
          `[omission] ${context} ("${entry.id}") has null dimensions but is missing a non-empty dimensions.reason explanation.`
        );
      }
    }

    if (
      !Array.isArray(entry.missingMetadata) ||
      entry.missingMetadata.length === 0 ||
      entry.missingMetadata.some(m => typeof m !== 'string' || !m.trim())
    ) {
      errors.push(
        `[omission] ${context} ("${entry.id}") must include a non-empty missingMetadata string array.`
      );
    }
  }

  // 3. Validate top-level assets (icon + both external development covers)
  if (!Array.isArray(manifest.assets)) {
    errors.push('[omission] Manifest is missing top-level "assets" array.');
  } else {
    for (const asset of manifest.assets) {
      registerId(asset.id, 'assets');
      validateCommonFields(asset, 'asset');
    }

    const icon = manifest.assets.find(a => a.id === 'icon');
    if (!icon) {
      errors.push('[omission] Required icon asset ("icon") is missing from assets.');
    } else {
      if (icon.localOrExternal !== 'local' || icon.uri !== '/icon.svg') {
        errors.push('[omission] Icon asset must have localOrExternal="local" and uri="/icon.svg".');
      }
      if (icon.dimensions?.width !== 64 || icon.dimensions?.height !== 64) {
        errors.push('[omission] Icon asset must record 64x64 dimensions from public/icon.svg viewBox.');
      }
    }

    for (const [coverId, expectedUri] of Object.entries(EXPECTED_EXTERNAL_COVERS)) {
      const cover = manifest.assets.find(a => a.id === coverId);
      if (!cover) {
        errors.push(`[omission] Required external development cover "${coverId}" is missing.`);
      } else {
        if (cover.localOrExternal !== 'external') {
          errors.push(`[omission] Cover "${coverId}" must have localOrExternal="external".`);
        }
        if (cover.stage !== 'development') {
          errors.push(
            `[unsupported-final-art] Cover "${coverId}" must have stage="development" (found "${cover.stage}").`
          );
        }
        if (cover.uri !== expectedUri) {
          errors.push(`[omission] Cover "${coverId}" URI does not match expected external asset URL.`);
        }
        if (cover.dimensions?.width !== null || cover.dimensions?.height !== null) {
          errors.push(`[omission] External cover "${coverId}" must have nullable dimensions (width: null, height: null) with reason.`);
        }
      }
    }
  }

  // 4. Authority Counts check (Private Site v47: Ignition 184 selected drafts; Begin 166 selected drafts)
  const auth = manifest.authorityCounts;
  if (!auth || auth.sourceAuthority !== 'Private Site v47' || !auth.books) {
    errors.push('[authority-count] Missing authorityCounts block with sourceAuthority="Private Site v47".');
  } else {
    const b0 = auth.books['book-0'];
    const b12 = auth.books['book-12'];
    if (
      !b0 ||
      b0.selectedDrafts !== 184 ||
      b0.unit !== 'selected drafts' ||
      b0.canonicalLabel !== 'Ignition 184 selected drafts'
    ) {
      errors.push(
        '[authority-count] Authority count for book-0 (Ignition) must preserve Private Site v47 count: "Ignition 184 selected drafts" (selectedDrafts=184).'
      );
    }
    if (
      !b12 ||
      b12.selectedDrafts !== 166 ||
      b12.unit !== 'selected drafts' ||
      b12.canonicalLabel !== 'Begin 166 selected drafts'
    ) {
      errors.push(
        '[authority-count] Authority count for book-12 (Begin) must preserve Private Site v47 count: "Begin 166 selected drafts" (selectedDrafts=166).'
      );
    }
    if (b0?.stage === 'final' || b12?.stage === 'final') {
      errors.push('[unsupported-final-art] Authority book entries must not claim stage="final".');
    }
  }

  // 5. Validate leadBooks (book-0 Ignition and book-12 Begin) and catalog book coverage
  const catalogFound = new Map();

  if (!Array.isArray(manifest.leadBooks)) {
    errors.push('[omission] Manifest is missing "leadBooks" array.');
  } else {
    for (const lead of manifest.leadBooks) {
      registerId(lead.id, 'leadBooks');
      validateCommonFields(lead, 'leadBook');
      catalogFound.set(lead.id, {
        id: lead.id,
        world: lead.world,
        saga: lead.saga,
        title: lead.title,
        kind: lead.arcKind,
      });
    }

    const lead0 = manifest.leadBooks.find(b => b.id === 'book-0');
    if (!lead0) {
      errors.push('[omission] Missing leadBook record for Ignition ("book-0").');
    } else {
      if (
        !lead0.authorityCount ||
        lead0.authorityCount.source !== 'Private Site v47' ||
        lead0.authorityCount.selectedDrafts !== 184 ||
        lead0.authorityCount.unit !== 'selected drafts' ||
        lead0.authorityCount.label !== 'Ignition 184 selected drafts'
      ) {
        errors.push(
          '[authority-count] leadBook book-0 (Ignition) failed to preserve exact Private Site v47 authority count (184 selected drafts).'
        );
      }
      if (
        !lead0.localCoverageNotes ||
        lead0.localCoverageNotes.sandboxIllustratedPages !== 24 ||
        typeof lead0.localCoverageNotes.coverageNote !== 'string'
      ) {
        errors.push(
          '[authority-count] leadBook book-0 (Ignition) must record sandbox 24 illustrated pages as a localCoverageNotes entry.'
        );
      }
      if (lead0.localCoverageNotes?.sandboxIllustratedPagesStage === 'final') {
        errors.push('[unsupported-final-art] book-0 local coverage notes must not claim final stage.');
      }
    }

    const lead12 = manifest.leadBooks.find(b => b.id === 'book-12');
    if (!lead12) {
      errors.push('[omission] Missing leadBook record for Begin ("book-12").');
    } else {
      if (
        !lead12.authorityCount ||
        lead12.authorityCount.source !== 'Private Site v47' ||
        lead12.authorityCount.selectedDrafts !== 166 ||
        lead12.authorityCount.unit !== 'selected drafts' ||
        lead12.authorityCount.label !== 'Begin 166 selected drafts'
      ) {
        errors.push(
          '[authority-count] leadBook book-12 (Begin) failed to preserve exact Private Site v47 authority count (166 selected drafts).'
        );
      }
      if (
        !lead12.localCoverageNotes ||
        lead12.localCoverageNotes.staleSandboxLabelScriptPages !== 168 ||
        lead12.localCoverageNotes.sandboxProofPages !== 10 ||
        lead12.localCoverageNotes.sandboxProofPagesStage !== 'proof'
      ) {
        errors.push(
          '[authority-count] leadBook book-12 (Begin) must record stale Begin 168 label and 10 proof pages (stage: "proof") in localCoverageNotes.'
        );
      }
    }
  }

  // 6. Validate groupedCatalogRecords
  if (!Array.isArray(manifest.groupedCatalogRecords) || manifest.groupedCatalogRecords.length === 0) {
    errors.push('[omission] Manifest is missing "groupedCatalogRecords" array.');
  } else {
    for (const group of manifest.groupedCatalogRecords) {
      registerId(group.id, 'groupedCatalogRecords');
      validateCommonFields(group, 'groupedCatalogRecord');

      if (!Array.isArray(group.records) || group.records.length === 0) {
        errors.push(`[omission] Group "${group.id}" must contain a non-empty "records" array.`);
        continue;
      }

      for (const rec of group.records) {
        registerId(rec.id, `groupedCatalogRecords[${group.id}].records`);
        if (!ALLOWED_LOCATIONS.has(rec.localOrExternal)) {
          errors.push(`[omission] Record "${rec.id}" in "${group.id}" must specify localOrExternal.`);
        }
        if (!ALLOWED_STAGES.has(rec.stage)) {
          errors.push(`[omission] Record "${rec.id}" in "${group.id}" must specify valid stage.`);
        }
        if (rec.stage === 'final') {
          errors.push(
            `[unsupported-final-art] Record "${rec.id}" in "${group.id}" claims unsupported stage="final".`
          );
        }
        catalogFound.set(rec.id, {
          id: rec.id,
          world: rec.world,
          saga: rec.saga,
          title: rec.title,
          kind: rec.kind,
        });
      }
    }
  }

  // 7. Verify all 31 catalog records (book-0 through book-30) exist without omission or mismatch
  for (const expected of EXPECTED_CATALOG_BOOKS) {
    const actual = catalogFound.get(expected.id);
    if (!actual) {
      errors.push(
        `[omission] Catalog book "${expected.id}" ("${expected.title}") is omitted from the manifest.`
      );
      continue;
    }
    if (
      actual.title !== expected.title ||
      actual.world !== expected.world ||
      actual.saga !== expected.saga ||
      actual.kind !== expected.kind
    ) {
      errors.push(
        `[omission] Catalog book "${expected.id}" metadata mismatch: expected ${JSON.stringify(
          expected
        )}, found ${JSON.stringify(actual)}.`
      );
    }
  }

  return errors;
}

function verifyRenderedFilesUntouched(rootDir = ROOT_DIR) {
  const errors = [];
  const workspaceJsPath = path.join(rootDir, 'public', 'workspace.js');
  const appJsPath = path.join(rootDir, 'public', 'app.js');
  const indexHtmlPath = path.join(rootDir, 'index.html');

  const workspaceJs = fs.readFileSync(workspaceJsPath, 'utf8');
  if (
    !workspaceJs.includes("'184-page script draft; 24-page illustrated opening chapter.'") ||
    !workspaceJs.includes("'168-page script draft; 10 illustrated proof pages.'")
  ) {
    errors.push(
      '[rendered-copy-modified] public/workspace.js rendered catalog copy was altered against instructions.'
    );
  }

  const appJs = fs.readFileSync(appJsPath, 'utf8');
  if (!appJs.includes("title: 'The Ember Heart Saga'") || !appJs.includes("title: 'Harrows'")) {
    errors.push('[rendered-copy-modified] public/app.js catalog definitions were altered.');
  }

  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  if (
    !indexHtml.includes(EXPECTED_EXTERNAL_COVERS['cover-volcano-ignition']) ||
    !indexHtml.includes(EXPECTED_EXTERNAL_COVERS['cover-starfall-begin'])
  ) {
    errors.push('[rendered-copy-modified] index.html cover references were altered.');
  }

  return errors;
}

function runRejectionSelfTests(validManifest) {
  const clone = obj => JSON.parse(JSON.stringify(obj));

  // Test 1: Omission (remove a grouped record)
  const omitted = clone(validManifest);
  omitted.groupedCatalogRecords[0].records.pop();
  const omitErrors = validateManifestObject(omitted);
  if (!omitErrors.some(e => e.includes('[omission]'))) {
    throw new Error('Self-test failed: validator did not reject catalog omission.');
  }

  // Test 2: Duplicate ID
  const dup = clone(validManifest);
  dup.groupedCatalogRecords[0].records.push({
    ...dup.groupedCatalogRecords[0].records[0],
  });
  const dupErrors = validateManifestObject(dup);
  if (!dupErrors.some(e => e.includes('[duplicate-id]'))) {
    throw new Error('Self-test failed: validator did not reject duplicate ID.');
  }

  // Test 3: Unsupported final-art claim
  const finalClaim = clone(validManifest);
  finalClaim.assets[1].stage = 'final';
  const finalErrors = validateManifestObject(finalClaim);
  if (!finalErrors.some(e => e.includes('[unsupported-final-art]'))) {
    throw new Error('Self-test failed: validator did not reject unsupported final-art claim.');
  }

  // Test 4: Missing evidence path
  const badPath = clone(validManifest);
  badPath.assets[0].evidencePaths.push('public/does-not-exist.png');
  const pathErrors = validateManifestObject(badPath);
  if (!pathErrors.some(e => e.includes('[missing-evidence-path]'))) {
    throw new Error('Self-test failed: validator did not reject missing evidence path.');
  }

  // Test 5: Authority-count replacement (replacing Begin 166 with stale 168)
  const replacedCount = clone(validManifest);
  replacedCount.leadBooks[1].authorityCount.selectedDrafts = 168;
  const countErrors = validateManifestObject(replacedCount);
  if (!countErrors.some(e => e.includes('[authority-count]'))) {
    throw new Error('Self-test failed: validator did not reject authority-count replacement.');
  }

  return 5;
}

function runEvidencePathBoundarySelfTests() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'toon-manifest-path-'));
  const root = path.join(scratch, 'appdeploy');
  const sibling = path.join(scratch, 'appdeploy-sibling');
  fs.mkdirSync(path.join(root, 'public'), { recursive: true });
  fs.mkdirSync(sibling, { recursive: true });
  fs.writeFileSync(path.join(root, 'valid.txt'), 'inside');
  fs.writeFileSync(path.join(sibling, 'outside.txt'), 'outside');

  const expectRejected = (label, candidate) => {
    if (validateEvidencePath(root, candidate) === null) {
      throw new Error(`Self-test failed: validator accepted ${label} evidence path.`);
    }
  };

  try {
    expectRejected('sibling-prefix escape', '../appdeploy-sibling/outside.txt');
    expectRejected('parent traversal', 'public/../../appdeploy-sibling/outside.txt');
    expectRejected('absolute', path.join(root, 'valid.txt'));
    if (validateEvidencePath(root, 'valid.txt') !== null) {
      throw new Error('Self-test failed: validator rejected valid in-root evidence path.');
    }

    fs.symlinkSync(path.join(sibling, 'outside.txt'), path.join(root, 'outside-link.txt'));
    expectRejected('out-of-root symlink', 'outside-link.txt');
    fs.symlinkSync(path.join(root, 'valid.txt'), path.join(root, 'inside-link.txt'));
    if (validateEvidencePath(root, 'inside-link.txt') !== null) {
      throw new Error('Self-test failed: validator rejected an in-root symlink to an in-root regular file.');
    }
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }

  return 6;
}

function main() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`ERROR: Manifest not found at ${MANIFEST_PATH}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
  let manifest;
  try {
    manifest = JSON.parse(raw);
  } catch (err) {
    console.error(`ERROR: Failed to parse JSON in ${MANIFEST_PATH}: ${err.message}`);
    process.exit(1);
  }

  const errors = [
    ...validateManifestObject(manifest, ROOT_DIR),
    ...verifyRenderedFilesUntouched(ROOT_DIR),
  ];

  if (errors.length > 0) {
    console.error('Toon asset manifest validation FAILED:');
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  const selfTestCount = runRejectionSelfTests(manifest);
  const evidencePathSelfTestCount = runEvidencePathBoundarySelfTests();
  const groupedBookCount = manifest.groupedCatalogRecords.reduce(
    (sum, g) => sum + g.records.length,
    0
  );

  console.log(
    `PASS: public/toon-asset-manifest.json validated (${manifest.assets.length} assets, ${manifest.leadBooks.length} lead books [Ignition=184 selected drafts, Begin=166 selected drafts], ${manifest.groupedCatalogRecords.length} catalog groups covering ${groupedBookCount} remaining books; ${selfTestCount}/5 manifest mutation checks and ${evidencePathSelfTestCount}/6 evidence-path boundary checks verified).`
  );
}

main();
