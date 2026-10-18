# Changelog

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
