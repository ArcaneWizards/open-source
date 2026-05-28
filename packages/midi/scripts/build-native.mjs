import { mkdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { homedir } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

if (process.platform !== 'darwin') {
  process.exit(0);
}

const build = async () => {
  const nodeIncludeCandidates = [
    join(dirname(process.execPath), '..', 'include', 'node'),
    join(
      homedir(),
      'Library',
      'Caches',
      'node-gyp',
      process.versions.node,
      'include',
      'node',
    ),
  ].filter(Boolean);

  let nodeIncludeDir = null;
  for (const candidate of nodeIncludeCandidates) {
    try {
      await stat(join(candidate, 'node_api.h'));
      nodeIncludeDir = candidate;
      break;
    } catch {
      // Ignore and try the next candidate
    }
  }

  if (!nodeIncludeDir) {
    throw new Error(
      `Unable to find Node headers. Tried: ${nodeIncludeCandidates.join(', ')}`,
    );
  }

  const outputDir = join(root, 'native', 'dist');
  await mkdir(outputDir, { recursive: true });

  const execFilePromise = (file, args, options) => {
    return new Promise((resolve, reject) => {
      execFile(file, args, options, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve({ stdout, stderr });
        }
      });
    });
  };

  await execFilePromise(
    'clang++',
    [
      '-std=c++17',
      '-ObjC++',
      '-fvisibility=hidden',
      '-DNAPI_VERSION=9',
      '-mmacosx-version-min=10.15',
      '-bundle',
      '-undefined',
      'dynamic_lookup',
      '-I',
      nodeIncludeDir,
      join(root, 'native', 'midi-macos.mm'),
      '-framework',
      'CoreMIDI',
      '-framework',
      'CoreFoundation',
      '-framework',
      'Foundation',
      '-o',
      join(outputDir, 'midi-macos.node'),
    ],
    {
      stdio: 'inherit',
    },
  );
};

build().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Error building native module:', error);
  process.exit(1);
});
