# Customer Portal URLs

Base URL: `https://your-domain.com`  
Local dev: `http://localhost:5173`

---

## All Client Portal URLs

| # | Customer Name | Code | Submit Ticket URL | Login URL |
|---|--------------|------|-------------------|-----------|
| 1 | Centuri | C1373 | `/portal/centuri` | `/portal/centuri/login` |
| 2 | DriveEV | CL1COG | `/portal/driveev` | `/portal/driveev/login` |
| 3 | Fidelity Stockholm AB | C1332 | `/portal/fidelity-stockholm-ab` | `/portal/fidelity-stockholm-ab/login` |
| 4 | GiftIsai | C1397 | `/portal/giftisai` | `/portal/giftisai/login` |
| 5 | HRD - Human Resource Department | C1381 | `/portal/hrd-human-resource-department` | `/portal/hrd-human-resource-department/login` |
| 6 | Internal projects | C1074 | `/portal/internal-projects` | `/portal/internal-projects/login` |
| 7 | IVL Svenska Miljoinstitutet AB | C1386 | `/portal/ivl-svenska-miljoinstitutet-ab` | `/portal/ivl-svenska-miljoinstitutet-ab/login` |
| 8 | JohnPaul | C1398 | `/portal/johnpaul` | `/portal/johnpaul/login` |
| 9 | Karolinska Universitetssjukhuset | C1340 | `/portal/karolinska-universitetssjukhuset` | `/portal/karolinska-universitetssjukhuset/login` |
| 10 | Kattinatt AB | C1226 | `/portal/kattinatt-ab` | `/portal/kattinatt-ab/login` |
| 11 | LOTS AB | C1004 | `/portal/lots-ab` | `/portal/lots-ab/login` |
| 12 | Medical Networks Scandinavia | C1388 | `/portal/medical-networks-scandinavia` | `/portal/medical-networks-scandinavia/login` |
| 13 | Missing Connectz | C1396 | `/portal/missing-connectz` | `/portal/missing-connectz/login` |
| 14 | NandiArts | CLE6KN | `/portal/nandiarts` | `/portal/nandiarts/login` |
| 15 | Nitro Consult AB | C1379 | `/portal/nitro-consult-ab` | `/portal/nitro-consult-ab/login` |
| 16 | Obergs Museum AB | C1059 | `/portal/obergs-museum-ab` | `/portal/obergs-museum-ab/login` |
| 17 | Project Leading Activities | C1391 | `/portal/project-leading-activities` | `/portal/project-leading-activities/login` |
| 18 | PWDS | C1390 | `/portal/pwds` | `/portal/pwds/login` |
| 19 | Skanska AB | C1359 | `/portal/skanska-ab` | `/portal/skanska-ab/login` |
| 20 | Skogsindustrierna Arbio | C1345 | `/portal/skogsindustrierna-arbio` | `/portal/skogsindustrierna-arbio/login` |
| 21 | Soruban Tech | C1394 | `/portal/soruban-tech` | `/portal/soruban-tech/login` |
| 22 | TechVision Solutions | TVSOLN | `/portal/techvision-solutions` | `/portal/techvision-solutions/login` |
| 23 | TFM | C1392 | `/portal/tfm` | `/portal/tfm/login` |
| 24 | Wistara Innovations | C1400 | `/portal/wistara-innovations` | `/portal/wistara-innovations/login` |
| 25 | ZRAE Global | C1395 | `/portal/zrae-global` | `/portal/zrae-global/login` |

---

## Shared URLs (all customers)

| Purpose | URL |
|---------|-----|
| Forgot password | `/portal/forgot-password` |
| Reset password | `/portal/reset-password` |
| Dashboard (after login) | `/portal/dashboard` |
| My tickets | `/portal/tickets` |
| Ticket detail | `/portal/tickets/:id` (e.g. `TKT-0001`) |

---

## How the Slug is Derived

The slug is auto-generated from the HRMS customer name:
- Lowercased
- Spaces and special characters → `-`
- Leading/trailing dashes removed

Example: `Fidelity Stockholm AB` → `fidelity-stockholm-ab`

> The customer's **Code** (e.g. `C1332`) also resolves — the portal auto-redirects to the name-based slug URL. Always share the name-based slug URL with customers.
