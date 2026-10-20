# EMHASS Energy Studio

[**Nederlands**](README.nl.md) | **English**

A modern, **read-only** dashboard for your existing EMHASS Home Assistant app, available through Home Assistant Ingress.

- Interactive charts for battery power, state of charge, PV generation, consumption, grid power and dynamic electricity tariffs.
- Separate net-energy-cost forecasts for the rest of today and for tomorrow (Amsterdam local calendar days, with daylight saving time handling).
- Charts for 12, **24 (default)** or 48 hours; a linked, searchable quarter-hour data table with 28 rows per page.
- Mobile-friendly chart details, CSV export, demonstration mode and warnings about stale or unsuccessful optimizations.
- No new exposed network port, Home Assistant access token, or modification of your EMHASS optimizer.
- Requires the running EMHASS add-on endpoints `/api/v1/plan` and `/api/v1/last-run` (tested with mocked EMHASS 0.18.6 data).

## Install on Home Assistant OS

1. Open **Settings → Apps → App Store → ⋮ → Repositories** (menu names may vary by HA version).
2. Add `https://github.com/hbvdh/emhass-energy-studio`.
3. Install **EMHASS Energy Studio** from the App Store.
4. Find the **full add-on ID** for your existing EMHASS installation, for example `5b918bf2_emhass`, under its app info page or via `ha addons list`.
5. Under **Energy Studio → Configuration**, enter the full ID in `emhass_slug`. Optionally choose `language` (`auto`, `en`, `nl`). Save and restart the app.
6. Open the Energy Studio interface in the HA sidebar.

Example configuration:

```yaml
emhass_slug: 5b918bf2_emhass
language: auto
```

The ID above is an **example**; use your own full EMHASS add-on ID. The apps communicate internally on port 5000. No port forwarding or public exposure is required.

## Language options

| Setting | Behaviour |
| --- | --- |
| `auto` (default) | Uses the Home Assistant account language if exposed to the Ingress page; otherwise the browser language. Other languages fall back to English. |
| `en` | Forces English for **all users** of this Energy Studio installation. |
| `nl` | Forces Dutch for **all users** of this Energy Studio installation. |

There is **no language switch in the dashboard**. In `auto`, different users/devices can use different languages. A forced language is an add-on-wide setting, not a per-user preference. Save and restart after changing it.

## Updating and troubleshooting

Refresh the App Store and update Energy Studio there. Your existing EMHASS settings remain unchanged.

- **No live data**: verify `emhass_slug` and ensure EMHASS is running and accessible within the add-on network.
- **Only demo data**: switch to Live in the interface, or configure `emhass_slug`.
- **Stale plan**: the last successful plan remains visible with a warning if a later optimization failed.
- **Auto language did not follow HA**: browser security can prevent reading the parent Home Assistant frame. Use `language: en`/`nl` for deterministic behaviour.

See [detailed technical documentation](emhass_energy_studio/DOCS.md) and the [changelog](emhass_energy_studio/CHANGELOG.md).

## Development

```sh
cd emhass_energy_studio
npm test
```

The server uses Node.js without third-party runtime packages. This is experimental, unofficial community software, not endorsed by EMHASS or Home Assistant. License: [MIT](LICENSE).
### Actual energy readings (v0.3.2)
Enable `homeassistant_api: true` and configure the eight energy entity IDs as needed. The add-on reads them using the internal Supervisor token, not a personal token, and exposes only the calculated measurements. PV and grid import show actual energy since midnight, remaining EMHASS forecast and expected total. Current battery/grid power refreshes every minute. **Actual net costs remain unavailable** until time-matched export compensation can be verified; the cost amount shown is the remaining EMHASS forecast.
