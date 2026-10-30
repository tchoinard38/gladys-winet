// Smoke test API réelle : scraping portail + GetStatus (lecture seule).
import { scrapeApiKey } from '/home/tanguy/Documents/IA/Home/gladys-winet/src/portal.js';
import { api } from '/home/tanguy/Documents/IA/Home/gladys-winet/src/api.js';

const { key, deviceName } = await scrapeApiKey(process.env.WINET_USER, process.env.WINET_PASS);
console.log('portal scrape: OK, key', key.slice(0, 8) + '…, deviceName:', JSON.stringify(deviceName));
const c = await api.getStatus(key);
console.log('GetStatus:', JSON.stringify(c));
console.log('SMOKE WINET OK');
