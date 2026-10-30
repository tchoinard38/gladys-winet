// API JSON du cloud WiNET (ws.cloudwinet.it, WCF .svc). Port fidèle du
// client Python éprouvé. Le WAF du cloud rejette certains User-Agent : on
// garde celui du hub maison, vérifié.

import { TIMINGS } from './constants.js';

export const CLOUD = 'https://ws.cloudwinet.it/WiNetStove.svc/json';
const UA = 'thermorossi-local/1.0';

async function call(method, apiKey, suffix) {
  const url = `${CLOUD}/${method}/${apiKey}${suffix ? `;${suffix}` : ''}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(TIMINGS.httpTimeout),
  });
  if (!res.ok) throw new Error(`winet cloud http ${res.status}`);
  return res.json();
}

export const api = {
  getStatus: (key) => call('GetStatus', key),
  ignit: (key) => call('Ignit', key),
  shutdown: (key) => call('Shutdown', key),
  setPower: (key, level) => call('SetPower', key, String(level)),
  setTemperature: (key, value) => call('SetTemperature', key, String(value)),
};
