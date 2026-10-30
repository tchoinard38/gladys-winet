// Scraping du portail thermorossi.cloudwinet.it (ASP.NET webforms) pour
// récupérer la clé d'API de l'appareil, port fidèle du client Python éprouvé
// (Maison/services/stove.py). Le module WiNET envoie sa clé par appareil ;
// elle sert ensuite à l'API JSON WCF (api.js).

import { TIMINGS } from './constants.js';

export const PORTAL = 'https://thermorossi.cloudwinet.it';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) thermorossi-gladys/1.0';

class Jar {
  constructor() {
    this.cookies = new Map();
  }
  apply(res) {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const pair = c.split(';')[0];
      const i = pair.indexOf('=');
      if (i > 0) this.cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
  }
  header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

async function portalFetch(url, { method = 'GET', body, headers = {}, jar } = {}) {
  // Le portail ASP.NET définit sa culture depuis Accept-Language : sans en-tête,
  // il répond 500 « impostazioni cultura non supportate ».
  const res = await fetch(url, {
    method,
    body,
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'fr,en',
      ...headers,
      ...(jar ? { Cookie: jar.header() } : {}),
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMINGS.httpTimeout),
  });
  jar?.apply(res);
  return res;
}

/**
 * Login + postback comme le fait le navigateur du portail ; renvoie la clé
 * d'API de l'appareil (le postback de login affiche MyDevices).
 * @returns {Promise<{key:string}>}
 */
export async function scrapeApiKey(email, password, { logger } = {}) {
  const jar = new Jar();
  const html = await (await portalFetch(`${PORTAL}/`, { jar })).text();

  const fields = {};
  for (const m of html.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const n = /name="([^"]*)"/.exec(m[0]);
    const v = /value="([^"]*)"/.exec(m[0]);
    if (n) fields[n[1]] = v ? v[1] : '';
  }

  const res = await portalFetch(`${PORTAL}/Login.aspx/VerifyLogin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ username: email, password }),
    jar,
  });
  const outer = await res.json();
  const d = JSON.parse(outer.d ?? outer.D ?? '{}');
  if (!d.result) throw new Error(d.errMessage || 'portal login failed');

  fields.__SENDER = 'dologin';
  fields.__ARGS = `${d.key};false`;
  const page = await (
    await portalFetch(`${PORTAL}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields).toString(),
      jar,
    })
  ).text();

  const m = page.match(/API[^<]*:\s*<\/strong>\s*<span>\s*([0-9a-fA-F-]{36})/);
  if (!m) throw new Error('api key not found in the portal page');
  const deviceName = page.match(/MyDevices[\s\S]{0,800}?>([^<>]{3,40})<\/(?:td|span)>/)?.[1]?.trim();
  return { key: m[1], deviceName };
}
