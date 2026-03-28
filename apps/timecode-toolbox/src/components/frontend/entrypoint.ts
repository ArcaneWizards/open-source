import {
  startTimecodeToolboxServerFrontend,
  TimecodeToolboxBrowserContext,
} from '.';

declare global {
  interface Window {
    BROWSER_CONTEXT?: TimecodeToolboxBrowserContext;
  }
}

startTimecodeToolboxServerFrontend(window.BROWSER_CONTEXT);
