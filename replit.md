# Film Studio Simulator

## Overview

Film Studio Simulator is a single-player management game where players run a film studio, developing movies, managing budgets, tracking box office performance, and competing for awards. The application simulates the film production lifecycle from development through release, with dynamic box office tracking and talent management systems.

## Recent Changes (December 9, 2025)
- **Industry Magazine (Variety Weekly)**: Replaced Box Office Leaderboard with magazine-style news component
  - Accumulates 3 months (12 weeks) of stories with scrollable history
  - Uses seeded random selection to ensure stories refresh each week while being deterministic
  - Stories tagged with week/year and sorted by recency, then priority
  - Top story features the #1 box office performer with full details (mentions #2 and #3)
  - Director signing stories when talent attaches to productions
  - TV show pickup stories when shows start streaming
  - Box office record stories when films cross milestone thresholds
  - Award nomination stories (only during nomination week): "[Film] leads [Award Show] nominations with [X]"
  - Award ceremony stories (only during ceremony week): "[Film] sweeps at the [Award Show], taking home [X] including [categories]"
  - TV renewal stories when shows get picked up for new seasons
  - TV cancellation stories when shows are cancelled
  - Box office flop stories when films underperform (ROI < 60%)
  - Talent interview stories for upcoming films in various cities
  - Premiere tour stories for films about to release
  - Talent scandal stories (seeded random ~8% chance per week for high-profile talent)
  - Fallback stories generated when real data is missing
- **AI TV Shows System**: AI studios now create TV shows that compete with the player
  - 15% chance per AI studio per week during game preload to create TV shows
  - 8% chance per AI studio per week during regular gameplay for ongoing creation
  - AI TV shows start in 'airing' phase and immediately begin streaming
  - Each AI show gets a streaming deal with a platform (Streamflix, Max+, Apricot+, etc.)
  - Weekly streaming views tracked based on service subscribers, show quality, and time decay
  - Both TV show and TV deal records updated with consistent metrics each week
  - Proper playerGameId filtering prevents cross-save data contamination
- **Global Top 10 Charts Enhanced**: AI TV shows now appear in streaming platform rankings
  - All-content API returns both movies and TV shows with contentType field ('movie' | 'tvshow')
  - Metrics sourced directly from TV deal records for consistent Top 10 display
- **Schema Updates for TV Tracking**:
  - tvShows: Added episodesPerSeason, currentSeason, renewalStatus, weeksStreaming, weeklyViews
  - tvDeals: Added weeklyViews, totalViews, weeklyRevenue, totalRevenue, weeksActive
- **TV Shows Feature**: Complete television production system added
  - Database tables: tvShows, tvSeasons, tvEpisodes, tvDeals, tvNetworks
  - Production phases: concept → writers-room → pre-production → production → post-production → airing → hiatus → wrapped/cancelled
  - Show types: drama, comedy, limited series, anthology, documentary
  - Episode budgets: $2M-$25M per episode tiers
  - Streaming exclusive option with platform selection
  - Release strategies: weekly, binge (full season drop), or split season
  - Season management: Add seasons with automatic episode count and budget calculation
  - Navigation link added to sidebar with MonitorPlay icon
  - Route: `/tv-shows`

## Previous Changes (December 9, 2025)
- **Reimplemented First Look Deals**: Now come from writers/directors with complete film pitches
  - Talent (writers or directors) send emails pitching passion projects based on their strongest genre
  - Pitch includes: title, genre, synopsis, suggested budget, timeline, and script quality
  - Accepting creates a film in development with the talent already attached
  - 4% chance per week to receive a first look deal from an available writer/director
  - Email clearly shows talent name, role, and full project details
  - "Greenlight Project" button creates the film and marks talent as busy

## Previous Changes (December 5, 2025)
- **Release Calendar Redesign**: Monthly calendar view matching industry standards
  - 4-5 week columns per month with navigation arrows
  - Season icons (Winter ❄️, Spring 🌸, Summer ☀️, Fall 🍂)
  - Holiday indicators with box office modifier badges
  - Current week highlighted with visual emphasis
- **Genre-Based Holiday Effects**: 15 major holidays affect opening weekend based on film genre
  - Base modifiers: Christmas (+50%), Independence Day (+45%), Thanksgiving (+40%), etc.
  - Genre-specific multipliers on top of base:
    - Halloween: Horror +70%, Thriller +25%, Romance -25%
    - Valentine's Day: Romance +50%, Comedy +20%, Horror -20%
    - Christmas Week: Animation +45%, Fantasy +30%, Horror -30%
    - Independence Day: Action +35%, Sci-Fi +30%, Romance -15%
    - Easter: Animation +30%, Fantasy +20%, Horror -25%
  - Hover over holidays on calendar to see all genre effects
- **Sequel Opening Boost**: Sequels now get 25-40% opening weekend boost based on prequel success

## Previous Changes (December 4, 2025)
- **Added Top 10 Chart**: Netflix-style ranking chart added to all streaming service detail pages showing:
  - Film rank (#1-10) sorted by views
  - Film title with studio name
  - Weeks in Top 10 with visual bar indicators
  - Hours Viewed with progress bar visualization
  - Date range selector with week navigation
- **Fixed AI Streaming Acquisitions**: AI studios now correctly license films to streaming services
  - Fixed genre matching logic (genrePreferences is object, not array)
  - Fixed streaming service ID mismatch (IDs now match database: streamflix, primestream, maxplus, streamhub, galaxyplus)
  - Increased licensing probability from 30% to 50% base chance

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript using Vite as the build tool and development server.

**Routing**: Wouter for lightweight client-side routing with pages for Dashboard, Film Development, Box Office, Library, and Awards.

**State Management**: 
- React Context API via `GameProvider` for global game state management
- TanStack Query (React Query) for server state synchronization and caching
- Local state management with React hooks for component-level state

**UI Component System**:
- Radix UI primitives for accessible, unstyled components
- Shadcn/ui component library built on top of Radix UI
- Custom theming with CSS variables for light/dark mode support
- Tailwind CSS for utility-first styling

**Design System**:
- Typography: Bebas Neue (display), Inter (body), Playfair Display (accents)
- Material Design principles with cinematic gaming aesthetic
- References IMDb, Steam, Football Manager, and Netflix for UI patterns
- 12-column responsive grid system with mobile-first approach

**Key Features**:
- Time-based simulation with week/year progression
- Real-time data visualization using Recharts
- Multi-phase film production workflow:
  - Player films: development → pre-production → production → post-production → production-complete → awaiting-release → released
  - AI films: development → pre-production → production → post-production → production-complete → released (skip awaiting-release)
- Box office tracking with weekly revenue calculations
- Talent management system for directors, actors, and writers

### Backend Architecture

**Runtime**: Node.js with Express.js server framework

**API Design**: RESTful endpoints for CRUD operations on studios, films, and talent
- `/api/studio` - Studio management (get/create/update)
- `/api/films` - Film lifecycle management
- `/api/talent` - Talent database access

**Data Layer**:
- Drizzle ORM for type-safe database operations
- PostgreSQL-compatible schema (designed for Neon serverless)
- Schema includes: studios, films, talent, and users tables
- Foreign key relationships between films and talent (directors, writers, cast)

**Development Environment**:
- Vite middleware integration for HMR in development
- Custom build script using esbuild for server bundling
- Static file serving for production builds

**Session Management**: 
- Express sessions configured (though authentication appears to be planned but not fully implemented)
- CORS and request logging middleware

**Performance Optimizations**:
- Week advancement endpoint uses `Promise.all()` for parallel database operations:
  - Film phase updates processed in parallel batches
  - Box office release fetching parallelized across all films
  - Box office updates (releases + films) executed in parallel
  - Player + AI studio week/budget updates batched together
- AI film creation remains sequential to avoid budget race conditions
- Budget changes accumulated in memory and applied in single bulk update per studio

### Data Models

**Studio**: Represents the player's film studio with budget, prestige level, earnings, awards, and current game time (week/year).

**Film**: Core entity tracking movies through production phases with:
- Budget allocation (production, marketing, talent)
- Associated talent (director, writer, cast)
- Production progress and quality ratings
- Box office performance metrics (weekly revenue, total gross, theater count)
- Audience and critic scores
- Awards collection

**Talent**: Database of 340+ real Hollywood professionals loaded from `shared/data/talent.json`:
- 80 directors (Spielberg, Nolan, Scorsese, Tarantino, Villeneuve, etc.)
- 182 actors/actresses (DiCaprio, Robbie, Pitt, Lawrence, etc.)
- 78 writers (Sorkin, Coen Brothers, Tarantino, etc.)
- Profile pictures from Wikipedia/Wikimedia Commons (publicly accessible URLs)
- Star ratings (1-5 scale)
- Asking prices
- Box office track records
- Genre specializations
- Award history
- Birth year and nationality data

**Talent Seeding System**:
- `seedTalent()` in `storage.ts` loads from JSON file with idempotent upsert behavior
- Checks existing talent by name to avoid duplicates
- Supports partial database population (adds only missing entries)
- Falls back to minimal talent data if JSON file is unavailable

### Game Simulation Logic

**Time Progression**: Week-based advancement system that triggers:
- Film production progress updates
- Box office revenue calculations for released films
- Budget adjustments based on earnings
- Phase transitions for films in production

**Budget Management**: Players allocate funds across production, marketing, and talent acquisition with total studio budget tracking.

**Box Office Simulation**: Revenue generation based on:
- Production and marketing budgets
- Film quality ratings
- Talent star power
- Genre appeal
- Theater count and week-in-release degradation

**Territory-Based Release System**:
- Films are NOT automatically released worldwide - players must schedule territory-by-territory releases
- ReleaseScheduler UI component allows players to select territories, set release dates, and allocate marketing budgets per territory
- 11 major territories: North America (NA), China (CN), UK & Ireland (GB), France (FR), Japan (JP), Germany (DE), South Korea (KR), Mexico (MX), Australia (AU), India (IN), Other Territories (OTHER)
- Each territory release tracked in `film_releases` table with: filmId, territory, releaseWeek, releaseYear, marketingBudget, weeklyBoxOffice, totalBoxOffice
- Staggered release scheduling: films can open in different territories weeks apart (realistic Hollywood release pattern)
- AI studios also release in territories based on budget tier:
  - Blockbuster (>$150M): 8-11 territories (worldwide)
  - Major ($75-150M): 5-8 territories
  - Mid-budget ($30-75M): 2-5 territories
  - Indie (<$30M): 1-3 territories (limited release)

**Country-Based Box Office Tracking**:
- Box office calculated per-territory based on release dates (not global distribution)
- Each territory generates revenue only after its release date
- Weekly decay applied per-territory based on weeks since release in that territory
- Territories: North America (35% base, 28-45% range), China (19% base, 2-32% range), UK & Ireland (4.7%), France (4.7%), Japan (4.7%), India (1%), Germany (3%), South Korea (2.8%), Mexico (2.7%), Australia (2.2%), Other Territories (26.2%)
- Weekly and cumulative tracking per territory stored as JSONB in database
- BoxOfficeCountryBreakdown component displays interactive territorial breakdown with bar charts

**Box Office Page UI (Streaming Platform Style)**:
- Hero banner featuring the #1 film currently in theaters with key stats
- Horizontal scrolling carousels for film categories: "Your Films", "Currently in Theaters", "Coming Soon", "All-Time Hits"
- Poster-style film cards with gradient overlays showing rank, title, genre, weekly earnings, and total gross
- Click-to-expand film detail modal with country breakdown, scores, and profit/loss information
- Dark cinematic theme with smooth hover animations inspired by Netflix/Disney+
- Relaxed filtering: shows films with weekly earnings > $1,000 or within first 16 weeks of release

**Film Archiving System**:
- Films have a status field: 'active' (in theaters) or 'archived' (theatrical run complete)
- Minimum 12-week theatrical run before archival is possible
- Archival triggers when: weeksInRelease >= 12 AND weeklyGross < $100,000
- Films with weeklyGross <= $50,000 (box office update threshold) are also archived after 12 weeks
- Archived films record archivedWeek and archivedYear metadata
- Archived films are excluded from box office calculation loops (no longer generate weekly revenue)
- "Finished" badge displays on film cards when status === 'archived'
- Films can still appear in library, streaming deals, and award nominations after archival

**Streaming Market System**:
- 5 streaming platforms (StreamFlix, Prime Stream, Max Plus, Hulu+, Galaxy+) with distinct branding
- License fee calculation based on box office performance, quality scores, and genre matching
- Streaming deals stored in database with start week/year and status tracking
- Streaming page displays platforms with their branded cards and shows eligible films for licensing
- **Streaming View Tracking**: Active deals generate weekly views based on subscriber count, quality score, and genre match
- **Streaming Revenue**: Views generate ongoing revenue (revenue per view calculated from platform subscription model)
- **Deal Statistics**: Total views, streaming revenue, weeks active, and weeks remaining displayed per deal
- **Summary Dashboard**: Total views and streaming revenue shown in header statistics
- **Deal Duration**: Streaming deals have a set duration (default 2 years / 104 weeks)
- **Renewal System**: When a deal expires, if views exceeded 80% of expected views, the streaming service sends a renewal offer email
  - Performance-based renewal terms: Better performing films get higher renewal fees and longer terms (up to 3 years)
  - Performance ratings: Solid (0.8x), Excellent (1.0x+), Strong (1.2x+), Outstanding (1.5x+), Exceptional (2.0x+)
  - Renewal fee = 80% of original fee * performance bonus multiplier
  - Accepting renewal reactivates the deal with fresh view tracking for the new term

**Territory Filter for Box Office**:
- Dropdown filter above "All-Time Hits" section with 11 territories + worldwide option
- Territories: North America, China, UK & Ireland, France, Japan, Germany, South Korea, Mexico, Australia, India, Other Territories
- Films sorted by territory-specific box office when territory selected
- Falls back to worldwide gross when territory data unavailable
- All-Time Hits list extended to display up to 100 films

**Script Marketplace**:
- Browse and purchase pre-written scripts from professional writers
- 12 diverse scripts across genres (action, sci-fi, drama, horror, comedy, romance, thriller, fantasy, animation, musical)
- Each script includes: title, logline, synopsis, quality rating (65-89), price ($350K-$1.5M), estimated production budget
- Quality ratings affect film development: Excellent (85+), Good (75+), Decent (65+)
- Target audience indicators (general, family, teen, adult)
- Purchased scripts can fast-track development by providing pre-made title, genre, and synopsis
- Scripts are seeded on first API call; each script purchased removes from marketplace
- Link accessible from Development page header
- Route: `/scripts`

**Email System**:
- Gmail-inspired inbox interface with filters (All, Unread, Actions, by type)
- Email types: streaming_offer, production_deal, awards, festival, industry_news
- Automatic email generation during week advancement with various probabilities:
  - Streaming offers: 25% chance for films in theatrical release 4-12 weeks
  - Festival invitations: 10% chance for high-quality films in production phases
  - Production deals: 5% chance per week (co-production, first-look, slate financing)
  - Streaming production deals: Direct-to-streaming film offers with production deadlines
  - Awards campaigns: 15% during awards season (weeks 44-52 and 1-8) for films with critic score >= 80
- Action buttons to accept streaming offers, production deals, and launch awards campaigns
- Emails include realistic sender names, titles, and detailed body content
- Read/unread tracking, filtering, and archiving functionality
- Sidebar badge shows unread email count

**AI Streaming Acquisitions**:
- AI studios automatically license their films to streaming platforms (30% chance per eligible film per week)
- Films become eligible 8-16 weeks after release with quality score >= 60
- License fees calculated based on box office performance and quality
- Creates competition in the streaming marketplace

**Awards System**:
- 5 major award shows with realistic timing and categories:
  - Academy Awards (Oscars): Nominations week 3, Ceremony week 9, Prestige 5
  - Golden Globe Awards: Nominations week 50, Ceremony week 2, Prestige 4
  - BAFTA Film Awards: Nominations week 1, Ceremony week 4, Prestige 4
  - SAG Awards: Nominations week 4, Ceremony week 10, Prestige 3
  - Critics Choice Awards: Nominations week 49, Ceremony week 52, Prestige 3
- Categories per show: Best Picture, Director, Actor, Actress, Supporting Actor/Actress, Screenplay, Cinematography, Animated Feature, Documentary, Visual Effects (varies by show)
- Awards are NOT generated instantly on film release - they come from proper award ceremonies
- Nominations announced at nominationsWeek, winners determined at ceremonyWeek during week advancement
- Awards campaigns can be launched via email system to boost chances of winning
- Films must be released in previous calendar year and meet minimum quality thresholds to be eligible
- Prestige bonuses: Winners receive budget bonus based on show's prestige level (prestige * $100,000)
- Database tables: award_shows, award_categories, award_nominations, award_ceremonies
- Awards page displays all shows with timing info, active nominations, and award history

## External Dependencies

### UI Libraries
- **Radix UI**: Comprehensive collection of accessible UI primitives (accordions, dialogs, dropdowns, tooltips, etc.)
- **Recharts**: Charting library for box office and financial visualizations
- **Lucide React**: Icon library for consistent UI iconography
- **Embla Carousel**: Touch-friendly carousel component

### Forms and Validation
- **React Hook Form**: Form state management with performance optimization
- **Zod**: TypeScript-first schema validation
- **Drizzle-Zod**: Schema validation integration with database models

### Styling
- **Tailwind CSS**: Utility-first CSS framework
- **Class Variance Authority**: Component variant management
- **clsx/tailwind-merge**: Conditional className utilities

### Database
- **Neon Serverless PostgreSQL**: Cloud-hosted PostgreSQL database
- **Drizzle ORM**: Type-safe ORM with migration support
- **WebSocket (ws)**: Required for Neon serverless connection pooling

### Development Tools
- **Vite**: Fast development server and build tool
- **TypeScript**: Type safety across the stack
- **ESBuild**: Fast JavaScript bundler for production builds
- **Replit Plugins**: Development banner, cartographer, and error overlay for Replit environment

### Utility Libraries
- **date-fns**: Date manipulation and formatting
- **nanoid**: Unique ID generation
- **wouter**: Lightweight routing library

### Google Fonts CDN
- Bebas Neue, Inter, and Playfair Display loaded via Google Fonts for consistent typography across devices