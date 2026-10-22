# Changelog

## 0.1.2 — Upcoming Predbat battery windows

- Read the full date from Predbat `attributes.timestamp` instead of interpreting time-only start/end states as dates.
- Show upcoming forced charging/export windows, and Best-plan predicted charge/discharge periods where no forced windows are published.
- Clearly distinguish predictions from control commands; ignore brief power fluctuations and avoid duplicate windows.
- Add time-window, parsing and packaging regression checks.


## 0.1.1 — Euro prices and compact header

- Convert Predbat cent metrics into EUR with two decimal places (`448.2 c` → `€ 4,48`).
- Apply the same formatting to Best, Base, Predbat cost today, and predicted benefit, including signed values.
- Remove the large introduction headline and description; keep the edition label and action buttons.
- Add regression tests for money units and compact layout.

## 0.1.0 — Initial standalone dashboard

- Separate Home Assistant Ingress app installed alongside EMHASS Energy Studio.
- Responsive dark interface with English / Dutch translation.
- Predbat status and run_state, battery SOC and current battery, grid, PV and load power.
- Best vs Base metrics and indicative forecast benefit.
- Interactive 12/24/48-hour SOC and power graphs based on Predbat 5-minute `results` attributes.
- Paginated five-minute forecast table and CSV export.
- Next planned charging and export windows, entity availability diagnostics.
- Read-only HA Core API access, fixed allowlisted entities, zero external dependencies.
- Demo mode visibly isolated from live readings.
