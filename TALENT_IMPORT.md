# Fast talent importer

This tool builds complete, reviewable talent batches from a short list of names.

## One-time setup

1. Request a free TMDB API Read Access Token at https://www.themoviedb.org/settings/api.
2. Open `.env` and add this line, replacing the placeholder:

   `TMDB_READ_ACCESS_TOKEN=PASTE_YOUR_TOKEN_HERE`

The token stays in `.env` on this computer and is not committed to GitHub.

## Add a batch

1. Copy `shared/data/talent-import-example.json` and replace its example people. Each person needs a name and one role: `actor`, `director`, `writer`, or `composer`. Actors can also specify `male`, `female`, or `unknown`.
2. Generate a review without changing the game:

   `npm run talent:preview -- shared/data/YOUR-LIST.json`

3. Open the generated Markdown report inside `shared/data/talent-import-drafts`. Ambiguous matches are clearly blocked. Less certain nationality, awards, current-career, and box-office values are marked for review.
4. Every generated value can be corrected in the original list. Supported corrections include `tmdbId`, `birthYear`, `nationality`, `awards`, `starRating`, `askingPrice`, `boxOfficeAvg`, `popularity`, `performance`, `experience`, `fame`, `imageUrl`, and individual `skills`.
5. Once the report looks right, apply its matching JSON preview:

   `npm run talent:apply -- shared/data/talent-import-drafts/PREVIEW-FILE.json`

Apply creates the next numbered talent batch, raises the content version, rebuilds the content manifest, and runs the content-update test. It refuses to continue when the preview contains a duplicate or ambiguous identity.

## What is automated

- Identity matching and duplicate detection
- Current movie-career check
- Role-relevant movie credits
- Birth year, gender, nationality, image, career span, and credit volume
- Fame, popularity, experience, performance, star rating, and asking price
- Reported box-office average from a person's most significant films
- Awards received where Wikidata has structured data
- Ten genre skills based on vote-adjusted ratings for relevant credited films

Adventure is not silently counted as Action. Sparse ratings are pulled toward an average score, so one obscure highly rated movie cannot automatically create a 90+ skill.
