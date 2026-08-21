# Film Quality and Box Office Model

The canonical implementation lives in `server/simulation/`. Preload, normal
weekly releases, and the direct release endpoint all call this model.

## Film quality

`simulateFilmQuality` first evaluates four bounded components:

- script: script assessment plus writer ability and genre fit
- direction: director ability, experience, and genre fit
- cast: average cast ability and genre fit
- craft: cinematography, post-production talent, VFX, and department support

Core quality is a weighted mean rather than a sum of independent bonuses.
Department spending uses a genre-specific diminishing-return curve:

```text
support = 100 * (1 - exp(-spend / targetSpend))
```

Genre fit and collaboration make small bounded adjustments. Complementary
script/direction and cast/craft combinations can help, but interaction points
are capped. The weakest major component can trigger a bad-film penalty. This is
intentional: an expensive production with a poor script, unsuitable director,
badly matched cast, or missing craft departments can still fail badly.

Critic and audience reception are correlated draws from the same latent
production outcome with separate taste noise. Audience fame has only a small
effect. Scores do not receive the old flat audience `+12`, and strong
components no longer stack linearly into an automatic 100.

A displayed 100 requires both elite latent quality and an extremely rare final
reception outcome. Non-exceptional outcomes retain headroom below 100.

The adjustable weights, uncertainty, genre scales, bad-film threshold, and
distribution targets are centralized in
`server/simulation/balance-config.ts`.

## Box office

The live weekly engine uses `simulateTerritoryWeek`; `simulateBoxOffice`
remains only as a compatibility calculator for old saves and comparisons.
Commercial demand stays separate from critical quality:

- awareness and interest: territory campaign state, stars, concept, and
  franchise recognition
- commercial appeal: genre market size, premise, and viable production scale
- opening: demand constrained by aggregate regular, IMAX, and Dolby capacity,
  release timing, competition, and independent log-normal variance
- legs: audience reception relative to pre-release expectations

Campaign actions convert spend into paid reach using one saturating curve, then
convert that reach into the canonical territory states: awareness, interest,
expectation, buzz, and paid reach. Actions never multiply gross. Pre-release
states decay slightly; exceptional post-release reception can produce organic
awareness and buzz.

IMAX and Dolby are separate finite pools. Each uses the same allocator with its
own film suitability score, supply, ticket price, demand, and booking window.
Standard, priority, and exclusive bookings affect allocation order or reserved
capacity. Unused exclusive inventory stays unused, and premium formats never
create demand.

Event potential is a geometric combination of awareness, interest, appeal,
scale, launch hook, timing, and competition opportunity. Only the rare upper
tail expands demand urgency and aggregate scheduling density. Gross is still
the sum of actual regular, IMAX, and Dolby admissions at their respective
ticket prices; there is no event or premium gross multiplier.

## Balance harness

Run:

```text
npm run balance -- --count=5000 --seed=balance-v1
```

The harness compares random AI, heuristic AI, a skilled optimizer, average,
high-budget, and low-budget productions. It reports:

- score mean, median, P10/P90, and 70+/80+/90+/95+/100 rates
- bad-film rate
- gross mean, median, P90, P99, P99.9, maximum, opening, and legs
- campaign diminishing-return checks
- separate IMAX/Dolby gross and finite-capacity checks
- calibrated mega-event and post-release cultural-phenomenon scenarios
- profitability and blockbuster frequency
- post-warmup record frequency
- heuristic-AI improvement and skilled-player advantage

Use fixed seeds when changing balance configuration so results remain
comparable.
