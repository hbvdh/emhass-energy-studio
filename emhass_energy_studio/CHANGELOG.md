# Changelog

## 0.3.5 - Fix add-on startup after HA cost statistics update
- Include ha_stats.mjs in the Docker image; fixes ERR_MODULE_NOT_FOUND and restart loop in v0.3.4.
- Add packaging regression test that stages the Dockerfile COPY instructions and loads the actual modules.
- No changes to EMHASS optimization, entities or cost calculation.

## 0.3.4 - Match Home Assistant Energy statistics for actual costs
- Actual net energy cost now sums the same hourly Recorder statistic changes as the Home Assistant Energy totals table.
- Uses Home Assistant's internal Supervisor WebSocket API, read-only, no additional token or port.
- Missing statistics return unavailable rather than an inaccurate raw counter delta.
- PV production and grid import actuals are unchanged.

## 0.3.3 - Home Assistant Energy dashboard actual net costs
- Cost sensors from the Home Assistant Energy dashboard (T1/T2 import cost and export compensation) are now used for actual net cost since local midnight.
- Negative cost and compensation deltas are supported; unknown/missing states or incorrect monetary units display as unavailable instead of zero.
- Today's main cost KPI uses actual-to-date plus remaining EMHASS forecast when both are available.
- Optional cost entity IDs can be configured independently in the add-on options; default IDs match the original test installation.
- No historical price re-calculation, tokens, new ports or write access required.


## 0.3.2 - Live energy readings
- Read-only Home Assistant Core API access with internal Supervisor token; no port forwarding or stored user tokens.
- Actual PV and grid import so far today, remaining EMHASS forecast, projected total.
- Live battery/grid status cards with 60s refresh and timestamp.
- Hide Demo when live works; retain fallback on error.
- Import price entity is collected but historical net costs remain unavailable until time-matched historical import/export rates can be verified.
- Limited midnight meter baseline query; missing/reset data reported as unavailable rather than incorrect zero.


## 0.3.1 - Language configuration and bilingual docs
- Add-on Configuration now offers language: auto, en or nl (default: auto).
- Forced language applies to the entire installation; auto detects HA account locale where accessible, then browser locale.
- Read-only /api/settings sends only the validated language preference to the frontend.
- English README and documentation with Dutch versions.
- Regression tests for configuration precedence, HTTP endpoint and manifest.

## 0.3.0 - English / Dutch user language
- Two complete UI translations: English and Dutch (charts, labels, tooltips, statuses, warnings, CSV, times, currency).
- Automatic per-user language detection: Home Assistant iframe parent language first when accessible, browser language otherwise.
- Unsupported languages fall back to English; no language toggle or global add-on setting.
- Only localization changed; optimization and add-on API remain read-only.


## 0.2.5 - Dashboard preferences
- Standaard horizon bij openen gewijzigd naar 24 uur; 12 en 48 uur blijven selecteerbaar.
- Aantal zichtbare kwartierregels per tabelpagina verdubbeld van 14 naar 28 (ook mobiel).
- Tekst voor demobrondata verduidelijkt en regressietest toegevoegd.

## 0.2.4 - Mobile chart tooltip
- Mobiele tooltip blijft na een tik zichtbaar, met sluitknop en tik-buiten-om-te-sluiten.
- Muis-hover op desktop blijft werken; touch-scroll opent geen vluchtige tooltip.
- Tooltip blijft binnen het mobiele scherm en is geschikt voor Home Assistant Ingress.

## 0.2.3 - Mobile layout and separate day costs
- Compacte koptekst en introductie op telefoons.
- Afzonderlijke netto kostenprognose voor het resterende deel van vandaag en voor morgen (kalenderdag Europe/Amsterdam).
- Kalenderdagberekening volgt zomertijd/wintertijd; onvolledige planning is als gedeeltelijk gemarkeerd.
- Kostenkaarten veranderen niet mee met de 12/24/48-uursfilter voor grafieken.

## 0.2.2 - Home Assistant Ingress path hotfix
- Meervoudige openingsslashes in Ingress-requests (`//`) worden veilig genormaliseerd; hierdoor crasht de webserver niet meer met `ERR_INVALID_URL`.
- Regressietest voor homepage, stylesheets en API via deze URL-vorm toegevoegd.

## 0.2.1 - GitHub repository release
- Repository-installatie via Home Assistant App Store ondersteund.
- Documentatie en onderhoudstest toegevoegd.
- Bestaande read-only grafieken en Ingress-beveiliging blijven ongewijzigd.

## 0.2.0
- HAOS-app met Ingress, read-only API proxy, 48-uursgrafieken, filterbare kwartierentabel en CSV-export.
