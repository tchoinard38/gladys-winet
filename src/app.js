// Orchestration : source principale = API locale du module WiNET (registres,
// comme l'intégration Home Assistant « thermorossi »), repli = portail + cloud.
// La clé d'API du portail reste l'identifiant stable de l'appareil.
// L'intégration ne crée JAMAIS d'appareils elle-même : elle publie la découverte.

import { logger } from '@gladysassistant/integration-sdk';
import { api } from './api.js';
import { normalizeConfig } from './config.js';
import {
  buildDevice,
  buildStates,
  idsOf,
  readingFromCloudStatus,
  stoveId,
} from './devices.js';
import { LocalStoveApi, readingFromRegisters } from './local.js';
import {
  CLOUD_STATUS,
  FAN_LEVELS,
  FEATURES,
  FIRE_LEVELS,
  LOCAL_API,
  SCENE_TRIGGERS,
  SETPOINT,
  TIMINGS,
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
    this.localBackoffUntil = 0;
    this.local = null;
    this.watched = new Set();
  }

  async start(rawConfig, { force = false } = {}) {
    this.stop();
    this.cfg = normalizeConfig(rawConfig);
    this.local = this.cfg.stoveIp ? new LocalStoveApi(this.cfg.stoveIp) : null;
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
      if (!this.local) {
        await this.setStatus(false, {
          en: 'WiNET portal login failed',
          fr: 'Connexion au portail WiNET impossible',
        });
      }
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
    if (String(device.external_id).includes(':stove:')) this.watched.add(device.external_id);
  }
  deviceDeleted(device) {
    this.watched.delete(device.external_id);
  }

  /** Lecture locale (riche), sinon lecture cloud (pauvre). */
  async readStove() {
    if (this.local && Date.now() >= this.localBackoffUntil) {
      try {
        const regs = await this.local.registers();
        if (this.localBackoffUntil) logger.info('WiNET local API is back');
        this.localBackoffUntil = 0;
        await this.setStatus(true);
        return readingFromRegisters(regs);
      } catch (err) {
        this.localBackoffUntil = Date.now() + LOCAL_API.localRetry;
        logger.warn(`WiNET local API (${this.cfg.stoveIp}) unreachable: ${err.message}; falling back to cloud`);
      }
    }
    if (!this.key && Date.now() >= this.authBackoffUntil) await this.ensureKey();
    if (!this.key) return null;
    let c;
    try {
      c = await api.getStatus(this.key);
    } catch (err) {
      logger.warn('GetStatus failed', err.message);
      return null;
    }
    if (!c.Success) {
      // Clé probablement tournante : on la ressaisit du portail une fois.
      logger.warn(`WiNET refused the key (${c.ErrorDescription ?? c.Error}); rescraping`);
      await this.ensureKey({ force: true });
      return null;
    }
    await this.setStatus(true);
    return readingFromCloudStatus(c, CLOUD_STATUS);
  }

  async refresh() {
    const reading = await this.readStove();
    if (!reading) return;
    const states = buildStates(this.gladys, this.key, reading, this.cfg.language);
    await this.gladys.publishChangedStates(states, { heartbeat: TIMINGS.stateHeartbeat });

    // Gâchette de scène : une seule fois par alarme, la première lecture est
    // la référence après un démarrage.
    if (!this.baselineTaken) {
      this.baselineTaken = true;
      this.lastAlarm = reading.alarm;
    } else if (reading.alarm && !this.lastAlarm) {
      await this.gladys.publishSceneEvent(SCENE_TRIGGERS.STOVE_ALARM, {
        status: reading.statusCode,
        alarm: 1,
      }).catch((err) => logger.warn('scene event failed', err.message));
    }
    if (!reading.alarm) this.lastAlarm = false;
  }

  /** Écrire via l'API locale si disponible, sinon via le cloud. */
  async localWrite(fn) {
    if (!this.local || Date.now() < this.localBackoffUntil) return false;
    try {
      await fn(this.local);
      this.localBackoffUntil = 0;
      return true;
    } catch (err) {
      logger.warn(`local WiNET write failed: ${err.message}`);
      return false;
    }
  }

  async ensureCloudKey() {
    if (!this.key) {
      await this.ensureKey({ force: true });
      if (!this.key) throw new Error('WiNET cloud not reachable');
    }
  }

  async setValue(device, feature, value) {
    const deviceId = String(device.external_id);
    const key = String(feature.external_id).slice(deviceId.length + 1);
    const ids = this.idsFor(device);

    if (key === FEATURES.MODE) {
      const on = Number(value) !== 0;
      const done = await this.localWrite((l) => (on ? l.turnOn() : l.turnOff()));
      if (!done) {
        await this.ensureCloudKey();
        const result = on ? await api.ignit(this.key) : await api.shutdown(this.key);
        if (!result.Success) throw new Error(`WiNET refused: ${result.ErrorDescription ?? 'error'}`);
      }
      await this.gladys.publishState(ids.feature(FEATURES.MODE), on ? 1 : 0);
    } else if (key === FEATURES.SETPOINT) {
      const v = Number(value);
      if (!Number.isFinite(v) || v < SETPOINT.min || v > SETPOINT.max) {
        throw new Error(`consigne ${SETPOINT.min}..${SETPOINT.max} °C`);
      }
      const done = await this.localWrite((l) => l.setSetpoint(v));
      if (!done) {
        await this.ensureCloudKey();
        const result = await api.setTemperature(this.key, Math.round(v));
        if (!result.Success) throw new Error(`WiNET refused: ${result.ErrorDescription ?? 'error'}`);
      }
      await this.gladys.publishState(ids.feature(FEATURES.SETPOINT), v);
    } else if (key === FEATURES.POWER) {
      const v = Number(value);
      if (!Number.isFinite(v) || !FIRE_LEVELS.includes(v)) throw new Error(`niveau de flamme ${FIRE_LEVELS.join('-')}`);
      const done = await this.localWrite((l) => l.setFireLevel(v));
      if (!done) {
        if (v < 1) throw new Error('niveau 0 uniquement via le module local');
        await this.ensureCloudKey();
        const result = await api.setPower(this.key, v);
        if (!result.Success) throw new Error(`WiNET refused: ${result.ErrorDescription ?? 'error'}`);
      }
      await this.gladys.publishState(feature.external_id, { text: String(v) });
    } else if (key === FEATURES.FAN) {
      const v = Number(value);
      if (!Number.isFinite(v) || !FAN_LEVELS.includes(v)) throw new Error(`ventilation ${FAN_LEVELS.join('-')}`);
      const done = await this.localWrite((l) => l.setFanSpeed(v));
      if (!done) throw new Error('ventilation : module WiNET local injoignable');
      await this.gladys.publishState(feature.external_id, { text: String(v) });
    } else {
      throw new Error(`unknown feature ${key}`);
    }
    // Relire le poêle réel juste après, pour confirmer dans Gladys.
    setTimeout(() => this.refresh().catch(() => {}), TIMINGS.refreshAfterCommand);
  }

  async testConnection() {
    if (this.cfg.missing.length) throw new Error(`missing configuration: ${this.cfg.missing.join(', ')}`);
    const sources = [];
    if (this.local) {
      try {
        const st = await this.local.moduleStatus();
        this.localBackoffUntil = 0;
        sources.push(`module WiNET local OK (firmware ${st.fwVer ?? '?'})`);
      } catch (err) {
        this.localBackoffUntil = Date.now() + LOCAL_API.localRetry;
        sources.push(`module local injoignable (${err.message})`);
      }
    }
    const { key, deviceName } = await scrapeApiKey(this.cfg.email, this.cfg.password, { logger });
    this.key = key;
    if (deviceName && !this.cfg.deviceName) this.deviceName = deviceName;
    await saveKey(key, { logger });
    const c = await api.getStatus(key);
    if (!c.Success) throw new Error(c.ErrorDescription || 'the cloud refused the key');
    sources.push('cloud WiNET OK');
    await this.setStatus(true);
    const reading = await this.readStove();
    if (reading) {
      this.baselineTaken = true;
      this.lastAlarm = reading.alarm;
    }
    return {
      key_prefix: stoveId(key).slice(0, 8),
      message: {
        en: `Connected: ${sources.join(', ')}`,
        fr: `Connecté : ${sources.join(', ')}`,
      },
    };
  }
}
