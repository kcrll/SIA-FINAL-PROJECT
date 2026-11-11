# Ani

A rice farm tracker: plots, tasks, calendar, supplies, harvests and finances, with a separate admin portal.
PHP 8 + MySQL on the back end, plain HTML/CSS/JS on the front end (no build step, no CDN).

## Run it (XAMPP)

1. Copy this folder into `htdocs` (for example `htdocs/ani`).
2. Start **Apache** and **MySQL**.
3. In phpMyAdmin, open the **Import** tab (no database selected) and import `aniyatrack.sql`.
4. Open `http://localhost/ani/`.

Importing is safe on an existing database: it upgrades the old schema in place (see "Upgrading").

| Account | Username | Password |
|---|---|---|
| Administrator | `admin` | `admin123` |
| Farmer | `farmer1` | `admin123` |

Change these passwords after the first login (Admin portal, Users, key icon).

## Configuration

Defaults are `localhost`, database `aniyatrack`, user `root`, empty password.
To change them, copy `config.local.example.php` to `config.local.php` and edit it. That file is git-ignored and blocked by `.htaccess`.

The "Ask Ani" chat answers from your data out of the box. For AI answers, set `ANTHROPIC_API_KEY` in `config.local.php`.

## Structure

```
assets/css/app.css      design system (tokens, shell, shared components)
assets/js/core.js       API helper, session, dates, icons, modals, forms
assets/js/shell.js      sidebar, mobile drawer, logout
assets/js/plot-view.js  plot cards and plot details (Dashboard, Plots, Admin)
Auth/ Dashboard/ Plots/ Tasks/ Calendar/ Inventory/ Finance/ Chat/ Admin/
                        one folder per feature: page + script + PHP endpoints
config.php              session, database, JSON helpers, access rules
aniyatrack.sql          schema, upgrade steps, starter accounts
```

Access rules live in `config.php`: farmers only ever see their own rows, admins see everything.

## Upgrading from the previous version

Importing the new `aniyatrack.sql` will:

- drop `users.email` and `users.status` (accounts no longer have an email, and admins no longer activate/deactivate users, so everyone who exists can log in),
- drop `plots.crop_type` and `plantings.crop_name` (Ani only tracks rice),
- turn the old `Occupied` plot status into `Planted`.

The old `seeds` table is no longer used (seeds live in Inventory). It is left in place; a commented `DROP TABLE` at the end of the SQL file removes it once you are sure.
The tasks table is still called `watering_tasks` so existing data keeps working.
