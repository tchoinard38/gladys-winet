// La clé d'API de l'appareil, récupérée du portail ASP.NET WiNET et gardée
// dans /data (seul endroit inscriptible du conteneur) : le scraping du
// portail est lourd, on ne le refait qu'au premier démarrage ou quand la clé
// est refusée.
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

const FILE = 'winet.json';
const KEY = /^[0-9a-fA-F-]{36}$/;

export async function loadKey({ dir = '/data', logger } = {}) {
  try {
    const saved = JSON.parse(await fs.readFile(join(dir, FILE), 'utf8'));
    if (KEY.test(saved?.api_key ?? '')) return saved.api_key;
  } catch {
    // Premier démarrage.
  }
  return null;
}

export async function saveKey(apiKey, { dir = '/data', logger } = {}) {
  try {
    await fs.writeFile(join(dir, FILE), `${JSON.stringify({ api_key: apiKey })}\n`, 'utf8');
  } catch (err) {
    logger?.warn?.(`Cannot keep the WiNET key in ${dir} (${err.code ?? err.message})`);
  }
}
