// Client de l'API HTTP locale du module WiNET (Micronova) — la source riche
// (registres), la même que lit l'intégration Home Assistant « thermorossi ».
// Note : le module WiNET (W5500) rejette les requêtes d'undici/fetch
// ({"result":false} ; le http module historique de Node passe, vérifié sur
// le matériel). Ne PAS remplacer fetch() par fetch() ici.
import http from 'node:http';
import { LOCAL_API, REG, TEMP, LOCAL_STATUS, LOCAL_ERROR, LOCAL_ACTIVE } from './constants.js';

export class LocalStoveApi {
  constructor(ip) {
    this.ip = ip;
  }

  _post(path, payload = '') {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          host: this.ip,
          port: 80,
          path,
          method: 'POST',
          timeout: LOCAL_API.requestTimeoutMs,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(payload),
            'X-Requested-With': 'XMLHttpRequest',
            Connection: 'close',
          },
        },
        (res) => {
          let text = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => (text += chunk));
          res.on('end', () => {
            if (res.statusCode !== 200) return reject(new Error(`WiNET local HTTP ${res.statusCode}`));
            let body;
            try {
              body = JSON.parse(text);
            } catch {
              return reject(new Error('réponse WiNET non JSON'));
            }
            if (body && body.result === false && !Array.isArray(body.registers)) {
              return reject(new Error('module WiNET a refusé la requête'));
            }
            resolve(body);
          });
        },
      );
      req.on('timeout', () => req.destroy(new Error('délai WiNET local dépassé')));
      req.on('error', reject);
      req.end(payload);
    });
  }

  /** { [regId]: valeur } pour une catégorie de registres. */
  async registers(category = 1) {
    const body = await this._post(
      LOCAL_API.getRegistersPath,
      `key=${LOCAL_API.readKey}&category=${category}`,
    );
    if (!body || !Array.isArray(body.registers)) {
      throw new Error('réponse get-registers inattendue');
    }
    const regs = {};
    for (const [id, value] of body.registers) regs[id] = value;
    for (const need of [REG.STATUS, REG.SET_TEMP]) {
      if (!(need in regs)) throw new Error(`registres WiNET inattendus (manque reg ${need})`);
    }
    return regs;
  }

  async setRegister(regId, value) {
    const res = await this._post(
      LOCAL_API.setRegisterPath,
      `key=${LOCAL_API.setKey}&regId=${regId}&value=${value}&result=false`,
    );
    if (!res || res.result !== true) {
      throw new Error(`écriture du registre ${regId} refusée`);
    }
  }

  turnOn() { return this.setRegister(LOCAL_API.commandRegId, LOCAL_API.cmdOn); }
  turnOff() { return this.setRegister(LOCAL_API.commandRegId, LOCAL_API.cmdOff); }
  setSetpoint(celsius) {
    return this.setRegister(REG.SET_TEMP, Math.round((celsius - TEMP.offset) / TEMP.mul));
  }
  setFireLevel(level) { return this.setRegister(REG.FIRE_LEVEL, level); }
  setFanSpeed(level) { return this.setRegister(REG.FAN_SPEED, level); }

  /** Etat du module réseau (fwVer utile au diagnostic). */
  moduleStatus() { return this._post(LOCAL_API.getStatusPath, ''); }
}

export const toCelsius = (raw) => Math.round((raw * TEMP.mul + TEMP.offset) * 10) / 10;

export function computeAlarmCode(regs) {
  return ((regs[REG.ALARM_MSB] || 0) << 16) | (regs[REG.ALARM_LSB] || 0);
}

export function activeAlarmBits(code) {
  const bits = [];
  for (let bit = 0; bit < 32; bit += 1) if (code & (1 << bit)) bits.push(bit);
  return bits;
}

/** Registres runtime -> lecture normalisée (forme unique, commune au cloud). */
export function readingFromRegisters(regs) {
  const statusCode = regs[REG.STATUS] & 0xff;
  const alarmCode = computeAlarmCode(regs);
  const flags = regs[REG.FLAGS] || 0;
  return {
    source: 'local',
    statusCode,
    statusKey: LOCAL_STATUS[statusCode] || 'unknown',
    inError: statusCode === LOCAL_ERROR,
    on: LOCAL_ACTIVE.has(statusCode) || statusCode === LOCAL_ERROR,
    heating: LOCAL_ACTIVE.has(statusCode),
    flame: statusCode >= 2 && statusCode <= 5,
    alarm: alarmCode !== 0,
    alarmCode,
    alarmBits: activeAlarmBits(alarmCode),
    pelletLow: Boolean(regs[REG.PELLET]),
    chronoActive: Boolean(flags & 0x1),
    room: regs[REG.AIR_TEMP] ? toCelsius(regs[REG.AIR_TEMP]) : null,
    setpoint: toCelsius(regs[REG.SET_TEMP]),
    fireLevel: Number.isFinite(regs[REG.FIRE_LEVEL]) ? regs[REG.FIRE_LEVEL] : null,
    fanSpeed: Number.isFinite(regs[REG.FAN_SPEED]) ? regs[REG.FAN_SPEED] : null,
    flue: Number.isFinite(regs[REG.FLUE_TEMP]) && regs[REG.FLUE_TEMP] > 0
      ? regs[REG.FLUE_TEMP]
      : null,
  };
}
