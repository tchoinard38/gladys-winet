# Thermorossi WiNET — Gladys Assistant integration (unofficial)

This integration brings WiNET Wi-Fi pellet stoves (Thermorossi, and other
brands on the thermorossi.cloudwinet.it / cloudwinet.it portal) into Gladys
Assistant.

## What it does

One device per stove, with the features the stove has: on/off (thermostat
mode), air setpoint (5 to 40 °C), heating state, room temperature sensor,
state in words (standby, ignition, working, cleaning, alarm…), an alarm
binary sensor and the power level select (1 to 5). Scenes can also trigger on
the `stove_alarm` event, once per alarm.

## Prerequisites

- A WiNET stove that works in the Thermorossi Connector app (portal
  https://thermorossi.cloudwinet.it).
- Gladys Assistant 5.1 or later.

## Setup

1. Install the integration from **Integrations** in Gladys.
2. In the **Configuration** tab, enter the WiNET portal e-mail and password,
   then click **Test the connection**: the stove state is shown.
3. Open the **Discovery** tab and create the stove.

The integration talks to the WiNET cloud over the Internet, never to the
stove directly: the stove must be online in the app. Credentials stay in the
Gladys configuration (secret field); the device API key, scraped from the
portal like the app does, is kept in the integration data volume and
re-scraped automatically when the cloud refuses it.

## Troubleshooting

- “WiNET portal login failed”: check the credentials; a new attempt is
  retried automatically every 15 minutes.
- The cloud returns 0 °C temperatures while the stove is off: the integration
  then publishes the mode and state only, never a fake temperature.
- The WiNET module keeps a single active session: if the official app is
  open at the same time, command conflicts are possible.

Unofficial community integration, not affiliated with Thermorossi or
NetSoftware.
