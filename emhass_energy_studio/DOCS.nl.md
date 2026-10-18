# EMHASS Energy Studio (Home Assistant Ingress)

Deze add-on toont de EMHASS-optimalisatie in een moderne resultatenpagina, zonder instellingen of optimalisaties te wijzigen.

## Configuratie

Open de bestaande EMHASS add-on **Info** in Home Assistant. Kijk naar de adresbalk: `/hassio/addon/<id>/info`. Kopieer alleen `<id>`, bijvoorbeeld `abc12345_emhass`.

Vul bij deze add-on op **Configuratie** in:

```yaml
emhass_slug: abc12345_emhass
language: auto
```

Dat is een voorbeeld; gebruik de echte id van jouw bestaande EMHASS add-on. Start de Studio opnieuw. Open vervolgens **Open webinterface** of de zijbalk **EMHASS Studio**.

`emhass_slug` mag leeg blijven om uitsluitend de gemarkeerde demomodus te proberen. De serverproxy gebruikt intern poort 5000 van EMHASS via Home Assistant DNS, zonder poortpublicatie, en biedt alleen de twee read-only endpoints `/api/v1/plan` en `/api/v1/last-run` aan.

## Beveiliging

- Home Assistant Ingress verzorgt de authenticatie.
- Alleen verzoeken van de Supervisor-IP `172.30.32.2` worden geaccepteerd.
- Er worden geen extra hostpoorten, HA-secrets of volumes gekoppeld.
- Het dashboard kan geen optimalisaties starten of configuraties wijzigen.

## Storingen

- `EMHASS_URL ontbreekt` -> configureer `emhass_slug`.
- `Kan EMHASS niet bereiken` -> controleer de slug, of EMHASS draait en of deze `server_ip: 0.0.0.0` gebruikt. De EMHASS add-on luistert intern op poort 5000.
- Lege planning -> draai eerst EMHASS zelf; de Studio start geen optimalisatie.
- Bij een fout of oud plan wordt een waarschuwing getoond.

**Geen officiële EMHASS-add-on; los leesdashboard.**

## Taal
Kies bij de add-onconfiguratie `language: auto`, `en` of `nl`. `auto` probeert de Home Assistant-taal te lezen via Ingress en valt terug op de browsertaal. `en` en `nl` gelden voor alle gebruikers. Sla op en start de add-on opnieuw.
