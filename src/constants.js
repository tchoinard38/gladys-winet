// Clés partagées avec le manifeste (gelées : les utilisateurs les stockent
// dans leurs scènes et leur configuration) + réglages de l'intégration.

export const ACTIONS = { TEST: 'test_connection' };
export const SCENE_TRIGGERS = { STOVE_ALARM: 'stove_alarm' };

/** Intervalle de rafraîchissement (secondes), miroir du manifeste. */
export const REFRESH_INTERVAL = { min: 60, max: 3600, default: 120 };

/** Type de device des ids externes : ext:<selector>:stove:<id>. */
export const DEVICE_TYPE = 'stove';

/** Clés de features, fin des ids externes de feature : ne jamais renommer. */
export const FEATURES = {
  MODE: 'mode',
  SETPOINT: 'setpoint',
  OPERATING: 'operating',
  ROOM: 'room',
  FLAME: 'flame',
  STATUS: 'status',
  ALARM: 'alarm',
  ALARM_MSG: 'alarm_msg',
  POWER: 'power',
  FAN: 'fan',
  FLUE: 'flue',
  PELLET: 'pellet',
  CHRONO: 'chrono',
};

/** Valeurs du cœur Gladys (server/utils/constants.js). */
export const THERMOSTAT_MODE = { OFF: 0, HEATING: 1 };
export const OPERATING_STATE = { IDLE: 0, HEATING: 1 };

// ---------------------------------------------------------------------------
// Source principale : API HTTP locale du module WiNET (Micronova), la même que
// lit l'intégration Home Assistant « thermorossi ». Registres catégorie 1.
// ---------------------------------------------------------------------------
export const LOCAL_API = {
  getRegistersPath: '/ajax/get-registers',
  setRegisterPath: '/ajax/set-register',
  getStatusPath: '/ajax/get-status',
  readKey: '020',
  setKey: '002',
  commandRegId: 1,
  cmdOn: 23040, // 0x5A00
  cmdOff: 42240, // 0xA500
  requestTimeoutMs: 10_000,
  localRetry: 5 * 60_000,
};

export const REG = {
  STATUS: 6, // & 0xFF = code état
  FLAGS: 7, // bit0 chrono, bit6 room-control, bit7 eco
  ALARM_LSB: 8,
  ALARM_MSB: 9,
  PELLET: 10, // 0 = OK, sinon réserve basse/vide
  FIRE_LEVEL: 12, // niveau de flamme 0-5
  FAN_SPEED: 13, // ventilation 1-6
  SET_TEMP: 15, // consigne : raw * 0.25 - 18
  AIR_TEMP: 16, // sonde d'ambiance (module room-control) : raw 0 = absente
  FLUE_TEMP: 21, // température fumées, °C bruts
  RTC: 22,
};

/** Etats locaux (registre 6 & 0xFF) -> clés de texte. */
export const LOCAL_STATUS = {
  0: 'off', 1: 'off', 2: 'start', 3: 'work', 4: 'wait_on', 5: 'temp_ok',
  6: 'no_prog', 7: 'wait_time', 8: 'stop', 9: 'sunout',
};
export const LOCAL_ACTIVE = new Set([2, 3, 4, 5, 6]);
export const LOCAL_ERROR = 8;

/** Bits du code alarme 32 bits (registre 9 << 16 | registre 8). */
export const ALARM_BITS = {
  0: 'no_pellets', 1: 'start_failed', 2: 'flue_blocked', 3: 'max_temp',
  4: 'flue_probe', 5: 'extractor_rpm', 6: 'extractor_fault', 7: 'seismic',
  8: 'probe_s1', 9: 'probe_s2', 10: 'probe_dtu', 11: 'probe_ssa',
  12: 'cleaning_motor', 13: 'ashes_full', 14: 'ashes_missing', 15: 'screen_timeout',
  16: 'probe_ast',
};

export const TEMP = { mul: 0.25, offset: -18 };

// ---------------------------------------------------------------------------
// Repli : portail + cloud WiNET (champs beaucoup plus pauvres).
// ---------------------------------------------------------------------------
export const CLOUD_API = {
  baseUrl: 'https://ws.cloudwinet.it/WiNetStove.svc/json',
  portalUrl: 'https://thermorossi.cloudwinet.it',
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) thermorossi-gladys/1.0',
  requestTimeoutMs: 15_000,
};

/** Statuts cloud GetStatus.Status -> mêmes clés de texte que le local. */
export const CLOUD_STATUS = {
  0: 'off', 1: 'start', 2: 'start', 3: 'start', 4: 'work', 5: 'temp_ok',
  6: 'cleaning', 7: 'cleaning', 8: 'stop', 9: 'stop',
};

// ---- bornes des réglages ----
export const SETPOINT = { min: 7, max: 30, step: 0.5 };
export const FIRE_LEVELS = [0, 1, 2, 3, 4, 5];
export const FAN_LEVELS = [1, 2, 3, 4, 5, 6];

export const LIMITS = { statusText: 200, eventText: 1000 };

export const TIMINGS = {
  httpTimeout: 15_000,
  refreshAfterCommand: 5_000,
  authRetry: 15 * 60_000,
  stateHeartbeat: 30 * 60_000,
};
