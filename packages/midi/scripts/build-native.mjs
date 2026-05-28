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

const findNodeIncludeDir = async () => {
  const nodeIncludeCandidates = [
    process.env.npm_config_nodedir
      ? join(process.env.npm_config_nodedir, 'include', 'node')
      : null,
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
    join(
      process.env.LOCALAPPDATA ?? '',
      'node-gyp',
      'Cache',
      process.versions.node,
      'include',
      'node',
    ),
    join(
      process.env.USERPROFILE ?? '',
      '.node-gyp',
      process.versions.node,
      'include',
      'node',
    ),
  ].filter(Boolean);

  for (const candidate of nodeIncludeCandidates) {
    try {
      await stat(join(candidate, 'node_api.h'));
      return candidate;
    } catch {
      // Ignore and try the next candidate
    }
  }

  throw new Error(
    `Unable to find Node headers. Tried: ${nodeIncludeCandidates.join(', ')}`,
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
  const outputDir = join(root, 'native', 'dist');
  await mkdir(outputDir, { recursive: true });

  if (process.platform === 'win32') {
    const vcvarsBat = await findVcvarsBat();
    const nodeVersionDir = dirname(dirname(nodeIncludeDir));
    const targetArch = arch() === 'arm64' ? 'arm64' : 'x64';
    const nodeLibDir = join(nodeVersionDir, targetArch);
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
      await Promise.all(intermediatePaths.map((path) => rm(path, { force: true })));
      return;
    }

    await execFilePromise('cl.exe', clArgs, { stdio: 'inherit' });
    await Promise.all(intermediatePaths.map((path) => rm(path, { force: true })));
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
