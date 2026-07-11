import { FC, useCallback, useEffect, useState } from 'react';
import { C } from './components/backend';
import { useDataFileContext } from '@arcanejs/react-toolkit/data';
import { ToolboxConfigData } from './config';
import { v7 as uuidv7 } from 'uuid';
import { useLogger } from '@arcanewizards/sigil';
import { ArcaneWizardsApi, GetEulaResponse } from '@arcanewizards/apis';
import {
  InternalUserActionState,
  prepareUserActionsState,
} from '@arcanewizards/sigil/frontend/user-actions';

type EulaGateProps = {
  api: ArcaneWizardsApi;
};

export const EulaGate: FC<EulaGateProps> = ({ api }) => {
  const { updateData } = useDataFileContext(ToolboxConfigData);

  const logger = useLogger();

  const [eula, setEula] = useState<InternalUserActionState<GetEulaResponse>>({
    type: 'loading',
  });

  useEffect(() => {
    api
      .getEula({
        app: 'timecode-toolbox',
      })
      .then((data) => {
        setEula({
          type: 'success',
          data,
        });
      })
      .catch((cause) => {
        const error = new Error(
          'Failed to fetch EULA, please restart the app and try again.',
          { cause },
        );
        logger.error(error);
        setEula({
          type: 'error',
          title: error.message,
          details: cause && new String(cause),
        });
      });
  }, [api, logger]);

  const acceptLicense = useCallback(() => {
    if (eula.type !== 'success') {
      throw new Error('Cannot accept license before EULA is ready');
    }
    logger.info(`EULA accepted: ${eula.data.dateLastUpdated}`);
    updateData((current) => ({
      ...current,
      agreedToEula: {
        content: eula.data,
        dateAgreedOnMillis: Date.now(),
        updateId: uuidv7(),
      },
    }));
  }, [updateData, eula, logger]);

  return (
    <C.LicenseGate
      eula={prepareUserActionsState(eula)}
      onAcceptLicense={acceptLicense}
    />
  );
};
