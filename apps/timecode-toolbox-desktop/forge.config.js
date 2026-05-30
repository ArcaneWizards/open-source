/* eslint-disable turbo/no-undeclared-env-vars */

const PACKAGED_RUNTIME_DEPENDENCIES = [
  '@arcanewizards/electron-media-service',
  '@arcanewizards/midi',
  'bindings',
  'file-uri-to-path',
  'material-symbols',
  'nan',
  'semver',
];

const STRICT_FILTERS = {
  '/node_modules/@arcanewizards/midi': ['dist', 'native', 'package.json'],
};

const PACKAGED_RUNTIME_DEPENDENCY_PATHS = PACKAGED_RUNTIME_DEPENDENCIES.map(
  (dependency) => `/node_modules/${dependency}`,
);

const PACKAGED_RUNTIME_SCOPE_PATHS = [
  ...new Set(
    PACKAGED_RUNTIME_DEPENDENCIES.filter((dependency) =>
      dependency.startsWith('@'),
    ).map((dependency) => `/node_modules/${dependency.split('/')[0]}`),
  ),
];

const shouldIgnorePackagedPath = (filePath) => {
  if (filePath === '/node_modules' || !filePath.startsWith('/node_modules')) {
    return false;
  }

  if (PACKAGED_RUNTIME_SCOPE_PATHS.includes(filePath)) {
    return false;
  }

  const matchesSubpath = PACKAGED_RUNTIME_DEPENDENCY_PATHS.some(
    (dependencyPath) =>
      filePath === dependencyPath || filePath.startsWith(`${dependencyPath}/`),
  );

  if (matchesSubpath) {
    for (const [strictPath, allowedSubpaths] of Object.entries(
      STRICT_FILTERS,
    )) {
      if (filePath.startsWith(strictPath)) {
        const relativePath = filePath.substring(strictPath.length);
        let isIgnored = true;
        if (relativePath === '' || relativePath === '/') {
          isIgnored = false;
        } else {
          for (const allowedSubpath of allowedSubpaths) {
            if (
              relativePath === `/${allowedSubpath}` ||
              relativePath.startsWith(`/${allowedSubpath}/`)
            ) {
              isIgnored = false;
              break;
            }
          }
        }
        return isIgnored;
      }
      return false;
    }
  }
  return true;
};

module.exports = {
  packagerConfig: {
    name: 'Timecode Toolbox Desktop',
    executableName: 'timecode-toolbox-desktop',
    appBundleId: 'com.arcanewizards.timecode-toolbox-desktop',
    icon: 'assets/icon',
    appCategoryType: 'public.app-category.music',
    derefSymlinks: true,
    prune: false,
    ignore: shouldIgnorePackagedPath,
    extendInfo: {
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: false,
      },
    },
    osxSign:
      process.env.FULL_BUILD == 'false'
        ? undefined
        : {
            /* must exist to enable notarization */
          },
    osxNotarize:
      process.env.FULL_BUILD == 'false'
        ? undefined
        : process.env.RUNNER_TEMP
          ? {
              // CI notarization config
              appleApiKey: `${process.env.RUNNER_TEMP}/AuthKey_${process.env.APPLE_API_KEY_ID}.p8`,
              appleApiKeyId: process.env.APPLE_API_KEY_ID,
              appleApiIssuer: process.env.APPLE_API_ISSUER,
            }
          : {
              // Local notarization config (for development/testing)
              keychainProfile: 'APPLE_API_KEY',
            },
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'TimecodeToolboxDesktop',
        setupIcon: 'assets/icon.ico',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: [],
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        name: 'Timecode Toolbox Desktop',
        icon: 'assets/icon.icns',
      },
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
};
