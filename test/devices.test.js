// Tests des conversions WiNET (registres locaux, alarmes, repli cloud).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readingFromRegisters,
  computeAlarmCode,
  activeAlarmBits,
  toCelsius,
} from '../src/local.js';
import { readingFromCloudStatus, buildStatesFrom } from '../src/devices.js';
import { CLOUD_STATUS, FEATURES } from '../src/constants.js';

const ids = { feature: (k) => `ext:x:stove:abc:${k}` };

test('registres du poêle réel (éteint) -> lecture normalisée', () => {
  const regs = { 6: 1, 7: 0, 8: 0, 9: 0, 10: 0, 12: 0, 13: 1, 15: 162, 16: 0, 21: 21 };
  const r = readingFromRegisters(regs);
  assert.equal(r.statusKey, 'off');
  assert.equal(r.on, false);
  assert.equal(r.setpoint, 22.5);
  assert.equal(r.room, null); // pas de module room-control
  assert.equal(r.fireLevel, 0);
  assert.equal(r.fanSpeed, 1);
  assert.equal(r.flue, 21);
  assert.equal(r.alarm, false);
});

test('températures: raw * 0.25 - 18', () => {
  assert.equal(toCelsius(162), 22.5);
  assert.equal(toCelsius(140), 17);
});

test('en chauffe: actif, flamme, chrono et granulés OK', () => {
  const regs = { 6: 3, 7: 1, 8: 0, 9: 0, 10: 0, 12: 2, 13: 3, 15: 160, 16: 0, 21: 180 };
  const r = readingFromRegisters(regs);
  assert.equal(r.statusKey, 'work');
  assert.equal(r.on, true);
  assert.equal(r.flame, true);
  assert.equal(r.chronoActive, true);
  assert.equal(r.pelletLow, false);
});

test('alarme 32 bits -> bits actifs et message', () => {
  const regs = { 6: 8, 7: 0, 8: 1, 9: 0, 10: 1, 12: 0, 13: 1, 15: 160, 16: 0, 21: 0 };
  const r = readingFromRegisters(regs);
  assert.equal(computeAlarmCode(regs), 1);
  assert.deepEqual(activeAlarmBits(3), [0, 1]);
  assert.equal(r.alarm, true);
  assert.equal(r.inError, true);
  assert.equal(r.pelletLow, true);
  const states = buildStatesFrom(ids, r, 'fr');
  const text = (k) => states.find((s) => s.device_feature_external_id === ids.feature(k))?.text;
  assert.equal(text(FEATURES.ALARM_MSG), 'Trémie à granulés vide');
  assert.equal(text(FEATURES.STATUS), 'STOP (erreur)');
});

test('repli cloud: GetStatus pauvre -> même forme', () => {
  const r = readingFromCloudStatus(
    { Status: 4, AirTemperature: 20, SetAirTemperature: 23, SetPower: 2 },
    CLOUD_STATUS,
  );
  assert.equal(r.statusKey, 'work');
  assert.equal(r.room, 20);
  assert.equal(r.setpoint, 23);
  assert.equal(r.fireLevel, 2);
  assert.equal(r.fanSpeed, null);
});

test("buildStates: jamais d'eau (poêle non hydro), tout le reste présent", () => {
  const regs = { 6: 3, 7: 0, 8: 0, 9: 0, 10: 0, 12: 2, 13: 3, 15: 160, 16: 224, 21: 180 };
  const states = buildStatesFrom(ids, readingFromRegisters(regs), 'fr');
  const keys = new Set(states.map((s) => s.device_feature_external_id.split(':').pop()));
  for (const k of Object.values(FEATURES)) assert.ok(keys.has(k), `feature ${k} manquante`);
  assert.ok(![...keys].some((k) => k.startsWith('water')));
  const state = (k) => states.find((s) => s.device_feature_external_id === ids.feature(k))?.state;
  assert.equal(state(FEATURES.FLUE), 180);
  assert.equal(state(FEATURES.FAN), 3);
  assert.equal(state(FEATURES.ROOM), 38);
});
