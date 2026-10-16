# EMHASS Energy Studio

Moderne, **alleen-lezen** weergave van de EMHASS-optimalisatie: interactieve grafieken, 12/24/48 uur, status, kwartierentabel en CSV-export.

De originele EMHASS-add-on blijft ongewijzigd. De interface werkt via Home Assistant Ingress zonder extra externe poort.

Na installatie: vul de **volledige add-on-ID** van je EMHASS-installatie in bij `emhass_slug`. Meer informatie staat in `DOCS.md`.

**Experimentele community-software. Niet officieel verbonden aan EMHASS of Home Assistant.**

## Netto kostenprognoses per dag (v0.2.3)
Vandaag omvat uitsluitend de resterende geplande uren tot middernacht, niet de reeds gerealiseerde kosten. Morgen omvat de volgende volledige Nederlandse kalenderdag, met correctie voor zomertijd/wintertijd. De berekening gebruikt de import- en exportvermogens en hun tarieven uit het EMHASS-plan. Onvolledige dagen zijn gemarkeerd als gedeeltelijk; bij ontbrekende bronwaarden wordt een streepje getoond. De 12/24/48-uursselectie beïnvloedt de dagprognoses niet.
