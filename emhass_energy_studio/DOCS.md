# EMHASS Energy Studio (Home Assistant Ingress)

**English** | [Nederlands](DOCS.nl.md)

Energy Studio is a separate, read-only web frontend. It never changes your existing EMHASS optimization settings.

## Configuration

Open the original EMHASS add-on info page in HA. The URL contains `/hassio/addon/<id>/info`. Copy the full add-on ID (for example `abc12345_emhass`) into Energy Studio's configuration:

```yaml
emhass_slug: abc12345_emhass
language: auto
```

The ID is an example. Save and restart Energy Studio. The app reads the EMHASS API on internal port 5000 through Home Assistant add-on DNS.
Only `GET /api/v1/plan` and `GET /api/v1/last-run` are proxied. If `emhass_slug` is empty, demo mode remains available.

## Language

- `auto` (default): HA user language if the parent HA frame is accessible; otherwise browser language; other languages fall back to English.
- `en`: English for every user of this Energy Studio installation.
- `nl`: Dutch for every user of this Energy Studio installation.

An add-on-wide forced preference cannot provide different languages for different users. Set `auto` to allow per-user language detection. The frontend fetches only the language choice from the read-only `GET /api/settings` endpoint; the complete add-on options and credentials are never exposed.

## Security

- Home Assistant Ingress authenticates the viewer.
- The server accepts connections only from the Home Assistant Supervisor's Ingress peer IP (`172.30.32.2`).
- No externally exposed port, HA API token or volume mounts are added.
- The dashboard cannot run optimization or write configuration.

## Troubleshooting

- No connection: check the complete `emhass_slug`, original add-on status, and if EMHASS binds to `server_ip: 0.0.0.0`.
- Empty plan: run EMHASS optimization first; Energy Studio never starts one.
- Stale plan: a warning is displayed when a later optimization fails or the data is old.
- Automatic language detection: browser iframe protections may block access to the parent page. Force `en` or `nl` in add-on settings if required.

This is unofficial, experimental community software.
