// Entry point : câblage SDK uniquement. Les variables d'environnement du
// superviseur Gladys (GLADYS_HOST_API_URL, GLADYS_INTEGRATION_TOKEN,
// GLADYS_INTEGRATION_SELECTOR) sont lues par le SDK.
import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { WinetApp } from './src/app.js';
import { registerHandlers } from './src/handlers.js';

const gladys = new GladysIntegration();
const app = new WinetApp({ gladys });

registerHandlers(gladys, app, logger);
gladys.handleShutdown(() => app.stop());

logger.info('Starting the Thermorossi WiNET integration...');
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
