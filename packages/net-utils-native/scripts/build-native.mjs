/* eslint-disable turbo/no-undeclared-env-vars */
import { mkdir, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { homedir } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Local network access is a macOS-only concern, so there is nothing to build
// anywhere else.
if (process.platform !== 'darwin') {
  process.exit(0);
}

const execFilePromise = (file, args, options) => {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
};

const compactPaths = (paths) => {
  return [...new Set(paths.filter(Boolean))];
};

const nodeHeaderCandidates = () => {
  return compactPaths([
    process.env.npm_config_nodedir
      ? join(process.env.npm_config_nodedir, 'include', 'node')
      : null,
    join(dirname(process.execPath), 'include', 'node'),
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
  ]);
};

const findNodeIncludeDir = async () => {
  const paths = nodeHeaderCandidates();

  for (const candidate of paths) {
    try {
      await stat(join(candidate, 'node_api.h'));
      return candidate;
    } catch {
      // Ignore and try the next candidate
    }
  }

  throw new Error(`Unable to find Node headers. Tried: ${paths.join(', ')}`);
};

const macOSTargets = [
  { clangArch: 'arm64', nodeArch: 'arm64' },
  { clangArch: 'x86_64', nodeArch: 'x64' },
];

const buildMacOSNativeModule = async (
  { clangArch, nodeArch },
  nodeIncludeDir,
  outputDir,
) => {
  await execFilePromise(
    'clang++',
    [
      '-std=c++17',
      '-ObjC++',
      '-fvisibility=hidden',
      '-DNAPI_VERSION=9',
      // Network.framework's browser API is available from macOS 10.15.
      '-mmacosx-version-min=10.15',
      '-arch',
      clangArch,
      '-bundle',
      '-undefined',
      'dynamic_lookup',
      '-I',
      nodeIncludeDir,
      join(root, 'native', 'local-network-macos.mm'),
      '-framework',
      'Network',
      '-framework',
      'Foundation',
      '-framework',
      'CoreFoundation',
      '-o',
      join(outputDir, `local-network-macos.${nodeArch}.node`),
    ],
    {
      stdio: 'inherit',
    },
  );
};

const build = async () => {
  const nodeIncludeDir = await findNodeIncludeDir();
  const outputDir = join(root, 'native', 'out');
  await mkdir(outputDir, { recursive: true });

  await rm(join(outputDir, 'local-network-macos.node'), { force: true });

  for (const target of macOSTargets) {
    await buildMacOSNativeModule(target, nodeIncludeDir, outputDir);
  }
};

build().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Error building native module:', error);
  if (error.stdout) {
    // eslint-disable-next-line no-console
    console.error(error.stdout);
  }
  if (error.stderr) {
    // eslint-disable-next-line no-console
    console.error(error.stderr);
  }
  process.exit(1);
});
