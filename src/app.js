// Orchestration : connexion portail -> clé d'API, boucle de lecture,
// commandes, découverte. L'intégration ne crée JAMAIS d'appareils elle-même :
// elle publie la découverte, l'utilisateur choisit.

import { logger } from '@gladysassistant/integration-sdk';
import { api } from './api.js';
import { normalizeConfig } from './config.js';
import { buildDevice, buildStates, idsOf, readingFromStatus, stoveId } from './devices.js';
import {
  ALARM_STATUSES,
  FEATURES,
  SCENE_TRIGGERS,
  TIMINGS,
  WATER_SETPOINT,
} from './constants.js';
import { scrapeApiKey } from './portal.js';
import { loadKey, saveKey } from './storage.js';

export class WinetApp {
  constructor({ gladys }) {
    this.gladys = gladys;
    this.cfg = normalizeConfig();
    this.key = null;
    this.deviceName = '';
    this.timer = null;
    this.lastAlarm = false;
    this.baselineTaken = false;
    this.authBackoffUntil = 0;
    this.watched = new Set();
  }

  async start(rawConfig, { force = false } = {}) {
    this.stop();
    this.cfg = normalizeConfig(rawConfig);
    if (this.cfg.missing.length) {
      await this.setStatus(false, { en: 'Fill in the configuration', fr: 'Complétez la configuration' });
      return;
    }
    await this.ensureKey({ force });
    this.schedule();
    this.refresh().catch((err) => logger.warn('first refresh failed', err.message));
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  schedule() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.refresh().catch((err) => logger.error('Refresh failed', err));
    }, this.cfg.refreshInterval * 1000);
  }

  async setStatus(connected, message) {
    try {
      await this.gladys.setConnectionStatus(connected, message);
    } catch (err) {
      logger?.warn?.('setConnectionStatus failed', err.message);
    }
  }

  /** Clé en /data, sinon scraping du portail (retry après un backoff). */
  async ensureKey({ force = false } = {}) {
    if (!force) {
      const saved = await loadKey({ logger });
      if (saved) {
        this.key = saved;
        await this.setStatus(true);
        return;
      }
    }
    if (Date.now() < this.authBackoffUntil) return;
    try {
      const { key, deviceName } = await scrapeApiKey(this.cfg.email, this.cfg.password, { logger });
      this.key = key;
      if (deviceName && !this.cfg.deviceName) this.deviceName = deviceName;
      await saveKey(key, { logger });
      await this.setStatus(true);
      logger.info('WiNET api key obtained from the portal');
    } catch (err) {
      this.key = null;
      this.authBackoffUntil = Date.now() + TIMINGS.authRetry;
      await this.setStatus(false, {
        en: 'WiNET portal login failed',
        fr: 'Connexion au portail WiNET impossible',
      });
      logger.error('Portal login failed', err);
    }
  }

  /** @param {object} device un device Gladys de cette intégration */
  idsFor(device) {
    const platformId = String(device.external_id).split(':').pop();
    return { ...idsOf(this.gladys, platformId), platformId };
  }

  async scan() {
    if (this.cfg.missing.length) {
      await this.ensureKey();
    }
    if (!this.key) {
      await this.ensureKey({ force: true });
    }
    if (!this.key) throw new Error('WiNET portal not reachable: check the credentials');
    const language = this.cfg.language;
    const name = this.cfg.deviceName || this.deviceName;
    await this.gladys.publishDiscoveredDevices([buildDevice(this.gladys, { apiKey: this.key, name, language })]);
  }

  deviceCreated(device) {
    if (String(device.external_id).includes(`:${'stove'}:`)) this.watched.add(device.external_id);
  }
  deviceDeleted(device) {
    this.watched.delete(device.external_id);
  }

  async refresh() {
    if (!this.key) {
      if (Date.now() >= this.authBackoffUntil) await this.ensureKey({ force: true });
      if (!this.key) return;
    }
    let c;
    try {
      c = await api.getStatus(this.key);
    } catch (err) {
      logger.warn('GetStatus failed', err.message);
      return;
    }
    if (!c.Success) {
      // Clé probablement tournante : on la ressaisit du portail une fois.
      logger.warn(`WiNET refused the key (${c.ErrorDescription ?? c.Error}); rescraping`);
      await this.ensureKey({ force: true });
      return;
    }
    const reading = readingFromStatus(c);
    const states = buildStates(this.gladys, this.key, reading, this.cfg.language);
    await this.gladys.publishChangedStates(states, { heartbeat: TIMINGS.stateHeartbeat });

    // Gâchette de scène : une seule fois par alarme, la première lecture est
    // la référence après un démarrage.
    if (!this.baselineTaken) {
      this.baselineTaken = true;
      this.lastAlarm = reading.alarm;
    } else if (reading.alarm && !this.lastAlarm) {
      await this.gladys.publishSceneEvent(SCENE_TRIGGERS.STOVE_ALARM, {
        status: reading.status,
        status_text: reading.status >= 0 ? `${reading.status}` : '',
        alarm: 1,
      }).catch((err) => logger.warn('scene event failed', err.message));
    }
    if (!ALARM_STATUSES.has(reading.status)) this.lastAlarm = reading.alarm;
  }

  async setValue(device, feature, value) {
    if (!this.key) {
      await this.ensureKey({ force: true });
      if (!this.key) throw new Error('WiNET cloud not reachable');
    }
    const deviceId = String(device.external_id);
    const key = String(feature.external_id).slice(deviceId.length + 1);
    const ids = this.idsFor(device);
    let result;
    if (key === FEATURES.MODE) {
      const on = Number(value) !== 0;
      result = on ? await api.ignit(this.key) : await api.shutdown(this.key);
      if (!result.Success) throw new Error(`WiNET refused: ${result.ErrorDescription ?? 'error'}`);
      await this.gladys.publishState(ids.feature(FEATURES.MODE), on ? 1 : 0);
    } else if (key === FEATURES.SETPOINT) {
      const v = Math.round(Number(value));
      if (!Number.isFinite(v)) throw new Error('invalid setpoint');
      result = await api.setTemperature(this.key, v);
      if (!result.Success) throw new Error(`WiNET refused: ${result.ErrorDescription ?? 'error'}`);
      await this.gladys.publishState(ids.feature(FEATURES.SETPOINT), v);
    } else if (key === FEATURES.WATER_SETPOINT) {
      const v = Math.round(Number(value));
      if (!Number.isFinite(v) || v < WATER_SETPOINT.min || v > WATER_SETPOINT.max) {
        throw new Error(`water setpoint ${WATER_SETPOINT.min}..${WATER_SETPOINT.max}`);
      }
      result = await api.setWaterTemperature(this.key, v);
      if (!result.Success) throw new Error(`WiNET refused: ${result.ErrorDescription ?? 'error'}`);
      await this.gladys.publishState(ids.feature(FEATURES.WATER_SETPOINT), v);
    } else if (key === FEATURES.POWER) {
      const v = Number(value);
      if (!Number.isFinite(v) || v < 1 || v > 5) throw new Error('power level 1..5');
      result = await api.setPower(this.key, v);
      if (!result.Success) throw new Error(`WiNET refused: ${result.ErrorDescription ?? 'error'}`);
      await this.gladys.publishState(feature.external_id, { text: String(v) });
    } else {
      throw new Error(`unknown feature ${key}`);
    }
    // Relire le poêle réel juste après, pour confirmer dans Gladys.
    setTimeout(() => this.refresh().catch(() => {}), TIMINGS.refreshAfterCommand);
  }

  async testConnection() {
    if (this.cfg.missing.length) throw new Error(`missing configuration: ${this.cfg.missing.join(', ')}`);
    const { key, deviceName } = await scrapeApiKey(this.cfg.email, this.cfg.password, { logger });
    this.key = key;
    if (deviceName && !this.cfg.deviceName) this.deviceName = deviceName;
    await saveKey(key, { logger });
    const c = await api.getStatus(key);
    if (!c.Success) throw new Error(c.ErrorDescription || 'the cloud refused the key');
    await this.setStatus(true);
    const reading = readingFromStatus(c);
    this.baselineTaken = true;
    this.lastAlarm = reading.alarm;
    return {
      key_prefix: stoveId(key).slice(0, 8),
      message: {
        en: `Connected: stove state ${c.StatusDescription ?? reading.status}`,
        fr: `Connecté : état du poêle ${c.StatusDescription ?? reading.status}`,
      },
    };
  }
}
