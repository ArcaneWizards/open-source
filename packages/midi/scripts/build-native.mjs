/* eslint-disable turbo/no-undeclared-env-vars */
import { mkdir, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { arch, homedir } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

if (process.platform !== 'darwin' && process.platform !== 'win32') {
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

const nodeGypCacheRootCandidates = () => {
  if (process.platform === 'darwin') {
    return [join(homedir(), 'Library', 'Caches', 'node-gyp')];
  }

  if (process.platform === 'win32') {
    return [
      process.env.LOCALAPPDATA
        ? join(process.env.LOCALAPPDATA, 'node-gyp', 'Cache')
        : null,
      join(homedir(), 'AppData', 'Local', 'node-gyp', 'Cache'),
      process.env.USERPROFILE ? join(process.env.USERPROFILE, '.node-gyp') : null,
    ];
  }

  return [];
};

const findFirstPathContaining = async (description, candidates, filename) => {
  const paths = compactPaths(candidates);

  for (const candidate of paths) {
    try {
      await stat(join(candidate, filename));
      return candidate;
    } catch {
      // Ignore and try the next candidate
    }
  }

  throw new Error(
    `Unable to find ${description}. Tried: ${paths.join(', ')}`,
  );
};

const nodeHeaderCandidates = () => {
  return compactPaths([
    process.env.npm_config_nodedir
      ? join(process.env.npm_config_nodedir, 'include', 'node')
      : null,
    join(dirname(process.execPath), 'include', 'node'),
    join(dirname(process.execPath), '..', 'include', 'node'),
    ...nodeGypCacheRootCandidates().map((cacheRoot) =>
      cacheRoot
        ? join(cacheRoot, process.versions.node, 'include', 'node')
        : null,
    ),
  ]);
};

const findNodeIncludeDir = async () => {
  return findFirstPathContaining(
    'Node headers',
    nodeHeaderCandidates(),
    'node_api.h',
  );
};

const nodeLibCandidates = (nodeIncludeDir, targetArch) => {
  const nodeRootFromIncludeDir = dirname(dirname(nodeIncludeDir));
  return compactPaths([
    process.env.npm_config_nodedir
      ? join(process.env.npm_config_nodedir, targetArch)
      : null,
    process.env.npm_config_nodedir
      ? join(process.env.npm_config_nodedir, 'lib')
      : null,
    process.env.npm_config_nodedir ?? null,
    dirname(process.execPath),
    join(dirname(process.execPath), '..', targetArch),
    nodeRootFromIncludeDir,
    join(nodeRootFromIncludeDir, targetArch),
    join(nodeRootFromIncludeDir, 'lib'),
    ...nodeGypCacheRootCandidates().map((cacheRoot) =>
      cacheRoot ? join(cacheRoot, process.versions.node, targetArch) : null,
    ),
  ]);
};

const findNodeLibDir = async (nodeIncludeDir, targetArch) => {
  return findFirstPathContaining(
    'node.lib',
    nodeLibCandidates(nodeIncludeDir, targetArch),
    'node.lib',
  );
};

const quoteCmdArgument = (argument) => {
  return `"${argument.replaceAll('"', '""')}"`;
};

const exists = async (path) => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

const findVcvarsBat = async () => {
  const vswhere = join(
    process.env['ProgramFiles(x86)'] ?? '',
    'Microsoft Visual Studio',
    'Installer',
    'vswhere.exe',
  );

  if (await exists(vswhere)) {
    try {
      const { stdout } = await execFilePromise(
        vswhere,
        [
          '-latest',
          '-products',
          '*',
          '-requires',
          'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
          '-property',
          'installationPath',
        ],
        {},
      );
      const installationPath = stdout.trim();
      if (installationPath) {
        const candidate = join(
          installationPath,
          'VC',
          'Auxiliary',
          'Build',
          'vcvars64.bat',
        );
        if (await exists(candidate)) {
          return candidate;
        }
      }
    } catch {
      // Fall back to common installation paths below.
    }
  }

  const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files';
  const commonCandidates = [
    join(
      programFiles,
      'Microsoft Visual Studio',
      '2022',
      'Community',
      'VC',
      'Auxiliary',
      'Build',
      'vcvars64.bat',
    ),
    join(
      programFiles,
      'Microsoft Visual Studio',
      '2022',
      'BuildTools',
      'VC',
      'Auxiliary',
      'Build',
      'vcvars64.bat',
    ),
    join(
      programFiles,
      'Microsoft Visual Studio',
      '2022',
      'Professional',
      'VC',
      'Auxiliary',
      'Build',
      'vcvars64.bat',
    ),
    join(
      programFiles,
      'Microsoft Visual Studio',
      '2022',
      'Enterprise',
      'VC',
      'Auxiliary',
      'Build',
      'vcvars64.bat',
    ),
  ];

  for (const candidate of commonCandidates) {
    if (await exists(candidate)) {
      return candidate;
    }
  }

  return null;
};

const build = async () => {
  const nodeIncludeDir = await findNodeIncludeDir();
  const outputDir = join(root, 'native', 'out');
  await mkdir(outputDir, { recursive: true });

  if (process.platform === 'win32') {
    const vcvarsBat = await findVcvarsBat();
    const targetArch = arch() === 'arm64' ? 'arm64' : 'x64';
    const nodeLibDir = await findNodeLibDir(nodeIncludeDir, targetArch);
    const intermediatePaths = [
      join(outputDir, 'midi-windows.exp'),
      join(outputDir, 'midi-windows.lib'),
      join(outputDir, 'midi-windows.obj'),
    ];
    const clArgs = [
      '/nologo',
      '/EHsc',
      '/std:c++17',
      '/LD',
      '/DNAPI_VERSION=9',
      `/I${nodeIncludeDir}`,
      `/Fo:${join(outputDir, 'midi-windows.obj')}`,
      join(root, 'native', 'midi-windows.cpp'),
      '/link',
      `/OUT:${join(outputDir, 'midi-windows.node')}`,
      `/IMPLIB:${join(outputDir, 'midi-windows.lib')}`,
      `/LIBPATH:${nodeLibDir}`,
      'node.lib',
      'winmm.lib',
    ];

    if (vcvarsBat) {
      await execFilePromise(
        'cmd.exe',
        [
          '/d',
          '/c',
          `call ${quoteCmdArgument(vcvarsBat)} ${targetArch} && cl ${clArgs.map(quoteCmdArgument).join(' ')}`,
        ],
        { stdio: 'inherit', windowsVerbatimArguments: true },
      );
      await Promise.all(
        intermediatePaths.map((path) => rm(path, { force: true })),
      );
      return;
    }

    await execFilePromise('cl.exe', clArgs, { stdio: 'inherit' });
    await Promise.all(
      intermediatePaths.map((path) => rm(path, { force: true })),
    );
    return;
  }

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
