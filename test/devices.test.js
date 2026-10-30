import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeConfig } from '../src/config.js';
import { readingFromStatus, buildStates, stoveId } from '../src/devices.js';

const gladys = {
  externalIds: (type, platformId) => ({
    device: `ext:sel:${type}:${platformId}`,
    feature: (key) => `ext:sel:${type}:${platformId}:${key}`,
  }),
};

test('normalizeConfig exige email + mot de passe', () => {
  const c = normalizeConfig({});
  assert.deepEqual(c.missing, ['email', 'password']);
  assert.equal(c.refreshInterval, 120);
});

test('normalizeConfig borne l’intervalle', () => {
  const c = normalizeConfig({ email: 'a@b.c', password: 'x', refresh_interval: 5 });
  assert.deepEqual(c.missing, []);
  assert.equal(c.refreshInterval, 60);
});

test('lecture GetStatus : les 0 du cloud à l’arrêt ne sont pas des T°', () => {
  const r = readingFromStatus({ Status: 0, AirTemperature: 0, SetAirTemperature: 0, SetPower: 0 });
  assert.equal(r.on, false);
  assert.equal(r.room, null);
  assert.equal(r.setpoint, null);
  assert.equal(r.power, null);
});

test('lecture GetStatus en chauffe', () => {
  const r = readingFromStatus({ Status: 4, AirTemperature: 21.5, SetAirTemperature: 23, SetPower: 2 });
  assert.equal(r.on, true);
  assert.equal(r.heating, true);
  assert.equal(r.room, 21.5);
  assert.equal(r.setpoint, 23);
  const states = buildStates(gladys, 'K-E-Y', r, 'fr');
  const byId = Object.fromEntries(states.map((s) => [s.device_feature_external_id.split(':').pop(), s.state ?? s.text]));
  assert.equal(byId.mode, 1);
  assert.equal(byId.operating, 1);
  assert.equal(byId.room, 21.5);
  assert.equal(byId.status, 'En chauffe');
});

test('poêle hydro : température + consigne eau relayées', () => {
  const r = readingFromStatus({ Status: 4, AirTemperature: 21.5, SetAirTemperature: 23, SetPower: 2, WaterTemperature: 52, SetWaterTemperature: 60 });
  assert.equal(r.water, 52);
  assert.equal(r.waterSetpoint, 60);
  assert.equal(r.flame, true);
  const states = buildStates(gladys, 'K-E-Y', r, 'fr');
  const byId = Object.fromEntries(states.map((s) => [s.device_feature_external_id.split(':').pop(), s.state ?? s.text]));
  assert.equal(byId.water, 52);
  assert.equal(byId.water_setpoint, 60);
  assert.equal(byId.flame, 1);
});

test('alarme : binaire + statut FR', () => {
  const r = readingFromStatus({ Status: 8 });
  assert.equal(r.alarm, true);
  assert.equal(r.on, true);
});

test('stoveId est stable et minuscule', () => {
  assert.equal(stoveId('559AA8cf-1234-5678-9abc-def012345678'), '559aa8cf-1234-5678-9abc-def012345678');
});
