# DPIIC Mineral Intelligence Platform — Backend

REST API + SQLite database backing the DPIIC Mineral Intelligence Platform,
with a drop-in JS layer that hydrates the static HTML prototype with live data.

## Stack

- Python 3.14, FastAPI, SQLAlchemy 2, Pydantic v2, passlib/bcrypt, PyJWT
- SQLite (single-file, zero-config)

## Quick start

The interpreter used for this project is not on `PATH`; reference it directly:

```powershell
& "C:\Users\Ats\AppData\Local\Python\bin\python.exe" -m pip install -r requirements.txt
& "C:\Users\Ats\AppData\Local\Python\bin\python.exe" run.py
```

- API + interactive docs: http://127.0.0.1:8000/docs
- Health check: http://127.0.0.1:8000/health
- Demo portal: http://127.0.0.1:8000/ (served from `static/index.html`,
  auto-hydrated by `static/dpiic-integration.js`)

`run_server.cmd` wraps the same commands for double-click use.

## Demo credentials

Password for every seeded user: `Dpiic@2026` (format `demo.<suffix>@dpiic.gov.in`)

| Role | User ID |
| --- | --- |
| Administrator | `demo.admin@dpiic.gov.in` |
| GSI Scientist | `demo.scientist@dpiic.gov.in` |
| Government Department | `demo.govt@dpiic.gov.in` |
| PSU | `demo.psu@dpiic.gov.in` |
| Research Institute | `demo.research@dpiic.gov.in` |
| Exploration Agency | `demo.agency@dpiic.gov.in` |
| Private Stakeholder | `demo.stakeholder@dpiic.gov.in` |

## Project layout

```
dpiic-backend/
  app/
    main.py            FastAPI app; mounts routers under /api and static/
    config.py          settings (database URL, CORS, JWT expiry)
    database.py        engine, session, init_db
    security.py        bcrypt hashing, JWT, get_current_user, require_roles/tier
    models.py          SQLAlchemy models
    schemas.py         Pydantic request/response schemas
    seed.py            demo seed data (users, datasets, workflow, MPA, ...)
    gis_data.py        static GIS layer catalogue + GeoJSON overlays
    api/
      auth.py          login / me / roles
      dashboard.py     summary, programme coverage, activity
      catalogue.py     datasets, programmes, access requests
      workflow.py      stages, subtasks, alerts, simulate
      ai.py            model executions, outputs, MPA catalog, run
      work.py          projects, knowledge, reports
      admin.py         access-request review (RBAC Administrator)
      gis.py           basemaps, layers, layer GeoJSON
      boreholes.py     borehole catalog
  static/
    dpiic-integration.js   drop-in hydration layer for the HTML prototype
    index.html             copy of the prototype wired to the API (auto-login demo)
  tests/               pytest suite (~51 tests)
  run.py               dev server entrypoint
  run_server.cmd       Windows launcher
```

## Frontend integration

The prototype is a static single-file HTML. `static/dpiic-integration.js` is a
drop-in script that, when loaded on the page, detects the API and hydrates the
dashboard, workflow, catalogue, AI/MPA, workspace, knowledge, reports and admin
views with live data. If the API is unreachable it stays silent and the static
data remains (graceful fallback).

To wire any copy of the prototype HTML to the backend:

```html
<script>
  window.DPIIC_CONFIG = {
    apiBase: '',                                        // optional; default same-origin
    autoLogin: { user: 'demo.admin@dpiic.gov.in', password: 'Dpiic@2026' } // optional
  };
</script>
<script src="/static/dpiic-integration.js"></script>
```

Notes:

- Without `autoLogin`, the portal signs in through the login modal and the
  entered credentials are validated against the API.
- GIS map viewer and 3D subsurface viewer remain illustrative (static consts),
  per the prototype's own disclaimers.
- A seeded SQLite DB is created automatically on first start. Delete `dpiic.db`
  and restart to re-seed.

## Running tests

```powershell
& "C:\Users\Ats\AppData\Local\Python\bin\python.exe" -m pytest tests -q
```

Tests use `tests/conftest.py`, which points `DATABASE_URL` at a throwaway
`test_dpiic.db` that is reset at the start of each session.
