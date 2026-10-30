// L'appareil Gladys du poêle et ses états (pur) — même mapping que
// l'intégration Micronova Agua IOT du catalogue, pour que tous les poêles à
// granulés se ressemblent dans Gladys :
//   - mode        thermostat/mode : arrêt / chauffe (marche-arrêt)
//   - setpoint    thermostat/target-temperature (air)
//   - operating   thermostat/operating-state : produit de la chaleur ou non
//   - room        temperature-sensor/decimal
//   - status      text : l'état en mots
//   - alarm       binaire : 1 tant que le poêle est en alarme
//   - power       text/select : niveaux de puissance
import {
  DEVICE_FEATURE_CATEGORIES as C,
  DEVICE_FEATURE_TYPES as T,
  DEVICE_FEATURE_UNITS as U,
} from '@gladysassistant/integration-sdk';
import {
  DEVICE_TYPE,
  FEATURES,
  HEATING_STATUSES,
  LIMITS,
  OPERATING_STATE,
  POWER_LEVELS,
  SETPOINT,
  STOVE_STATUS,
  THERMOSTAT_MODE,
  ALARM_STATUSES,
} from './constants.js';
import { texts } from './i18n.js';

/** L'identifiant stable du poêle dans les ids externes : sa clé d'API WiNET. */
export function stoveId(apiKey) {
  return String(apiKey ?? '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || 'unknown';
}

export const idsOf = (gladys, apiKey) => gladys.externalIds(DEVICE_TYPE, stoveId(apiKey));

const sensor = (feature) => ({
  read_only: true,
  has_feedback: false,
  keep_history: true,
  ...feature,
});
const command = (feature) => ({
  read_only: false,
  has_feedback: true,
  keep_history: true,
  ...feature,
});

export function buildDevice(gladys, { apiKey, name, language }) {
  const ids = idsOf(gladys, apiKey);
  const t = texts(language);
  const named = (key, feature) => ({
    name: t.features[key],
    external_id: ids.feature(key),
    ...feature,
  });
  return {
    name: String(name || t.stove).slice(0, LIMITS.statusText),
    external_id: ids.device,
    should_poll: false,
    features: [
      named(
        FEATURES.MODE,
        command({
          category: C.THERMOSTAT,
          type: T.THERMOSTAT.MODE,
          min: THERMOSTAT_MODE.OFF,
          max: THERMOSTAT_MODE.HEATING,
          supported_options: [
            { value: THERMOSTAT_MODE.OFF, label: t.modes.off },
            { value: THERMOSTAT_MODE.HEATING, label: t.modes.heating },
          ],
        }),
      ),
      named(
        FEATURES.SETPOINT,
        command({
          category: C.THERMOSTAT,
          type: T.THERMOSTAT.TARGET_TEMPERATURE,
          unit: U.CELSIUS,
          min: SETPOINT.min,
          max: SETPOINT.max,
          step: SETPOINT.step,
        }),
      ),
      named(
        FEATURES.OPERATING,
        sensor({
          category: C.THERMOSTAT,
          type: T.THERMOSTAT.OPERATING_STATE,
          min: OPERATING_STATE.IDLE,
          max: OPERATING_STATE.HEATING,
        }),
      ),
      named(FEATURES.ROOM, sensor({ category: C.TEMPERATURE_SENSOR, type: T.SENSOR.DECIMAL, unit: U.CELSIUS, min: -30, max: 100 })),
      named(FEATURES.STATUS, sensor({ category: C.TEXT, type: T.TEXT.TEXT, keep_history: false, min: 0, max: 0 })),
      named(FEATURES.ALARM, sensor({ category: C.ALARM, type: T.SENSOR.BINARY, min: 0, max: 1 })),
      named(
        FEATURES.POWER,
        command({
          category: C.TEXT,
          type: T.TEXT.SELECT,
          keep_history: false,
          min: 0,
          max: 0,
          supported_options: POWER_LEVELS.map((level, i) => ({
            value: String(level),
            label: String(level),
            sort_order: i,
          })),
        }),
      ),
    ],
  };
}

/** Lecture brute GetStatus -> valeurs normalisées (le cloud renvoie 0 à l'arrêt). */
export function readingFromStatus(c) {
  const status = Number(c.Status);
  const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
  return {
    status,
    on: status !== STOVE_STATUS.OFF,
    heating: HEATING_STATUSES.has(status),
    alarm: ALARM_STATUSES.has(status),
    room: num(c.AirTemperature),
    setpoint: num(c.SetAirTemperature),
    power: Number.isFinite(Number(c.SetPower)) && Number(c.SetPower) > 0 ? Number(c.SetPower) : null,
  };
}

export function statusText(reading, language) {
  const t = texts(language);
  return (t.phases[reading.status] ?? `Statut ${reading.status}`).slice(0, LIMITS.statusText);
}

export function buildStates(gladys, apiKey, reading, language) {
  const ids = idsOf(gladys, apiKey);
  const states = [];
  const push = (key, state) => {
    if (state !== null && state !== undefined) {
      states.push({ device_feature_external_id: ids.feature(key), state });
    }
  };
  push(FEATURES.MODE, reading.on ? 1 : 0);
  push(FEATURES.OPERATING, reading.heating ? 1 : 0);
  push(FEATURES.ALARM, reading.alarm ? 1 : 0);
  push(FEATURES.ROOM, reading.room);
  push(FEATURES.SETPOINT, reading.setpoint);
  push(FEATURES.POWER, reading.power);
  states.push({
    device_feature_external_id: ids.feature(FEATURES.STATUS),
    text: statusText(reading, language),
  });
  return states;
}
