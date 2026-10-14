import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const testRoot = path.resolve('src/__tests__');
const vitestEntrypoint = path.resolve('node_modules/vitest/vitest.mjs');

const collectTestFiles = (directory) => {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectTestFiles(entryPath);
    }

    const isUnitTest = entry.name.endsWith('.test.ts') && !entry.name.startsWith('api.postgres.');
    return isUnitTest ? [entryPath] : [];
  });
};

const testFiles = collectTestFiles(testRoot).sort();
const failures = [];

for (const testFile of testFiles) {
  const result = spawnSync(
    process.execPath,
    [vitestEntrypoint, 'run', '--passWithNoTests', path.relative(process.cwd(), testFile)],
    {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: 'inherit',
    },
  );

  if (result.status !== 0) {
    failures.push({
      testFile,
      status: result.status ?? 'signal',
      error: result.error?.message,
    });
  }
}

if (failures.length > 0) {
  console.error('\nBackend unit test failures:');
  for (const failure of failures) {
    const detail = failure.error ? ` (${failure.error})` : '';
    console.error(
      `- ${path.relative(process.cwd(), failure.testFile)}: ${failure.status}${detail}`,
    );
  }
  process.exitCode = 1;
}
