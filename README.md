# EMHASS Energy Studio

Een modern, lokaal **read-only** resultaten-dashboard voor de bestaande EMHASS Home Assistant-app.

- Interactieve grafieken voor batterij, SOC, PV/verbruik en net/stroomprijzen.
- Netto kostenprognoses voor resterend vandaag en morgen volgens de Nederlandse kalenderdagen, onafhankelijk van de grafiekhorizon.
- Planning over 12, 24 of 48 uur met geselecteerd kwartier en filterbare tabel.
- CSV-export, demomodus, detectie van verouderde plannen en fouten.
- Home Assistant Ingress; geen directe webpoort, geen HA-token, geen schrijfacties.
- Vereist een draaiende EMHASS-app met `/api/v1/plan` en `/api/v1/last-run` (getest met gesimuleerde EMHASS 0.18.6 API-responses).

## Installeren in Home Assistant OS

1. Ga naar **Instellingen → Apps → App installeren → ⋮ → Repositories**.
2. Voeg toe: `https://github.com/hbvdh/emhass-energy-studio`.
3. Installeer **EMHASS Energy Studio**, start de app en zet eventueel **Toon in zijbalk** aan.
4. Zoek bij je bestaande EMHASS-app de volledige add-on-ID, bijvoorbeeld `a0d7b954_emhass`. Je kunt die vinden in de adresbalk op de app-infopagina, of via `ha addons list` in de terminal.
5. Zet in de nieuwe app onder Configuratie `emhass_slug` op die ID en start de app opnieuw.
6. Open **EMHASS Studio** via Home Assistant.

**Belangrijk:** gebruik de volledige werkelijke add-on-ID. Alleen `emhass` is onvoldoende. De nieuwe app gebruikt intern de EMHASS-service op poort 5000. Er hoeft niets vanuit je LAN of het internet naar deze service geopend te worden.

### Troubleshooting

- Zie je alleen de demo? Selecteer **Live** en controleer de `emhass_slug`.
- Geen live data? Controleer of EMHASS draait en of de API-endpoints beschikbaar zijn.
- Bij een oud plan of een mislukte laatste run blijft de laatst bekende planning zichtbaar **met waarschuwing**.
- Zie de documentatie in `emhass_energy_studio/DOCS.md`.

### Bijwerken

Verhoog de versie in `emhass_energy_studio/config.yaml` bij elke release. Na publicatie kan Home Assistant de update aanbieden via de appwinkel. Zolang er geen container-image in `config.yaml` staat, bouwt Home Assistant de app lokaal uit de aanwezige Dockerfile.

## Ontwikkelen

```bash
cd emhass_energy_studio
npm test
```

De Node.js-webserver heeft geen externe npm-afhankelijkheden. De app is op gesimuleerde API-antwoorden getest, **nog niet op een echte Home Assistant-installatie**.

Dit is onofficiële, experimentele community-software; niet onderdeel van het EMHASS-project. Licentie: MIT.
