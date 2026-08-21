# Film Studio Simulator - Design Guidelines

## Design Approach

**System**: Material Design with cinematic gaming aesthetic overlay
**Rationale**: Information-dense simulation requiring clear data hierarchy, multiple management screens, and real-time updates. Material Design provides robust patterns for dashboards and data visualization while allowing for thematic customization.

**Industry References**: 
- **IMDb** for ratings and film information display
- **Steam/Epic Games** for achievement and progression systems
- **Football Manager** for simulation dashboard layouts and stat tracking
- **Netflix** for content card presentation

## Typography System

**Font Families** (via Google Fonts CDN):
- **Display**: "Bebas Neue" - All caps for headers, film titles, and bold statements (400 weight)
- **Body**: "Inter" - Clean, readable for data and interface text (400, 500, 600, 700 weights)
- **Accents**: "Playfair Display" - Serif for awards, prestige elements (400, 700 weights)

**Hierarchy**:
- H1 (Studio/Page Headers): Bebas Neue, 48px/3rem
- H2 (Section Headers): Bebas Neue, 36px/2.25rem  
- H3 (Card Headers/Film Titles): Inter 600, 24px/1.5rem
- Body Large (Stats, Numbers): Inter 500, 18px/1.125rem
- Body Regular: Inter 400, 16px/1rem
- Small (Labels, Metadata): Inter 400, 14px/0.875rem
- Micro (Timestamps, Fine Print): Inter 400, 12px/0.75rem

## Layout System

**Spacing Primitives**: Tailwind units of 1, 2, 4, 6, 8, 12, 16, 24
- Component padding: p-4 to p-6
- Section spacing: gap-6 to gap-8
- Page margins: p-6 to p-8
- Card spacing: p-4 internal, gap-4 between

**Grid Structure**:
- Dashboard: 12-column grid for flexible widget placement
- Film cards: 3-4 column grid (grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4)
- Detail views: 2-column split (8/4 ratio for main content/sidebar)

**Container Widths**:
- Full-width dashboard: max-w-full with px-6
- Content sections: max-w-7xl
- Modal dialogs: max-w-4xl for complex forms, max-w-2xl for simple modals

## Core Components Library

### Navigation & Structure

**Main Navigation**: Persistent left sidebar (w-64)
- Studio logo/name at top
- Navigation items with icons (Film Awesome): Dashboard, Develop Film, Box Office, Film Library, Awards, Studio Settings
- Budget display prominently at bottom with large number treatment
- Collapse toggle for more screen space

**Top Bar**: 
- Current week/year indicator (game time)
- Quick actions (Fast forward time, Pause simulation)
- Notification bell for awards/milestones
- Studio prestige level indicator

### Dashboard Widgets

**Financial Summary Card**:
- Large number display for current budget (Bebas Neue, 3rem)
- Week-over-week change indicator with arrow icons
- Mini sparkline chart for budget trend
- Breakdown: Production costs, Marketing spend, Box office revenue

**Active Projects Grid**:
- Card-based layout showing films in development/production/post-production
- Progress bars for each phase
- Budget allocated vs spent
- Expected release date countdown

**Box Office Leaderboard**:
- Top 10 current releases (your films + competitors)
- Rank, film title, weekly gross, total gross, % change
- Your films highlighted with distinct treatment
- Click to expand for detailed week-by-week breakdown

### Film Development System

**Genre & Concept Selection**:
- Large genre cards with representative icons (Action, Drama, Comedy, Horror, Sci-Fi, etc.)
- Hoverable cards showing genre market trends and recent success rate
- Risk/reward indicators

**Budget Allocation Interface**:
- Three-column layout: Production Budget | Marketing Budget | Talent Budget
- Slider controls with live total calculator
- Suggested budget ranges based on genre
- Visual feedback when exceeding available funds

**Talent Hiring**:
- Search/filter bar for actors, directors, writers
- Talent cards showing:
  - Name, headshot placeholder (avatar icon)
  - Star rating (1-5 stars, using Font Awesome icons)
  - Asking price
  - Career stats (Box office track record, award wins)
  - Genre expertise tags
- Shortlist sidebar with selected talent and total cost

### Box Office Tracking

**Week-by-Week Timeline**:
- Horizontal scrollable timeline showing 12+ weeks
- Bar chart visualization for weekly grosses
- Theater count overlay line graph
- Milestone markers (Opening weekend, $100M, etc.)

**Performance Metrics Grid**:
- Large stat cards: Opening Weekend, Total Domestic, International, Worldwide
- Comparison vs budget (Profit/Loss calculation)
- Per-theater average
- Weeks in release

**Competition View**:
- Table showing all releases in current week
- Your film(s) highlighted
- Market share visualization (pie chart)

### Ratings & Reviews

**IMDb-Style Rating Display**:
- Large score (X.X/10.0) with star visualization
- Vote count in smaller text
- Critic score (0-100) with separate indicator
- Score breakdown chart (% of 10s, 9s, 8s, etc.)

**Review Snippets**:
- Pull quote cards from "critics"
- Star rating, critic name, publication
- Scrollable horizontal carousel

### Awards System

**Film Festival Calendar**:
- Timeline view of major festivals (Cannes, Sundance, Toronto, Venice, Berlin)
- Submission slots with film selection
- Entry fee display
- Results announcements with badge/ribbon graphics

**Awards Ceremony Interface**:
- Category cards (Best Picture, Director, Actor, etc.)
- Nomination reveals with film poster placeholders and nominee names
- Winner announcement with trophy icon and acceptance animation
- Trophy case showing your studio's wins

### Film Library

**Grid/List Toggle View**:
- Poster grid (default): 4-5 columns, film posters with title overlay
- List view: Table with sortable columns (Title, Release Date, Budget, Gross, Rating, Awards)

**Film Detail Modal**:
- Large poster area (left third)
- Right two-thirds: All stats, cast/crew, box office performance chart, ratings, awards won
- Archive/Delete options

## Data Visualization Elements

**Chart Types** (using Chart.js or similar):
- Line charts: Box office trends, budget over time
- Bar charts: Weekly grosses, competition comparison
- Pie charts: Market share, budget allocation
- Sparklines: Mini trend indicators in cards

**Visual Treatments**:
- Chart containers with subtle border and padding (p-4, border rounded-lg)
- Axis labels in Small typography
- Tooltips on hover for detailed data
- Legend placement below charts for clarity

## Interactive Patterns

**Modals**: 
- Overlay with semi-transparent backdrop
- Centered, shadowed container (shadow-2xl)
- Header with close button (×)
- Footer with action buttons (Cancel/Confirm)

**Buttons**:
- Primary: Solid with rounded corners (rounded-lg, px-6 py-3)
- Secondary: Outline style
- Danger: For destructive actions
- Icon buttons: Square (w-10 h-10) with centered icon

**Form Inputs**:
- Consistent height (h-12)
- Clear labels above fields
- Error states with red accent and message below
- Required field indicators (*)

**Cards**:
- Standard padding (p-6)
- Rounded corners (rounded-xl)
- Subtle shadow (shadow-md)
- Hover state: Slight elevation increase (hover:shadow-lg)

## Game-Specific UI Elements

**Progress Indicators**:
- Film development phases: Stepped progress bar (4 steps: Development → Pre-Production → Production → Post-Production)
- Budget depletion warnings: Visual alerts when funds low

**Notification System**:
- Toast notifications for events (Film released, Award won, Budget milestone)
- Slide-in from top-right
- Auto-dismiss after 5 seconds
- Icon indicating type (success, warning, info)

**Time Controls**:
- Prominent "Next Week" button
- Fast-forward options (1 week, 4 weeks, to next release)
- Pause/Play toggle for simulation

## Accessibility & Consistency

- All interactive elements minimum 44px touch target
- Form inputs with visible focus states (ring-2)
- Sufficient contrast for all text on backgrounds
- Icon buttons include aria-labels
- Keyboard navigation support for all interfaces

## Images

**Studio Logo/Branding**: Placeholder for user-created studio logo in top-left navigation (128x128px area)
**Film Posters**: Placeholder movie poster images throughout (2:3 aspect ratio, typically 200x300px in grids, larger in detail views)
**Talent Headshots**: Avatar circles (w-12 h-12 for lists, w-24 h-24 for hiring cards) with person icon placeholder
**Trophy/Award Icons**: Gold trophy vector icon for awards display
**No hero image required** - this is a simulation dashboard, not a marketing page