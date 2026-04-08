# `@arcanewizards/sigil`

[![](https://img.shields.io/npm/v/@arcanewizards/sigil)](https://www.npmjs.com/package/@arcanewizards/sigil)

Application framework for Arcane-based A/V applications.

`@arcanewizards/sigil` provides the runtime glue for standing up an Arcane application, wiring backend and frontend component namespaces, and reusing shared frontend controls, dialogs, toolbars, styling helpers, and CSS assets.

## Installation

```sh
pnpm add @arcanewizards/sigil
```

## Main Entry Points

- `@arcanewizards/sigil`
  Backend/runtime exports such as `runSigilApp`, `AppShell`, `AppRoot`, `AppListenerManager`, logging contexts, and shared runtime types.
- `@arcanewizards/sigil/frontend`
  Frontend bootstrap exports such as `startSigilFrontend`, `createSigilFrontendRenderer`, `Debugger`, browser-context helpers, and shared frontend types.
- `@arcanewizards/sigil/frontend/controls`
  Shared control primitives.
- `@arcanewizards/sigil/frontend/dialogs`
  Shared dialog primitives.
- `@arcanewizards/sigil/frontend/toolbars`
  Shared toolbar primitives.
- `@arcanewizards/sigil/frontend/tooltip`
  Shared tooltip helpers and boundaries.
- `@arcanewizards/sigil/frontend/styling`
  Shared styling helpers such as `cssVariables`, `cnd`, `sigilColorUsage`, and root hint-color helpers.
- `@arcanewizards/sigil/frontend/preferences`
  Frontend preference helpers.
- `@arcanewizards/sigil/frontend/appearance`
  Appearance-switching UI.
- `@arcanewizards/sigil/frontend/styles/base.css`
- `@arcanewizards/sigil/frontend/styles/theme.css`
- `@arcanewizards/sigil/frontend/styles/sigil.css`

## Backend Usage

```ts
import { CoreComponents } from '@arcanejs/react-toolkit';
import { runSigilApp, SIGIL_COMPONENTS } from '@arcanewizards/sigil';
import pino from 'pino';

type AppApi = {
  ping: () => string;
};

const logger = pino();

const app = runSigilApp<AppApi, { greeting: string }>({
  logger,
  title: 'Example App',
  version: '0.1.0',
  appProps: { greeting: 'hello' },
  createApp: ({ setAppApi }) => {
    setAppApi({
      ping: () => 'pong',
    });

    return null;
  },
  componentNamespaces: [CoreComponents, SIGIL_COMPONENTS],
});

app.addEventListener('apiChange', (api) => {
  console.log(api?.ping());
});
```

## Frontend Usage

```ts
import { startSigilFrontend } from '@arcanewizards/sigil/frontend';

startSigilFrontend({
  appRenderers: [],
});
```

In a real app you normally pass your own frontend component renderers through `appRenderers`.

## CSS Assets

For frontend applications, import the exported styles from your app stylesheet:

```css
@import '@arcanewizards/sigil/frontend/styles/sigil.css';
@import '@arcanewizards/sigil/frontend/styles/theme.css';
@import '@arcanewizards/sigil/frontend/styles/base.css';
```

## Notes

- The package is designed for React-based Arcane applications.
- The frontend and backend APIs are intentionally split into subpath exports so consumers only import the surface they need.
