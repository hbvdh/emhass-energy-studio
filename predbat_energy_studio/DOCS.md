# Predbat Energy Studio — v0.1.0

Read-only dashboard for Predbat, available as a separate Home Assistant app/add-on.

## Installation

1. The repository `https://github.com/hbvdh/emhass-energy-studio` should already be connected as a custom Home Assistant App Store repository. If not, add it in App Store → ⋮ → Repositories.
2. Refresh the App Store, choose **Predbat Energy Studio** (not **EMHASS Energy Studio**) and install.
3. Start it, enable the sidebar entry and open **Predbat Studio**.
4. By default, reads Predbat entities in the `predbat.*` domain. All traffic is internal via Supervisor/Ingress; no external Predbat web port or API key is necessary.

### Options

- `predbat_prefix`: default `predbat`. Match the `prefix:` in Predbat `apps.yaml` if different.
- `battery_soc_entity`: optional Home Assistant entity ID that reports percent SOC. If empty, the dashboard calculates a percentage from `predbat.soc_kw_h0` and `sensor.predbat_inverter_config` attribute `soc_max`, where available.
- `language`: `auto`, `nl`, `en`; auto detects the web-browser language.

This app never invokes Home Assistant services or changes Predbat settings. It only reads a fixed, validated set of state entities and caches the result for one minute.

## Data behavior

Predbat's `*.results` attributes are 5-minute time series. The state of `predbat.soc_kw_best` is an **end-of-plan kWh** value, not present SOC. The dashboard uses `predbat.soc_kw_h0` for current battery energy and its actual `results` attributes for forecast charts.

Current power sensors use W; predicted power `results` use kW. Positive battery power means **discharging**, negative means **charging**. The plotted direction is a power-flow interpretation, **not** a command; the current action uses `predbat.status` attribute `run_state`.

Best/Base costs and savings use Predbat's own metric and unit, not Home Assistant Energy dashboard costs. The savings metric is a forecast difference over the same Predbat horizon, not realized money. Missing series show a missing-data message, never fabricated estimates. The Demo button is clearly labeled and cannot send writes.

Predbat output entities may be absent depending on configuration, version, or initialization. The initial version does not rely on the Predbat `plan_html` attribute or scrape its HTML.

## Known limitations

- No direct Predbat web interface integration or writes.
- The time-axis of zone-less Predbat result keys is interpreted in the browser's local timezone. Set client and Predbat timezone consistently.
- Some versions or configurations publish fewer results; missing datasets will not show a curve.
- The HA supervisor token never leaves the server.

Predbat documentation: https://springfall2008.github.io/batpred/output-data/
