# EMHASS Energy Studio

**Nederlands** | [English](README.md)

Een modern, **alleen-lezen** dashboard voor de bestaande EMHASS Home Assistant-app, bereikbaar via Home Assistant Ingress.

- Interactieve grafieken voor batterijvermogen, SOC, PV, verbruik, netvermogen en dynamische stroomprijzen.
- Afzonderlijke netto-energiekostenprognoses voor de rest van vandaag en morgen, volgens de Nederlandse kalenderdag, inclusief zomer-/wintertijd.
- Grafieken voor 12, **24 (standaard)** of 48 uur; gekoppelde doorzoekbare kwartierentabel met 28 regels per pagina.
- Mobiele grafiekdetails, CSV-export, demomodus en waarschuwingen bij verouderde of mislukte optimalisaties.
- Geen extra netwerkpoorten, Home Assistant-tokens of wijzigingen aan de bestaande EMHASS-optimalisatie.
- Gebruikt `/api/v1/plan` en `/api/v1/last-run` van de bestaande EMHASS-app (getest met gesimuleerde EMHASS 0.18.6-data).

## Installeren in Home Assistant OS

1. Open **Instellingen → Apps → Appwinkel → ⋮ → Repositories** (menu kan per versie verschillen).
2. Voeg toe: `https://github.com/hbvdh/emhass-energy-studio`.
3. Installeer **EMHASS Energy Studio** via de appwinkel.
4. Zoek de **volledige add-on-ID** van de bestaande EMHASS, bijvoorbeeld `5b918bf2_emhass`, op de informatiepagina of via `ha addons list`.
5. Vul onder **Energy Studio → Configuratie** die ID in bij `emhass_slug`. Kies eventueel `language` (`auto`, `en`, `nl`). Sla op en herstart de app.
6. Open Energy Studio via de Home Assistant-zijbalk.

Voorbeeldconfiguratie:

```yaml
emhass_slug: 5b918bf2_emhass
language: auto
```

De ID hierboven is **slechts een voorbeeld**. Vul jouw eigen volledige add-on-ID in. De interne verbinding gebruikt poort 5000, zonder publieke netwerkpoort of portforwarding.

## Taalinstellingen

| Instelling | Gedrag |
| --- | --- |
| `auto` (standaard) | Gebruikt de taal van Home Assistant als deze leesbaar is vanuit Ingress, anders de browsertaal. Andere talen vallen terug op Engels. |
| `en` | Dwingt Engels af voor **alle gebruikers** van deze Energy Studio-installatie. |
| `nl` | Dwingt Nederlands af voor **alle gebruikers** van deze Energy Studio-installatie. |

Er is **geen aparte taalschakelaar op het dashboard**. Bij `auto` kunnen gebruikers op dezelfde installatie verschillende talen zien. Een vaste taal geldt voor iedereen op de installatie. Sla de gewijzigde instelling op en herstart de app.

## Bijwerken en storingen

Controleer in de appwinkel op updates en werk daar Energy Studio bij. Je bestaande EMHASS-configuratie verandert niet.

- **Geen live gegevens**: controleer `emhass_slug` en of EMHASS intern bereikbaar is.
- **Alleen demo**: schakel naar Live en controleer `emhass_slug`.
- **Verouderd plan**: een ouder geslaagd plan kan zichtbaar blijven, met waarschuwing.
- **Taal bij `auto` niet zoals verwacht**: browserbeveiliging kan het lezen van de bovenliggende Home Assistant-pagina blokkeren. Met `language: en` of `nl` kun je de taal vastzetten.

Zie [technische documentatie](emhass_energy_studio/DOCS.nl.md) en de [changelog](emhass_energy_studio/CHANGELOG.md).

## Ontwikkeling

```sh
cd emhass_energy_studio
npm test
```

De Node.js-server heeft geen externe runtime-pakketten nodig. Dit is experimentele, onofficiële community-software, niet officieel verbonden aan EMHASS of Home Assistant. Licentie: [MIT](LICENSE).

### Actuele energiemetingen (v0.3.2)
Met `homeassistant_api: true` leest de add-on uitsluitend de ingestelde energiesensoren via Home Assistant en een interne Supervisor-token. De token wordt niet naar de browser gestuurd. Pas voor andere installaties de sensor-ID's in de add-onconfiguratie aan.
- **PV / netimport:** gemeten energie sinds 00:00, resterende EMHASS-prognose tot middernacht en totaalverwachting vandaag.
- **Batterij / net:** actuele vermogens; automatische vernieuwing elke minuut.
- **Netto kosten vandaag:** echte afnamekosten (T1 + T2) minus terugleververgoeding (T1 + T2), afkomstig van de geldsensoren van het HA Energiedashboard vanaf middernacht. De resterende EMHASS-prognose wordt toegevoegd voor het verwachte dagtotaal. Ontbrekende sensoren of historie leveren een streepje op.
- Bij ontbrekende middernachthistorie of een reset van de meter verschijnen streepjes, geen verzonnen cijfers.

Standaard prijssensor: `sensor.actuele_stroomprijs_all_in_2`. De huidige prijs is niet voldoende om historische kosten te berekenen.

### Werkelijke netto kosten via Home Assistant (v0.3.3)

De kaart voor vandaag gebruikt nu de cumulatieve kostensensoren van het Home Assistant Energiedashboard: afnamekosten T1/T2 en terugleververgoedingen T1/T2. Van iedere sensor wordt de stand rond lokale middernacht afgetrokken. Netto kosten zijn vervolgens **afnamekosten T1 + T2 minus terugleververgoeding T1 + T2**. Ook negatieve kosten/vergoedingen blijven behouden. Vaste kosten zitten er alleen in wanneer Home Assistant ze zelf al in die sensoren verwerkt.

De vier entity-ID's zijn afzonderlijk instelbaar; standaard gebruiken we de bevestigde Energiedashboard-sensoren (`..._cost` en `..._compensation`). Ontbreekt een sensor, de euro-eenheid of de stand bij middernacht, dan verschijnt een streepje en geen onjuist bedrag.

