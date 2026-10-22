# Changelog

## 0.1.4 — Match Predbat's visible, merged plan states

- Honor `skip_state_cell` when Predbat merges multiple slots using `rowspan_state`.
- Keep the visible Predbat status through hidden rows, avoiding false Holding Charging breaks inside a continuous charge window.
- Add tests for the reported 11:30–14:30 scenario and genuinely distinct state changes.
- No changes to Predbat controls or EMHASS Energy Studio.


## 0.1.3 — Plan states from Predbat itself

- Read the raw `state` values in `predbat.plan_html` to match Predbat's official plan table.
- Group consecutive HoldChrg, Chrg, Demand, freeze, and export states by their original plan times.
- Correct first active slot alignment; do not confuse forecasts from battery power with control states.
- Return compact validated plan rows only, without forwarding HTML or the full raw data.
- Keep the frontend read-only; no changes to Predbat control or EMHASS Energy Studio.


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
