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
  WATER: 'water',
  WATER_SETPOINT: 'water_setpoint',
  FLAME: 'flame',
  STATUS: 'status',
  ALARM: 'alarm',
  POWER: 'power',
};

/** Valeurs du cœur Gladys (server/utils/constants.js). */
export const THERMOSTAT_MODE = { OFF: 0, HEATING: 1 };
export const OPERATING_STATE = { IDLE: 0, HEATING: 1 };

/** Statuts cloud WiNET (GetStatus.Status). */
export const STOVE_STATUS = {
  OFF: 0,
  WAITING_FLAME_1: 1,
  WAITING_FLAME_2: 2,
  IGNITION: 3,
  WORK: 4,
  STANDBY: 5,
  FINAL_CLEANING: 6,
  BRAZIER_CLEANING: 7,
  ALARM: 8,
  ALARM_MEMORY: 9,
};

/** Le poêle produit de la chaleur dans ces statuts. */
export const HEATING_STATUSES = new Set([STOVE_STATUS.IGNITION, STOVE_STATUS.WORK]);
export const ALARM_STATUSES = new Set([STOVE_STATUS.ALARM, STOVE_STATUS.ALARM_MEMORY]);
/** Flamme présente ou en cours d'allumage (dérivé du statut cloud). */
export const FLAME_STATUSES = new Set([
  STOVE_STATUS.WAITING_FLAME_1,
  STOVE_STATUS.WAITING_FLAME_2,
  STOVE_STATUS.IGNITION,
  STOVE_STATUS.WORK,
  STOVE_STATUS.STANDBY,
  STOVE_STATUS.BRAZIER_CLEANING,
]);

export const SETPOINT = { min: 5, max: 40, step: 1 };
/** Consigne d'eau (poêles hydro) : plage vérifiée stove.py SetWaterTemperature. */
export const WATER_SETPOINT = { min: 5, max: 80, step: 1 };
export const POWER_LEVELS = [1, 2, 3, 4, 5];

export const LIMITS = { statusText: 200, eventText: 1000 };

export const TIMINGS = {
  httpTimeout: 15_000,
  refreshAfterCommand: 5_000,
  authRetry: 15 * 60_000,
  stateHeartbeat: 30 * 60_000,
};
