// Configuration du manifeste `config_schema`, normalisée.
import { REFRESH_INTERVAL } from './constants.js';

export const DEFAULTS = {
  email: '',
  password: '',
  device_name: '',
  language: 'fr',
  refresh_interval: REFRESH_INTERVAL.default,
};

/** @returns {{email:string,password:string,deviceName:string,language:string,refreshInterval:number,missing:string[]}} */
export function normalizeConfig(raw = {}) {
  const given = Object.fromEntries(
    Object.entries(raw ?? {}).filter(([, v]) => v !== null && v !== undefined),
  );
  const c = { ...DEFAULTS, ...given };
  const email = String(c.email ?? '').trim();
  const password = String(c.password ?? '');
  const deviceName = String(c.device_name ?? '').trim();
  const language = c.language === 'en' ? 'en' : 'fr';
  const interval = Number(c.refresh_interval);
  const missing = [];
  if (email === '') missing.push('email');
  if (password === '') missing.push('password');
  return {
    email,
    password,
    deviceName,
    language,
    refreshInterval: Number.isFinite(interval)
      ? Math.max(REFRESH_INTERVAL.min, Math.min(REFRESH_INTERVAL.max, Math.round(interval)))
      : REFRESH_INTERVAL.default,
    missing,
  };
}
