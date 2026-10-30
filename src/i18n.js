// Textes localisés (features, modes, phases WiNET).
import { STOVE_STATUS as S } from './constants.js';

export function texts(language) {
  if (language === 'en') {
    return {
      stove: 'WiNET pellet stove',
      features: {
        mode: 'On/Off',
        setpoint: 'Target temperature',
        operating: 'Heating',
        room: 'Room temperature',
        water: 'Water temperature',
        water_setpoint: 'Water target temperature',
        flame: 'Flame',
        status: 'State',
        alarm: 'Alarm',
        power: 'Power level',
      },
      modes: { off: 'Off', heating: 'Heating' },
      phases: {
        [S.OFF]: 'Off',
        [S.WAITING_FLAME_1]: 'Waiting for flame',
        [S.WAITING_FLAME_2]: 'Waiting for flame',
        [S.IGNITION]: 'Ignition',
        [S.WORK]: 'Heating',
        [S.STANDBY]: 'Standby (setpoint reached)',
        [S.FINAL_CLEANING]: 'Final cleaning',
        [S.BRAZIER_CLEANING]: 'Brazier cleaning',
        [S.ALARM]: 'ALARM',
        [S.ALARM_MEMORY]: 'Alarm memory',
      },
    };
  }
  return {
    stove: 'Poêle à granulés WiNET',
    features: {
      mode: 'Marche / arrêt',
      setpoint: 'Température de consigne',
      operating: 'Chauffe',
      room: 'Température ambiante',
      water: "Température de l'eau",
      water_setpoint: 'Consigne température eau',
      flame: 'Flamme',
      status: 'État',
      alarm: 'Alarme',
      power: 'Niveau de puissance',
    },
    modes: { off: 'Arrêt', heating: 'Chauffe' },
    phases: {
      [S.OFF]: 'Veille (éteint)',
      [S.WAITING_FLAME_1]: 'Attente de flamme',
      [S.WAITING_FLAME_2]: 'Attente de flamme',
      [S.IGNITION]: 'Allumage',
      [S.WORK]: 'En chauffe',
      [S.STANDBY]: 'En veille (consigne atteinte)',
      [S.FINAL_CLEANING]: 'Nettoyage final',
      [S.BRAZIER_CLEANING]: 'Nettoyage du brasier',
      [S.ALARM]: 'ALARME',
      [S.ALARM_MEMORY]: "Mémoire d'alarme",
    },
  };
}
