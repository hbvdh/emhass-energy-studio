# Changelog

## 0.2.3 - Mobile layout and separate day costs
- Mobile introductietekst verkleind.
- Kostenprognose opgesplitst in vandaag (resterend) en morgen (kalenderdag).
- Rekening gehouden met DST; gedeeltelijke voorspellingen krijgen een label.
- Dagprognoses zijn onafhankelijk van de grafiekhorizon.

## 0.2.2 - Home Assistant Ingress path hotfix
- Meervoudige openingsslashes in Ingress-requests (`//`) worden veilig genormaliseerd; hierdoor crasht de webserver niet meer met `ERR_INVALID_URL`.
- Regressietest voor homepage, stylesheets en API via deze URL-vorm toegevoegd.

## 0.2.1 - GitHub repository release
- Repository-installatie via Home Assistant App Store ondersteund.
- Documentatie en onderhoudstest toegevoegd.
- Bestaande read-only grafieken en Ingress-beveiliging blijven ongewijzigd.

## 0.2.0
- HAOS-app met Ingress, read-only API proxy, 48-uursgrafieken, filterbare kwartierentabel en CSV-export.
