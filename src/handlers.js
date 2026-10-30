// Gestionnaires SDK, câblés à l'app (les mêmes que dans le conteneur).
import { ACTIONS } from './constants.js';

export function registerHandlers(gladys, app, logger) {
  gladys.onScanRequest(() => app.scan());
  gladys.onDeviceCreated((device) => app.deviceCreated(device));
  gladys.onDeviceUpdated((device) => app.deviceCreated(device));
  gladys.onDeviceDeleted((device) => app.deviceDeleted(device));

  gladys.onSetValue((device, feature, value) => app.setValue(device, feature, value));

  gladys.onAction(ACTIONS.TEST, () => app.testConnection());

  gladys.onConfigUpdated((config) => {
    logger?.info('Configuration updated: logging in again');
    return app.start(config, { force: true });
  });

  gladys.on('connected', async () => {
    try {
      await app.start(await gladys.getConfig());
    } catch (err) {
      logger?.error('Start failed', err);
    }
  });
}
