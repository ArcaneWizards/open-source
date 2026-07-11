import { FC, useCallback, useContext } from 'react';

import { ControlButton } from '@arcanewizards/sigil/frontend/controls';

import { HELP_AND_SUPPORT_URL, STRINGS } from '../constants';
import { TimecodeToolboxLogo } from './logo';
import {
  ToolboxLicenseGateAcceptLicense,
  ToolboxLicenseGateComponent,
} from '../../proto';

import { StageContext } from '@arcanejs/toolkit-frontend';
import { Layout } from './core/layout';
import { Debugger, useBrowserContext } from '@arcanewizards/sigil/frontend';
import { GetEulaResponse } from '@arcanewizards/apis';
import { apiContentToReact } from '@arcanewizards/sigil/frontend/utils';
import { LoadingWrapper } from '@arcanewizards/sigil/frontend/user-actions';

type LicenseProps = {
  eula: GetEulaResponse;
  setWindowMode: (mode: null) => void;
};

export const LicenseContent: FC<{ eula: GetEulaResponse }> = ({ eula }) => {
  return (
    <div
      className="
        flex flex-col gap-2 rounded-md bg-sigil-bg-light p-2
        text-sigil-foreground
      "
    >
      <h1 className="m-0 p-0">{eula.title}</h1>
      <p className="m-0 p-0 text-sigil-foreground-muted">
        {STRINGS.licenseLastUpdated(eula.dateLastUpdated)}
      </p>
      {apiContentToReact(eula.content)}
    </div>
  );
};

export const License: FC<LicenseProps> = ({ eula, setWindowMode }) => {
  const { openExternalLink } = useBrowserContext();
  return (
    <div className="flex grow flex-col">
      <div
        className="
          flex grow basis-0 flex-col overflow-y-auto px-2 pb-2 scrollbar-sigil
        "
      >
        <TimecodeToolboxLogo className="h-[20%] max-h-[420px] min-h-[110px] w-full" />
        <LicenseContent eula={eula} />
        <div className="flex justify-center p-2">
          <ControlButton
            onClick={() => setWindowMode(null)}
            variant="large"
            icon="close"
          >
            {STRINGS.close(STRINGS.license)}
          </ControlButton>
          <ControlButton
            onClick={(e) => {
              e.preventDefault();
              openExternalLink(HELP_AND_SUPPORT_URL);
            }}
            variant="large"
            icon="help"
          >
            {STRINGS.helpAndSupport}
          </ControlButton>
        </div>
      </div>
    </div>
  );
};

type LicenseGateProps = {
  info: ToolboxLicenseGateComponent;
};

export const LicenseGate: FC<LicenseGateProps> = ({ info }) => {
  const { sendMessage } = useContext(StageContext);

  const acceptLicense = useCallback(() => {
    sendMessage?.<ToolboxLicenseGateAcceptLicense>({
      type: 'component-message',
      namespace: 'timecode-toolbox',
      component: 'license-gate',
      componentKey: info.key,
      action: 'accept-license',
    });
  }, [sendMessage, info.key]);

  return (
    <Layout
      footer
      modes={{
        debug: {
          child: () => (
            <Debugger title={STRINGS.debugger} className="size-full" />
          ),
          button: {
            icon: 'bug_report',
            title: STRINGS.debugger,
          },
        },
      }}
    >
      <div
        className="
          flex grow basis-0 flex-col overflow-y-auto px-2 pb-2 scrollbar-sigil
        "
      >
        <TimecodeToolboxLogo className="h-[20%] max-h-[420px] min-h-[110px] w-full" />
        <LoadingWrapper action={info.eula}>
          {info.eula.success && (
            <>
              <h2 className="text-center text-sigil-usage-hint-foreground">
                {STRINGS.licensePrompt(info.eula.data.title)}
              </h2>
              <LicenseContent eula={info.eula.data} />
              <div className="flex justify-center p-2">
                <ControlButton
                  onClick={acceptLicense}
                  variant="large"
                  icon="check"
                  primary
                >
                  {STRINGS.acceptLicense}
                </ControlButton>
              </div>
            </>
          )}
        </LoadingWrapper>
      </div>
    </Layout>
  );
};
