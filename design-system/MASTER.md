# Confidence Booster — Master design system

Selected with `ui-ux-pro-max` `--design-system` + style/color searches (2026-09-24).

## Product
Entertainment / camera editor / phonk music. Phone-first, night use. Design serves the task (impeccable product register).

## Dials
Variance 7 · Motion 5 · Density 8

## Style
**Modern Dark (Cinema Mobile)** — indigo-black, frosted glass chrome, one pink CTA.

Auto `--design-system` color table suggested studio violet `#7C3AED` + cyan. That is the generic “editor dark” reflex. Override: **phonk pink `#EC4899`** as the only primary (entertainment/pink search + phonk vernacular). Accent stays cinema indigo `#5E6AD2`.

Do not use pure `#000` (OLED smear). Do not use Orbitron + acid-green HUD.

## Tokens
| Token | Value |
|---|---|
| `--bg-deep` | `#0a0a0f` |
| `--bg-base` | `#050506` |
| `--bg-elevated` | `#121218` |
| `--surface` | `rgba(255,255,255,0.05)` |
| `--foreground` | `#EDEDEF` |
| `--foreground-muted` | `#8A8F98` |
| `--color-primary` | `#EC4899` |
| `--color-on-primary` | `#FFFFFF` |
| `--color-accent` | `#5E6AD2` |
| `--color-border` | `rgba(255,255,255,0.08)` |
| `--color-destructive` | `#DC2626` |
| `--radius` | `16px` |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` |
| `--font-display` | Righteous (titles only) |
| `--font-body` | Poppins |

## Motion
Press scale 0.97 in 100ms (Apple / cinema). UI transitions 150–250ms. Sheets slide up, exit faster. Respect `prefers-reduced-motion` and `prefers-reduced-transparency`.

## Signature
Viewfinder L-corners on the live camera. One primary action: Drop.

## Copy
Sentence case. Name controls by what happens: Start camera, Drop, Tracks, Skip, Save clip. No cyber all-caps HUD.
