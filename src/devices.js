// L'appareil Gladys du poêle et ses états (pur). Le jeu de features reprend
// celui que l'intégration Home Assistant « thermorossi » expose pour ce poêle
// (registres lus en local sur le module WiNET) :
//   - mode        thermostat/mode : arrêt / chauffe (marche-arrêt)
//   - setpoint    thermostat/target-temperature (air, pas 0,5 °C)
//   - operating   thermostat/operating-state : le poêle est actif ou non
//   - room        temperature-sensor (sonde d'ambiance du module room-control)
//   - flame       binaire : flamme présente ou en cours d'allumage
//   - status      text : l'état en mots
//   - alarm       binaire : code alarme non nul (déclencheur de scène)
//   - alarm_msg   text : premier message d'alarme actif, sinon « Aucune »
//   - power       select : niveau de flamme 0-5 (écritable)
//   - fan         fan/speed : ventilation 1-6 (écritable)
//   - flue        temperature-sensor : température de fumée (diagnostic)
//   - pellet      binaire : réserve de granulés basse
//   - chrono      binaire : programme chronothermostat actif
import {
  DEVICE_FEATURE_CATEGORIES as C,
  DEVICE_FEATURE_TYPES as T,
  DEVICE_FEATURE_UNITS as U,
} from '@gladysassistant/integration-sdk';
import {
  ALARM_BITS,
  DEVICE_TYPE,
  FAN_LEVELS,
  FEATURES,
  FIRE_LEVELS,
  LIMITS,
  OPERATING_STATE,
  SETPOINT,
  THERMOSTAT_MODE,
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
const binary = () => sensor({ category: C.UNKNOWN, type: T.SENSOR.BINARY, min: 0, max: 1 });
const text = () => sensor({ category: C.TEXT, type: T.TEXT.TEXT, keep_history: false, min: 0, max: 0 });
const select = (levels) =>
  levels.map((level, i) => ({ value: String(level), label: String(level), sort_order: i }));

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
      named(FEATURES.FLAME, binary()),
      named(FEATURES.STATUS, text()),
      named(FEATURES.ALARM, binary()), // pas de catégorie 'alarm' dans le cœur Gladys
      named(FEATURES.ALARM_MSG, text()),
      named(FEATURES.POWER, command({ category: C.TEXT, type: T.TEXT.SELECT, keep_history: false, min: 0, max: 0, supported_options: select(FIRE_LEVELS) })),
      named(FEATURES.FAN, command({ category: C.FAN, type: T.FAN.SPEED, min: 0, max: 0, supported_options: select(FAN_LEVELS) })),
      named(FEATURES.FLUE, sensor({ category: C.TEMPERATURE_SENSOR, type: T.SENSOR.DECIMAL, unit: U.CELSIUS, min: -30, max: 400 })),
      named(FEATURES.PELLET, binary()),
      named(FEATURES.CHRONO, binary()),
    ],
  };
}

/** Repli cloud (GetStatus, champs pauvres) -> même forme que readingFromRegisters. */
export function readingFromCloudStatus(c, cloudStatusMap) {
  const status = Number(c.Status);
  const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
  const alarm = status === 8 || status === 9;
  return {
    source: 'cloud',
    statusCode: status,
    statusKey: cloudStatusMap[status] || 'unknown',
    inError: alarm,
    on: status !== 0,
    heating: status === 3 || status === 4,
    flame: [1, 2, 3, 4, 5, 7].includes(status),
    alarm,
    alarmCode: alarm ? status : 0,
    alarmBits: [],
    pelletLow: false,
    chronoActive: false,
    room: num(c.AirTemperature),
    setpoint: num(c.SetAirTemperature),
    fireLevel: Number.isFinite(Number(c.SetPower)) && Number(c.SetPower) > 0 ? Number(c.SetPower) : null,
    fanSpeed: null,
    flue: num(c.FlueTemperature),
  };
}

/** Lecture normalisée commune : { statusKey, on, heating, flame, alarm, … }. */
export function statusText(reading, language) {
  const t = texts(language);
  return (t.phases[reading.statusKey] ?? `état ${reading.statusCode}`).slice(0, LIMITS.statusText);
}

export function alarmMessage(reading, language) {
  const t = texts(language);
  if (!reading.alarm || !reading.alarmBits?.length) return t.noAlarm;
  const name = ALARM_BITS[reading.alarmBits[0]];
  return (name && t.alarms[name]) ?? t.alarmsUnknown;
}

export function buildStates(gladys, apiKey, reading, language) {
  return buildStatesFrom(idsOf(gladys, apiKey), reading, language);
}

export function buildStatesFrom(ids, reading, language) {
  const states = [];
  const push = (key, state) => {
    if (state !== null && state !== undefined) {
      states.push({ device_feature_external_id: ids.feature(key), state });
    }
  };
  push(FEATURES.MODE, reading.on ? 1 : 0);
  push(FEATURES.OPERATING, reading.heating ? 1 : 0);
  push(FEATURES.ALARM, reading.alarm ? 1 : 0);
  push(FEATURES.FLAME, reading.flame ? 1 : 0);
  push(FEATURES.ROOM, reading.room);
  push(FEATURES.SETPOINT, reading.setpoint);
  push(FEATURES.POWER, reading.fireLevel);
  push(FEATURES.FAN, reading.fanSpeed);
  push(FEATURES.FLUE, reading.flue);
  push(FEATURES.PELLET, reading.pelletLow ? 1 : 0);
  push(FEATURES.CHRONO, reading.chronoActive ? 1 : 0);
  states.push({ device_feature_external_id: ids.feature(FEATURES.STATUS), text: statusText(reading, language) });
  states.push({ device_feature_external_id: ids.feature(FEATURES.ALARM_MSG), text: alarmMessage(reading, language) });
  return states;
}
