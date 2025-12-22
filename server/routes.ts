import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertFilmSchema, insertStudioSchema, insertTalentSchema, InsertEmail, Film, Studio } from "@shared/schema";
import { setupWebSocket } from "./websocket";
import { registerMultiplayerRoutes } from "./multiplayer-routes";
import { 
  distributeBoxOfficeByCountry, 
  distributeBoxOfficeToTerritories,
  distributeBoxOfficeWithFixedPercentages,
  generateTerritoryPercentages,
  BOX_OFFICE_COUNTRIES,
  getTerritoryBasePercentage,
  getCountryName
} from "@shared/countries";
import { generateFilmDescription } from "@shared/descriptionTemplates";
import { getGenreHolidayModifier, getHolidayForWeek } from "@shared/holidays";
import { z } from "zod";

// Streaming service data for email generation and view calculations
// IDs must match database streaming_services table: streamflix, primestream, maxplus, streamhub, galaxyplus
const streamingServiceData = [
  {
    id: 'streamflix',
    name: 'StreamFlix',
    color: '#E50914',
    description: 'Global entertainment leader',
    subscriberCount: 260,
    genrePreferences: { action: 1.0, thriller: 0.95, scifi: 1.0, drama: 0.9, comedy: 0.85, horror: 0.8, romance: 0.75, animation: 0.9, fantasy: 0.95, musicals: 0.65 }
  },
  {
    id: 'primestream',
    name: 'Prime Stream',
    color: '#00A8E1',
    description: 'Premium streaming destination',
    subscriberCount: 200,
    genrePreferences: { action: 0.95, thriller: 0.9, scifi: 0.9, drama: 0.9, comedy: 0.9, horror: 0.75, romance: 0.8, animation: 0.8, fantasy: 0.9, musicals: 0.7 }
  },
  {
    id: 'maxplus',
    name: 'Max+',
    color: '#5822B4',
    description: 'Quality content curator',
    subscriberCount: 95,
    genrePreferences: { drama: 1.0, thriller: 0.95, action: 0.85, scifi: 0.85, comedy: 0.8, horror: 0.7, romance: 0.85, animation: 0.75, fantasy: 0.8, musicals: 0.8 }
  },
  {
    id: 'streamhub',
    name: 'StreamHub',
    color: '#1CE783',
    description: 'Fresh entertainment daily',
    subscriberCount: 50,
    genrePreferences: { comedy: 1.0, drama: 0.9, thriller: 0.85, action: 0.8, horror: 0.8, scifi: 0.75, romance: 0.85, animation: 0.8, fantasy: 0.75, musicals: 0.7 }
  },
  {
    id: 'galaxyplus',
    name: 'Galaxy+',
    color: '#113CCF',
    description: 'Family entertainment hub',
    subscriberCount: 70,
    genrePreferences: { animation: 1.0, fantasy: 0.95, scifi: 0.9, action: 0.8, comedy: 0.85, drama: 0.8, horror: 0.6, thriller: 0.75, romance: 0.8, musicals: 0.85 }
  },
];

// Production company names for deal emails
const productionCompanies = [
  'Legendary Pictures', 'Blumhouse Productions', 'A24', 'Annapurna Pictures',
  'Plan B Entertainment', 'Bad Robot Productions', 'Syncopy', 'New Regency',
  'Amblin Entertainment', 'Scott Free Productions', 'Monkeypaw Productions',
  'Chernin Entertainment', 'Temple Hill Entertainment', 'Spyglass Media',
];

// Email sender names
const streamingExecs = [
  { name: 'Sarah Chen', title: 'VP of Content Acquisition' },
  { name: 'Michael Torres', title: 'Director of Film Licensing' },
  { name: 'Emily Watson', title: 'Head of Strategic Partnerships' },
  { name: 'David Kim', title: 'Senior Content Executive' },
  { name: 'Jennifer Adams', title: 'VP of Original Content' },
];

const GENRES = ['action', 'comedy', 'drama', 'horror', 'scifi', 'romance', 'thriller', 'animation', 'fantasy', 'musicals'];

const productionExecs = [
  { name: 'Robert Sterling', title: 'President of Production' },
  { name: 'Lisa Park', title: 'Chief Creative Officer' },
  { name: 'Andrew Blake', title: 'VP of Development' },
];

// Helper to format currency
function formatMoney(amount: number): string {
  if (amount >= 1000000000) return `$${(amount / 1000000000).toFixed(1)}B`;
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

// Clamp investment budget by genre for box office calculations
function clampInvestmentBudgetByGenre(budget: number, genre: string): number {
  const genreMaxBudgets: Record<string, number> = {
    'drama': 30000000,
    'comedy': 125000000,
    'romance': 50000000,
    'thriller': 60000000,
    'horror': 150000000,
    'action': 200000000,
    'scifi': 200000000,
    'animation': 200000000,
    'fantasy': 200000000,
    'musicals': 100000000,
  };
  
  const maxBudget = genreMaxBudgets[genre] || 50000000;
  return Math.min(budget, maxBudget);
}

// Calculate script quality based on writer talent
function calculateScriptQualityFromWriter(writer: any): number {
  const perf = writer.performance || 50;
  const exp = writer.experience || 50;
  const random = Math.random() * 40 - 20;
  
  const quality = 60 
    + ((perf - 50) / 50) * 10 * (exp / 50)  // performance boost (scales with experience)
    + ((exp - 50) / 50) * 10                 // experience boost
    + random;                                 // random variance ±20
  
  return Math.min(100, Math.floor(quality));
}

// Tier-based audience multiplier for box office
// Maps audience scores to multipliers that reflect real-world attendance patterns
// Rolls random number based on whether score is above or below 7.0
// Above 7.0: rolls 1.0-2.0x range | Below 7.0: rolls 0.7-1.0x range
function getAudienceMultiplier(audienceScore: number): number {
  const score = audienceScore || 7;
  
  if (score >= 7.0) {
    // Above 7.0: roll in boost range (1.0-2.0x)
    return 1.0 + Math.random() * 1.0;
  } else {
    // Below 7.0: roll in penalty range (0.7-1.0x)
    return 0.7 + Math.random() * 0.3;
  }
}

// Character name pools for role generation
const maleCharacterNames = [
  'James', 'Marcus', 'Thomas', 'Robert', 'David', 'Michael', 'Christopher', 'Daniel', 
  'Jack', 'Alex', 'Ryan', 'Nathan', 'Lucas', 'Oliver', 'Ethan', 'Noah', 'Benjamin',
  'Samuel', 'Joseph', 'Gabriel', 'Henry', 'Mason', 'Logan', 'Aiden', 'Jacob', 'Jackson'
];

const femaleCharacterNames = [
  'Emma', 'Sarah', 'Victoria', 'Charlotte', 'Olivia', 'Amelia', 'Isabella', 'Sophia',
  'Ava', 'Mia', 'Harper', 'Grace', 'Lily', 'Elena', 'Scarlett', 'Madison', 'Natalie',
  'Rachel', 'Jessica', 'Alexandra', 'Catherine', 'Margaret', 'Claire', 'Anna', 'Emily'
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
  'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris'
];

function generateCharacterName(gender: string): string {
  const firstName = gender === 'male' 
    ? maleCharacterNames[Math.floor(Math.random() * maleCharacterNames.length)]
    : gender === 'female'
    ? femaleCharacterNames[Math.floor(Math.random() * femaleCharacterNames.length)]
    : Math.random() > 0.5 
    ? maleCharacterNames[Math.floor(Math.random() * maleCharacterNames.length)]
    : femaleCharacterNames[Math.floor(Math.random() * femaleCharacterNames.length)];
  
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  return `${firstName} ${lastName}`;
}

// Genre-specific story elements for AI film synopses
const genreStoryElements: Record<string, { stakes: string[]; antagonists: string[]; roles: string[] }> = {
  action: {
    stakes: ["a nuclear threat looms over the city", "time runs out to save millions", "the world hangs in the balance", "an unstoppable army approaches"],
    antagonists: ["a ruthless crime lord", "a rogue military commander", "an international terrorist cell", "a vengeful assassin"],
    roles: ["a legendary warrior", "an elite special forces operative", "the ultimate protector", "the hero the world needs"]
  },
  drama: {
    stakes: ["family secrets threaten to destroy everything", "facing an impossible choice that will change everything", "confronting the ghosts of the past", "finding meaning in tragedy"],
    antagonists: ["inner demons", "societal expectations", "a devastating illness", "the weight of past mistakes"],
    roles: ["someone who refuses to give up", "a voice for the voiceless", "a beacon of hope", "the heart of the family"]
  },
  comedy: {
    stakes: ["save the family business from disaster", "win back the love of their life before the wedding", "survive the worst vacation ever", "pull off the impossible scheme"],
    antagonists: ["their own worst instincts", "a hilariously incompetent rival", "Murphy's Law incarnate", "an absurd series of misunderstandings"],
    roles: ["the unlikely hero everyone underestimates", "the master of disaster", "the lovable chaos agent", "everyone's favorite troublemaker"]
  },
  horror: {
    stakes: ["the shadows hold unspeakable horrors", "an ancient evil awakens", "no one can be trusted", "survival becomes a waking nightmare"],
    antagonists: ["an entity that feeds on fear", "a vengeful spirit seeking retribution", "something that should not exist", "the darkness within"],
    roles: ["the sole survivor", "the one who sees the truth", "humanity's last hope against the darkness", "the final girl"]
  },
  scifi: {
    stakes: ["humanity's future hangs by a thread", "reality itself begins to unravel", "first contact changes everything", "a discovery that rewrites history"],
    antagonists: ["a malevolent AI", "an alien threat beyond comprehension", "a corporation that will stop at nothing", "their own creation"],
    roles: ["the visionary who sees what others cannot", "the bridge between worlds", "humanity's ambassador to the unknown", "the scientist who must fix their mistake"]
  },
  romance: {
    stakes: ["love finds a way against all odds", "two hearts finally find each other", "a second chance at happiness", "the courage to be vulnerable"],
    antagonists: ["timing and circumstance", "family disapproval", "past heartbreak", "the fear of opening up"],
    roles: ["someone's soulmate", "the love they never knew they needed", "a hopeless romantic finally finding hope", "the one who teaches them to love again"]
  },
  animation: {
    stakes: ["a magical kingdom needs saving", "friendship is put to the ultimate test", "discovering their true potential", "finding where they truly belong"],
    antagonists: ["a power-hungry sorcerer", "the forces of chaos", "their own self-doubt", "a villain who was once a friend"],
    roles: ["an unlikely hero", "the chosen one", "a friend to all creatures", "the bravest of them all"]
  },
  thriller: {
    stakes: ["the truth is more dangerous than anyone imagined", "trust becomes impossible", "every clue leads deeper into danger", "the hunter becomes the hunted"],
    antagonists: ["a mastermind always one step ahead", "a conspiracy reaching the highest levels", "someone hiding in plain sight", "a killer who knows all their secrets"],
    roles: ["the only one who sees the pattern", "an unstoppable investigator", "someone who won't stop until the truth is revealed", "the witness who can't forget"]
  },
  fantasy: {
    stakes: ["the prophecy unfolds", "ancient magic awakens", "the realm faces its darkest hour", "destinies intertwine"],
    antagonists: ["the Dark Lord rising", "a corrupted king", "creatures of shadow and flame", "an immortal evil"],
    roles: ["the prophesied hero", "the last of their kind", "a wielder of ancient power", "the kingdom's only hope"]
  },
  musicals: {
    stakes: ["the show must go on", "dreams are worth fighting for", "finding their voice changes everything", "proving that music heals all"],
    antagonists: ["stage fright and self-doubt", "a ruthless producer", "the pressure of expectations", "the fear of failure"],
    roles: ["a star waiting to shine", "a dreamer who refuses to quit", "the heart of the show", "a voice that moves the world"]
  }
};

async function generateAIFilmSynopsis(filmId: string, title: string, genre: string): Promise<string> {
  const elements = genreStoryElements[genre] || genreStoryElements.drama;
  const stakes = elements.stakes[Math.floor(Math.random() * elements.stakes.length)];
  const antagonist = elements.antagonists[Math.floor(Math.random() * elements.antagonists.length)];
  const role = elements.roles[Math.floor(Math.random() * elements.roles.length)];
  
  const filmRoles = await storage.getFilmRolesByFilm(filmId);
  const film = await storage.getFilm(filmId);
  
  let protagonist = "An unlikely hero";
  let directorName = "a visionary director";
  const talentNames: string[] = [];
  
  if (filmRoles && filmRoles.length > 0) {
    const leadRole = filmRoles.find(r => r.importance === 'lead');
    if (leadRole && leadRole.castMemberId) {
      const castMember = await storage.getTalent(leadRole.castMemberId);
      if (castMember) {
        protagonist = leadRole.roleName || castMember.name;
        talentNames.push(castMember.name);
      }
    }
    for (const r of filmRoles.slice(0, 3)) {
      if (r.castMemberId && !talentNames.includes(r.castMemberId)) {
        const talent = await storage.getTalent(r.castMemberId);
        if (talent && !talentNames.includes(talent.name)) {
          talentNames.push(talent.name);
        }
      }
    }
  }
  
  if (film?.directorId) {
    const director = await storage.getTalent(film.directorId);
    if (director) {
      directorName = director.name;
    }
  }
  
  if (talentNames.length === 0) {
    talentNames.push("an all-star cast", "incredible performances");
  }
  
  return generateFilmDescription(genre, title, protagonist, directorName, talentNames, antagonist, role, stakes);
}

// AI Talent Hiring Helpers
async function generateFilmRoles(filmId: string, genre: string, prodBudget: number) {
  console.log(`[GENERATE-ROLES] Creating roles for film ${filmId}, genre: ${genre}, budget: ${prodBudget}`);
  // Generate roles based on genre and budget
  const roleCount = genre === 'action' ? 6 : genre === 'animation' ? 5 : 4;
  const importances: Array<'lead' | 'supporting' | 'minor'> = ['lead', 'lead', 'supporting', 'supporting', 'minor', 'minor'];
  const characterTypes = ['hero', 'villain', 'love_interest', 'mentor', 'sidekick', 'comic_relief'];
  const genders = ['male', 'female', 'any'];
  
  const usedNames = new Set<string>();
  const roles = [];
  for (let i = 0; i < roleCount; i++) {
    const gender = genders[Math.floor(Math.random() * genders.length)];
    let characterName = generateCharacterName(gender);
    // Ensure unique names
    while (usedNames.has(characterName)) {
      characterName = generateCharacterName(gender);
    }
    usedNames.add(characterName);
    
    roles.push({
      filmId,
      roleName: characterName,
      importance: importances[i] || 'minor',
      characterType: characterTypes[i % characterTypes.length] as any,
      genderPreference: gender,
    });
  }
  
  // Create all roles in parallel
  const createdRoles = await Promise.all(roles.map(role => storage.createFilmRole(role)));
  console.log(`[GENERATE-ROLES] Created ${createdRoles.length} roles for film ${filmId}`);
  return createdRoles;
}

async function hireAITalent(filmId: string, genre: string, aiStudio: any): Promise<number> {
  let totalTalentCost = 0;
  try {
    const film = await storage.getFilm(filmId);
    if (!film) {
      return 0;
    }
    
    const allTalent = await storage.getAllTalent();
    
    // Calculate when talent will be busy until (production end + a buffer)
    const totalProductionWeeks = (film.developmentDurationWeeks || 0) + 
                                 (film.preProductionDurationWeeks || 0) + 
                                 (film.productionDurationWeeks || 0) + 
                                 (film.postProductionDurationWeeks || 0) + 2;
    let busyUntilWeek = film.createdAtWeek + totalProductionWeeks;
    let busyUntilYear = film.createdAtYear;
    while (busyUntilWeek > 52) {
      busyUntilWeek -= 52;
      busyUntilYear += 1;
    }
    
    const directorCandidates = allTalent.filter(t => t.type === 'director');
    const writerCandidates = allTalent.filter(t => t.type === 'writer');
    
    let directorId: string | undefined;
    let writerId: string | undefined;
    let scriptQuality = film.scriptQuality;
    let directorCost = 0;
    let writerCost = 0;
    
    // Select director - randomize from candidates for diversity
    if (directorCandidates.length > 0) {
      const randomDirectorIndex = Math.floor(Math.random() * directorCandidates.length);
      const director = directorCandidates[randomDirectorIndex];
      directorId = director.id;
      directorCost = director.askingPrice || 5000000;
      totalTalentCost += directorCost;
      await storage.updateTalent(director.id, { currentFilmId: filmId, busyUntilWeek, busyUntilYear });
    }
    
    // Select writer - randomize from candidates for diversity
    if (writerCandidates.length > 0) {
      const randomWriterIndex = Math.floor(Math.random() * writerCandidates.length);
      const writer = writerCandidates[randomWriterIndex];
      writerId = writer.id;
      writerCost = writer.askingPrice || 5000000;
      totalTalentCost += writerCost;
      scriptQuality = calculateScriptQualityFromWriter(writer);
      await storage.updateTalent(writer.id, { currentFilmId: filmId, busyUntilWeek, busyUntilYear });
    }
    
    const actorMatchesGender = (actor: any, genderPref: string): boolean => {
      if (genderPref === 'any') return true;
      return actor.gender === genderPref;
    };
    
    const actorCandidates = allTalent.filter(t => t.type === 'actor');
    let roles = await storage.getFilmRolesByFilm(filmId);
    
    if (!roles || roles.length === 0) {
      await generateFilmRoles(filmId, genre, film.productionBudget || 0);
      roles = await storage.getFilmRolesByFilm(filmId);
    }
    
    const castActorIds: string[] = [];
    const usedActorIds = new Set<string>();
    let actorsCost = 0;
    
    const sortedRoles = roles.sort((a, b) => {
      const importanceOrder: Record<string, number> = { lead: 0, supporting: 1, minor: 2 };
      return (importanceOrder[a.importance] || 2) - (importanceOrder[b.importance] || 2);
    });
    
    for (const role of sortedRoles) {
      if (role.isCast) continue;
      
      const roleGender = role.genderPreference || 'any';
      let matchingActors = actorCandidates.filter(a => 
        !usedActorIds.has(a.id) && 
        actorMatchesGender(a, roleGender)
      );
      
      if (matchingActors.length === 0) {
        matchingActors = actorCandidates.filter(a => !usedActorIds.has(a.id));
      }
      
      if (matchingActors.length > 0) {
        const randomIndex = Math.floor(Math.random() * matchingActors.length);
        const actor = matchingActors[randomIndex];
        const actorCost = actor.askingPrice || 5000000;
        actorsCost += actorCost;
        await storage.updateFilmRole(role.id, { actorId: actor.id, isCast: true });
        await storage.updateTalent(actor.id, { currentFilmId: filmId, busyUntilWeek, busyUntilYear });
        castActorIds.push(actor.id);
        usedActorIds.add(actor.id);
      }
    }
    
    totalTalentCost += actorsCost;
    
    // Select composer
    const composerCandidates = allTalent.filter(t => t.type === 'composer');
    let composerId: string | undefined;
    let composerCost = 0;
    
    if (composerCandidates.length > 0) {
      const randomComposerIndex = Math.floor(Math.random() * composerCandidates.length);
      const composer = composerCandidates[randomComposerIndex];
      composerId = composer.id;
      composerCost = composer.askingPrice || 3000000;
      totalTalentCost += composerCost;
      await storage.updateTalent(composer.id, { currentFilmId: filmId, busyUntilWeek, busyUntilYear });
    }
    
    const filmUpdateData: any = {};
    if (directorId) filmUpdateData.directorId = directorId;
    if (writerId) filmUpdateData.writerId = writerId;
    if (composerId) filmUpdateData.composerId = composerId;
    if (scriptQuality !== film.scriptQuality) filmUpdateData.scriptQuality = scriptQuality;
    filmUpdateData.castIds = castActorIds;
    filmUpdateData.hasHiredTalent = true;
    filmUpdateData.talentBudget = totalTalentCost;
    
    // Recalculate marketing budget to include talent costs for AI films
    // Investment = production + departments + talent
    const investmentBudget = (film.productionBudget || 0) + 
      (film.setsBudget || 0) + (film.costumesBudget || 0) + (film.stuntsBudget || 0) + 
      (film.makeupBudget || 0) + (film.practicalEffectsBudget || 0) + (film.soundCrewBudget || 0) + 
      totalTalentCost;
    
    // For AI films, recalculate marketing as 80-150% of full investment (including talent)
    const filmStudio = await storage.getStudio(film.studioId);
    if (filmStudio?.isAI) {
      const marketingRatio = 0.80 + Math.random() * 0.70; // 80-150%
      const newMarketingBudget = Math.floor(investmentBudget * marketingRatio);
      filmUpdateData.marketingBudget = newMarketingBudget;
      filmUpdateData.totalBudget = investmentBudget + newMarketingBudget;
      console.log(`[AI-TALENT-HIRED] ${film.title}: talent=$${Math.round(totalTalentCost/1000000)}M, investment=$${Math.round(investmentBudget/1000000)}M, newMarketing=$${Math.round(newMarketingBudget/1000000)}M, ratio=${(marketingRatio*100).toFixed(1)}%`);
    } else {
      // Player films: just add talent cost to total
      filmUpdateData.totalBudget = (film.totalBudget || 0) + totalTalentCost;
    }
    
    await storage.updateFilm(filmId, filmUpdateData);
    return totalTalentCost;
  } catch (error) {
    return 0;
  }
}


// Email generation functions
async function generateStreamingOfferEmail(
  film: Film,
  playerGameId: string,
  currentWeek: number,
  currentYear: number
): Promise<InsertEmail | null> {
  // Only send offers for films that have been released 4-12 weeks
  const weeksInRelease = film.weeklyBoxOffice?.length || 0;
  if (weeksInRelease < 4 || weeksInRelease > 12) return null;
  if (film.phase !== 'released') return null;
  
  // Only 25% chance per week to send an offer
  if (Math.random() > 0.25) return null;
  
  // Pick a random streaming service
  const service = streamingServiceData[Math.floor(Math.random() * streamingServiceData.length)];
  const exec = streamingExecs[Math.floor(Math.random() * streamingExecs.length)];
  
  // Check if this film has ever been on this streaming service before (including expired deals)
  const allFilmDeals = await storage.getStreamingDealsByFilm(film.id);
  const previousDealWithService = allFilmDeals.find(deal => deal.streamingServiceId === service.id);
  if (previousDealWithService) {
    // Film was already on this streaming service - don't allow re-signing to same service
    return null;
  }
  
  // Check if film has been on ANY streaming service before (for reduced payment)
  const hasBeenOnStreaming = allFilmDeals.length > 0;
  
  // Calculate license fee based on box office performance
  const totalBoxOffice = film.totalBoxOffice || 0;
  const qualityScore = (film.audienceScore || 7) * 10; // Use audience score only (converted to 0-100 scale)
  const baseFee = totalBoxOffice * 0.15;
  const qualityBonus = baseFee * (qualityScore / 100) * 0.3;
  let licenseFee = Math.round((baseFee + qualityBonus) * (0.8 + Math.random() * 0.4));
  
  // If film has been on streaming before, reduce payment to 1/10
  if (hasBeenOnStreaming) {
    licenseFee = Math.round(licenseFee / 10);
  }
  
  // Calculate expiration (4 weeks from now)
  let expiresWeek = currentWeek + 4;
  let expiresYear = currentYear;
  if (expiresWeek > 52) {
    expiresWeek = expiresWeek - 52;
    expiresYear += 1;
  }
  
  // Different email body for previously-streamed films
  const emailBody = hasBeenOnStreaming 
    ? `Dear Studio Executive,

We understand "${film.title}" has previously been available on another streaming platform. While the film's initial streaming window has passed, we believe there's still an audience for this title on ${service.name}.

Given the film's prior streaming availability, we're prepared to offer: ${formatMoney(licenseFee)} for a 24-month streaming window.

This is a secondary market offer, but we're confident the film will find new viewers on our platform.

Best regards,
${exec.name}
${exec.title}
${service.name}`
    : `Dear Studio Executive,

We've been following the impressive theatrical run of "${film.title}" with great interest. The film's performance at the box office (${formatMoney(totalBoxOffice)} to date) and strong audience reception have made it a prime candidate for our platform.

${service.name} would like to acquire the exclusive streaming rights for "${film.title}". We believe our ${service.description.toLowerCase()} would be the perfect home for this film as it transitions from theatrical release.

Our offer: ${formatMoney(licenseFee)} for a 24-month exclusive streaming window.

This includes premium placement on our platform, featured promotion during launch week, and inclusion in our "New Arrivals" spotlight.

We would appreciate your response within the next few weeks, as our content calendar is filling up quickly.

Best regards,
${exec.name}
${exec.title}
${service.name}`;

  return {
    playerGameId,
    sender: service.name,
    senderTitle: exec.name + ', ' + exec.title,
    subject: hasBeenOnStreaming ? `Secondary Streaming Offer for "${film.title}"` : `Streaming Offer for "${film.title}"`,
    body: emailBody,
    type: 'streaming_offer',
    sentWeek: currentWeek,
    sentYear: currentYear,
    expiresWeek,
    expiresYear,
    hasAction: true,
    actionLabel: 'Accept Offer',
    actionData: {
      filmId: film.id,
      filmTitle: film.title,
      streamingService: service.name,
      streamingServiceId: service.id,
      offerAmount: licenseFee,
    },
    isRead: false,
    isArchived: false,
  };
}

async function generateStreamingRenewalEmail(
  deal: StreamingDeal,
  film: Film,
  service: typeof streamingServiceData[0],
  playerGameId: string,
  currentWeek: number,
  currentYear: number
): Promise<InsertEmail | null> {
  const exec = streamingExecs[Math.floor(Math.random() * streamingExecs.length)];
  
  // Calculate performance rating based on views
  const totalViews = deal.totalViews || 0;
  const licenseYears = deal.licenseYears || 2;
  const subscriberBase = service.subscriberCount * 1000000;
  
  // Expected views threshold: 50% of subscribers per year of the deal
  // A hit film should get ~half the subscriber base watching per year
  const expectedViews = subscriberBase * 0.50 * licenseYears;
  const performanceRatio = totalViews / expectedViews;
  
  // Only send renewal if performance was at least 80% of expectations
  if (performanceRatio < 0.8) return null;
  
  // Calculate new license fee based on performance
  // Better performance = better renewal terms
  let renewalBonus = 1.0;
  let performanceLabel = "solid";
  if (performanceRatio >= 2.0) {
    renewalBonus = 1.8;
    performanceLabel = "exceptional";
  } else if (performanceRatio >= 1.5) {
    renewalBonus = 1.5;
    performanceLabel = "outstanding";
  } else if (performanceRatio >= 1.2) {
    renewalBonus = 1.3;
    performanceLabel = "strong";
  } else if (performanceRatio >= 1.0) {
    renewalBonus = 1.15;
    performanceLabel = "excellent";
  }
  
  // Base renewal fee is 80% of original license fee with performance bonus
  const originalFee = deal.licenseFee || 0;
  const renewalFee = Math.round(originalFee * 0.8 * renewalBonus);
  const renewalYears = performanceRatio >= 1.5 ? 3 : 2; // Offer longer deals for top performers
  
  // Calculate expiration (3 weeks to decide)
  let expiresWeek = currentWeek + 3;
  let expiresYear = currentYear;
  if (expiresWeek > 52) {
    expiresWeek = expiresWeek - 52;
    expiresYear += 1;
  }
  
  const formattedViews = totalViews >= 1000000 
    ? `${(totalViews / 1000000).toFixed(1)}M` 
    : `${Math.round(totalViews / 1000)}K`;
  
  return {
    playerGameId,
    sender: service.name,
    senderTitle: exec.name + ', ' + exec.title,
    subject: `Renewal Offer: "${film.title}" Streaming Deal`,
    body: `Dear Studio Executive,

The streaming performance of "${film.title}" on ${service.name} has been ${performanceLabel}. With ${formattedViews} total views over the past ${licenseYears} year${licenseYears > 1 ? 's' : ''}, this film has resonated strongly with our subscribers.

As your current licensing agreement is coming to an end, we would like to extend our partnership. ${service.name} is prepared to offer a ${renewalYears}-year renewal deal.

Our offer: ${formatMoney(renewalFee)} for an additional ${renewalYears}-year exclusive streaming window.

This renewal includes continued premium placement and promotional support. Given the film's proven track record on our platform, we're confident it will continue to perform well.

Please let us know your decision within the next few weeks.

Best regards,
${exec.name}
${exec.title}
${service.name}`,
    type: 'streaming_renewal',
    sentWeek: currentWeek,
    sentYear: currentYear,
    expiresWeek,
    expiresYear,
    hasAction: true,
    actionLabel: 'Accept Renewal',
    actionData: {
      dealId: deal.id,
      filmId: film.id,
      filmTitle: film.title,
      streamingService: service.name,
      streamingServiceId: service.id,
      renewalAmount: renewalFee,
      renewalYears: renewalYears,
    },
    isRead: false,
    isArchived: false,
  };
}

async function generateProductionDealEmail(
  studio: Studio,
  playerGameId: string,
  currentWeek: number,
  currentYear: number
): Promise<InsertEmail | null> {
  // 5% chance per week to receive a production deal
  if (Math.random() > 0.05) return null;
  
  const company = productionCompanies[Math.floor(Math.random() * productionCompanies.length)];
  const exec = productionExecs[Math.floor(Math.random() * productionExecs.length)];
  
  // Generate deal amount based on studio prestige
  const baseAmount = 10000000 + Math.random() * 40000000;
  const prestigeBonus = (studio.prestigeLevel || 1) * 5000000;
  const dealAmount = Math.round(baseAmount + prestigeBonus);
  
  // Calculate expiration (8 weeks from now)
  let expiresWeek = currentWeek + 8;
  let expiresYear = currentYear;
  if (expiresWeek > 52) {
    expiresWeek = expiresWeek - 52;
    expiresYear += 1;
  }
  
  // 50% chance for slate financing vs co-production
  const isSlateFinancing = Math.random() > 0.5;
  
  if (isSlateFinancing) {
    // Slate financing deal - investor takes a cut of profits from multiple films
    const profitSharePercent = 20 + Math.floor(Math.random() * 15); // 20-35%
    const filmsCount = 3 + Math.floor(Math.random() * 3); // 3-5 films
    
    return {
      playerGameId,
      sender: company,
      senderTitle: exec.name + ', ' + exec.title,
      subject: `Slate Financing Opportunity`,
      body: `Dear ${studio.name} Team,

We would like to discuss slate financing for your upcoming productions. ${company} is prepared to invest ${formatMoney(dealAmount)} across your next ${filmsCount} films in exchange for ${profitSharePercent}% of theatrical profits.

${company} has been impressed by your recent work and believes there is strong potential for collaboration. Our track record speaks for itself, and we are confident that a partnership would be mutually beneficial.

Please let us know if you would be interested in discussing this further.

Best regards,
${exec.name}
${exec.title}
${company}`,
      type: 'slate-financing',
      sentWeek: currentWeek,
      sentYear: currentYear,
      expiresWeek,
      expiresYear,
      hasAction: true,
      actionLabel: 'Accept Financing',
      actionData: {
        company,
        dealType: 'slate-financing',
        offerAmount: dealAmount,
        profitSharePercent,
        filmsCount,
      },
      isRead: false,
      isArchived: false,
    };
  } else {
    // Co-production deal - one-time payment for distribution rights
    return {
      playerGameId,
      sender: company,
      senderTitle: exec.name + ', ' + exec.title,
      subject: `Co-Production Partnership Opportunity`,
      body: `Dear ${studio.name} Team,

We are seeking a co-production partner for an upcoming tentpole project. ${company} would contribute ${formatMoney(dealAmount)} to the production budget in exchange for international distribution rights.

${company} has been impressed by your recent work and believes there is strong potential for collaboration. Our track record speaks for itself, and we are confident that a partnership would be mutually beneficial.

Please let us know if you would be interested in discussing this further.

Best regards,
${exec.name}
${exec.title}
${company}`,
      type: 'production_deal',
      sentWeek: currentWeek,
      sentYear: currentYear,
      expiresWeek,
      expiresYear,
      hasAction: true,
      actionLabel: 'Accept Deal',
      actionData: {
        company,
        dealType: 'co-production',
        offerAmount: dealAmount,
      },
      isRead: false,
      isArchived: false,
    };
  }
}

async function generateFirstLookDealEmail(
  studio: Studio,
  playerGameId: string,
  currentWeek: number,
  currentYear: number
): Promise<InsertEmail | null> {
  // 4% chance per week to receive a first look deal from talent
  if (Math.random() > 0.04) return null;
  
  // Get available writers and directors (not currently busy)
  const allTalent = await storage.getAllTalent();
  const availableTalent = allTalent.filter(t => 
    (t.type === 'writer' || t.type === 'director') && 
    !t.currentFilmId &&
    t.isActive
  );
  
  if (availableTalent.length === 0) return null;
  
  // Pick a random talent
  const talent = availableTalent[Math.floor(Math.random() * availableTalent.length)];
  
  // Determine their best genre based on skills
  const genreSkills: Record<string, number> = {
    action: talent.skillAction,
    drama: talent.skillDrama,
    comedy: talent.skillComedy,
    thriller: talent.skillThriller,
    horror: talent.skillHorror,
    scifi: talent.skillScifi,
    animation: talent.skillAnimation,
    romance: talent.skillRomance,
  };
  
  // Sort genres by skill and pick the best one
  const sortedGenres = Object.entries(genreSkills).sort((a, b) => b[1] - a[1]);
  const bestGenre = sortedGenres[0][0];
  
  // Generate film title from the filmTitles list
  const titleList = filmTitles[bestGenre as keyof typeof filmTitles] || filmTitles.drama;
  const title = titleList[Math.floor(Math.random() * titleList.length)];
  
  // Generate synopsis using the elements
  const elements = genreStoryElements[bestGenre] || genreStoryElements.drama;
  const stakes = elements.stakes[Math.floor(Math.random() * elements.stakes.length)];
  const antagonist = elements.antagonists[Math.floor(Math.random() * elements.antagonists.length)];
  const role = elements.roles[Math.floor(Math.random() * elements.roles.length)];
  const synopsis = generateFilmDescription(bestGenre, title, role, talent.name, [talent.name], antagonist, role, stakes);
  
  // Generate suggested budget based on genre and talent fame
  const baseBudget = bestGenre === 'action' || bestGenre === 'scifi' ? 80000000 : 
                     bestGenre === 'horror' ? 25000000 : 50000000;
  const fameMultiplier = 1 + (talent.fame / 100) * 0.5;
  const suggestedBudget = Math.round(baseBudget * fameMultiplier);
  
  // Development durations based on genre
  const devWeeks = 4;
  const preWeeks = bestGenre === 'action' || bestGenre === 'scifi' ? 8 : 6;
  const prodWeeks = bestGenre === 'action' || bestGenre === 'scifi' ? 16 : 12;
  const postWeeks = bestGenre === 'scifi' || bestGenre === 'animation' ? 8 : 6;
  
  // Script quality based on talent skill
  const scriptQuality = Math.round(50 + (talent.performance / 2) + Math.random() * 20);
  
  // Calculate expiration (6 weeks from now)
  let expiresWeek = currentWeek + 6;
  let expiresYear = currentYear;
  if (expiresWeek > 52) {
    expiresWeek = expiresWeek - 52;
    expiresYear += 1;
  }
  
  const talentRole = talent.type === 'writer' ? 'Writer' : 'Director';
  
  return {
    playerGameId,
    sender: talent.name,
    senderTitle: talentRole,
    subject: `First-Look: "${title}" - ${bestGenre.charAt(0).toUpperCase() + bestGenre.slice(1)} Project`,
    body: `Dear ${studio.name},

I've been developing a passion project that I believe would be a perfect fit for your studio.

PROJECT: "${title}"
GENRE: ${bestGenre.charAt(0).toUpperCase() + bestGenre.slice(1)}
${talent.type === 'writer' ? 'WRITER' : 'DIRECTOR'}: ${talent.name}
SUGGESTED BUDGET: ${formatMoney(suggestedBudget)}

LOGLINE:
${synopsis}

I've spent months developing this concept and am ready to bring it to production. The script is in excellent shape with a quality assessment of ${scriptQuality}/100.

TIMELINE ESTIMATE:
- Development: ${devWeeks} weeks
- Pre-Production: ${preWeeks} weeks  
- Production: ${prodWeeks} weeks
- Post-Production: ${postWeeks} weeks

I'm offering your studio first-look rights on this project. If you're interested in producing "${title}", I'm prepared to commit exclusively to your studio for this film.

This offer expires in 6 weeks.

Looking forward to your decision.

Best regards,
${talent.name}`,
    type: 'production_deal',
    sentWeek: currentWeek,
    sentYear: currentYear,
    expiresWeek,
    expiresYear,
    hasAction: true,
    actionLabel: 'Greenlight Project',
    actionData: {
      dealType: 'first-look',
      isFirstLookDeal: true,
      talentId: talent.id,
      talentName: talent.name,
      talentType: talent.type,
      filmTitle: title,
      filmGenre: bestGenre,
      filmSynopsis: synopsis,
      suggestedBudget,
      scriptQuality,
      devWeeks,
      preWeeks,
      prodWeeks,
      postWeeks,
    },
    isRead: false,
    isArchived: false,
  };
}

// Generate streaming production deal offers (direct-to-streaming films with deadlines)
async function generateStreamingProductionDealEmail(
  studio: Studio,
  playerGameId: string,
  currentWeek: number,
  currentYear: number
): Promise<InsertEmail | null> {
  // 3% chance per week to receive a streaming production deal
  if (Math.random() > 0.03) return null;
  
  // Pick a random streaming service
  const service = streamingServiceData[Math.floor(Math.random() * streamingServiceData.length)];
  const exec = streamingExecs[Math.floor(Math.random() * streamingExecs.length)];
  
  // Generate budget based on studio prestige (bigger studios get bigger offers)
  const prestigeLevel = studio.prestigeLevel || 1;
  const baseBudget = 30000000 + Math.random() * 50000000;
  const prestigeBonus = prestigeLevel * 15000000;
  const productionBudget = Math.round(baseBudget + prestigeBonus);
  
  // Deadline is 40-60 weeks from now
  const deadlineWeeks = 40 + Math.floor(Math.random() * 20);
  let deadlineWeek = currentWeek + deadlineWeeks;
  let deadlineYear = currentYear;
  while (deadlineWeek > 52) {
    deadlineWeek -= 52;
    deadlineYear += 1;
  }
  
  // Calculate expiration for offer (6 weeks from now)
  let expiresWeek = currentWeek + 6;
  let expiresYear = currentYear;
  if (expiresWeek > 52) {
    expiresWeek -= 52;
    expiresYear += 1;
  }
  
  // Pick a genre the streaming service prefers
  const preferredGenres = service.genrePreferences || ['drama', 'thriller', 'comedy'];
  const targetGenre = preferredGenres[Math.floor(Math.random() * preferredGenres.length)];
  
  return {
    playerGameId,
    sender: service.name,
    senderTitle: exec.name + ', ' + exec.title,
    subject: `Exclusive Production Deal Opportunity - ${service.name}`,
    body: `Dear ${studio.name} Team,

${service.name} is expanding our original content library and we're interested in partnering with your studio on an exclusive direct-to-streaming production.

We're prepared to fully finance a ${targetGenre} film with a production budget of ${formatMoney(productionBudget)}. In return, the film would premiere exclusively on ${service.name}.

DEAL TERMS:
- Full Production Budget: ${formatMoney(productionBudget)}
- Genre: ${targetGenre.charAt(0).toUpperCase() + targetGenre.slice(1)}
- Delivery Deadline: Week ${deadlineWeek}, Year ${deadlineYear}
- Distribution: ${service.name} Exclusive (worldwide streaming rights)
- Bonus Pool: Up to ${formatMoney(Math.round(productionBudget * 0.25))} for performance milestones

With ${service.subscriberCount}M subscribers, your film would have immediate global reach. Our data shows strong audience demand for quality ${targetGenre} content.

This offer requires a response within 6 weeks. We're excited about the possibility of working together.

Best regards,
${exec.name}
${exec.title}
${service.name} Original Content`,
    type: 'production_deal',
    sentWeek: currentWeek,
    sentYear: currentYear,
    expiresWeek,
    expiresYear,
    hasAction: true,
    actionLabel: 'Accept Deal',
    actionData: {
      streamingServiceId: service.id,
      streamingService: service.name,
      offerAmount: productionBudget,
      targetGenre,
      isStreamingProductionDeal: true,
      deadlineWeek,
      deadlineYear,
    },
    isRead: false,
    isArchived: false,
  };
}

// Process AI studios licensing their films to streaming services
async function processAIStreamingAcquisitions(
  playerGameId: string,
  currentWeek: number,
  currentYear: number
): Promise<void> {
  let dealsCreated = 0;
  let filmsProcessed = 0;
  let filmsSkipped = 0;
  
  try {
    // Get all AI studios for this player's game
    const allStudios = await storage.getAllStudios();
    const aiStudios = allStudios.filter(s => s.isAI && s.playerGameId === playerGameId);
    
    for (const aiStudio of aiStudios) {
      // Get AI studio's released films
      const aiFilms = await storage.getFilmsByStudio(aiStudio.id);
      const releasedFilms = aiFilms.filter(f => f.phase === 'released');
      
      for (const film of releasedFilms) {
        filmsProcessed++;
        
        // Check if film already has a streaming deal
        const existingDeals = await storage.getStreamingDealsByFilm(film.id);
        if (existingDeals.length > 0) {
          continue;
        }
        
        // Films that have been released 8+ weeks are eligible for AI licensing
        const weeksInRelease = film.weeklyBoxOffice?.length || 0;
        if (weeksInRelease < 8) {
          filmsSkipped++;
          continue;
        }
        
        // INCREASED CHANCE: Base 50% for films 8-16 weeks, +8% for every 8 weeks after (max 90%)
        // This ensures most eligible films get licensed within a reasonable timeframe
        const bonusChance = Math.min(0.40, Math.floor((weeksInRelease - 8) / 8) * 0.08);
        const licenseChance = 0.50 + bonusChance;
        
        const roll = Math.random();
        if (roll > licenseChance) {
          continue;
        }
        
        // Pick a streaming service that matches the genre (genrePreferences is an object, not array)
        const matchingServices = streamingServiceData.filter(s => {
          const genreWeight = s.genrePreferences?.[film.genre as keyof typeof s.genrePreferences];
          return (genreWeight && genreWeight >= 0.7) || Math.random() > 0.3;
        });
        if (matchingServices.length === 0) continue;
        
        const service = matchingServices[Math.floor(Math.random() * matchingServices.length)];
        
        // Calculate license fee for AI film
        const totalBoxOffice = film.totalBoxOffice || 0;
        const qualityScore = (film.audienceScore || 7) * 10;
        const baseFee = totalBoxOffice * 0.12;
        const qualityBonus = baseFee * (qualityScore / 100) * 0.25;
        const licenseFee = Math.round((baseFee + qualityBonus) * (0.7 + Math.random() * 0.3));
        
        try {
          // Create the streaming deal for AI studio
          await storage.createStreamingDeal({
            filmId: film.id,
            streamingServiceId: service.id,
            playerGameId: aiStudio.id,
            licenseFee,
            startWeek: currentWeek,
            startYear: currentYear,
            isActive: true,
          });
          
          // Add license fee to AI studio budget
          await storage.updateStudio(aiStudio.id, {
            budget: aiStudio.budget + licenseFee,
            totalEarnings: aiStudio.totalEarnings + licenseFee,
          });
          
          dealsCreated++;
        } catch (dealError) {
          console.error(`[AI-STREAMING] Failed to create deal for "${film.title}":`, dealError);
        }
      }
    }
    
    if (dealsCreated > 0) {
      // Streaming deals created
    }
  } catch (error) {
    console.error('[AI-STREAMING] Error in processAIStreamingAcquisitions:', error);
  }
}

// Update streaming deal view counts
async function processStreamingViews(
  playerGameId: string,
  currentWeek: number,
  currentYear: number
): Promise<void> {
  // Get all active streaming deals for player and AI studios
  const allStudios = await storage.getAllStudios();
  const relevantStudios = allStudios.filter(s => s.id === playerGameId || s.playerGameId === playerGameId);
  
  for (const studio of relevantStudios) {
    const deals = await storage.getStreamingDealsByPlayer(studio.id);
    const activeDeals = deals.filter(d => d.isActive);
    
    for (const deal of activeDeals) {
      const film = await storage.getFilm(deal.filmId || '');
      if (!film) continue;
      
      // Get the streaming service for subscriber count
      const service = streamingServiceData.find(s => s.id === deal.streamingServiceId);
      if (!service) continue;
      
      // Calculate weekly views based on film quality and time on platform
      const weeksActive = deal.weeksActive || 0;
      const qualityScore = ((film.audienceScore || 7) * 10 + (film.criticScore || 70)) / 2;
      
      // Base views from subscriber percentage (0.5% - 3% of subscribers watch per week)
      const subscriberBase = service.subscriberCount * 1000000; // Convert to actual numbers
      const watchRate = 0.005 + (qualityScore / 100) * 0.025;
      
      // Views decay over time (peak in first 4 weeks, then gradual decline)
      let decayMultiplier = 1;
      if (weeksActive <= 4) {
        decayMultiplier = 1 + (4 - weeksActive) * 0.2; // Boost for first 4 weeks
      } else {
        decayMultiplier = Math.max(0.1, 1 - (weeksActive - 4) * 0.08); // Gradual decay after
      }
      
      const weeklyViews = Math.round(subscriberBase * watchRate * decayMultiplier * (0.7 + Math.random() * 0.6));
      
      // Calculate weekly revenue (small per-view payment)
      const revenuePerView = 0.02 + Math.random() * 0.03; // $0.02-0.05 per view
      const weeklyRevenue = Math.round(weeklyViews * revenuePerView);
      
      // Update the deal with new view counts
      const existingViews = deal.weeklyViews || [];
      const newViews = [...existingViews, weeklyViews];
      const totalViews = (deal.totalViews || 0) + weeklyViews;
      const totalRevenue = (deal.totalRevenue || 0) + weeklyRevenue;
      const newWeeksActive = weeksActive + 1;
      
      // Check if deal should end (after 2 years / 104 weeks default)
      const licenseYears = deal.licenseYears || 2;
      const maxWeeks = licenseYears * 52;
      const isExpired = newWeeksActive >= maxWeeks;
      
      await storage.updateStreamingDeal(deal.id, {
        weeklyViews: newViews,
        totalViews,
        weeklyRevenue,
        totalRevenue,
        weeksActive: newWeeksActive,
        isActive: !isExpired,
      });
      
      // Add streaming revenue to studio budget
      if (!studio.isAI) {
        await storage.updateStudio(studio.id, {
          budget: studio.budget + weeklyRevenue,
          totalEarnings: studio.totalEarnings + weeklyRevenue,
        });
      }
      
      // Send renewal email when deal expires (only for player studio)
      if (isExpired && !studio.isAI) {
        const renewalEmail = await generateStreamingRenewalEmail(
          { ...deal, totalViews }, // Use updated totalViews
          film,
          service,
          studio.id,
          currentWeek,
          currentYear
        );
        if (renewalEmail) {
          await storage.createEmail(renewalEmail);
        }
      }
    }
  }
  
  // Process TV Show streaming views for AI studios (scoped to this player's game)
  try {
    const allTVDeals = await storage.getAllTVDeals();
    // Filter to only active deals that belong to this player's game
    const activeTVDeals = allTVDeals.filter(d => d.isActive && d.playerGameId === playerGameId);
    
    for (const tvDeal of activeTVDeals) {
      const tvShow = await storage.getTVShow(tvDeal.tvShowId);
      if (!tvShow || tvShow.phase !== 'airing') continue;
      
      // Only process AI studio TV shows (player shows have their own pathway)
      const tvStudio = await storage.getStudio(tvShow.studioId);
      if (!tvStudio || !tvStudio.isAI) continue;
      
      const service = streamingServiceData.find(s => s.id === tvDeal.streamingServiceId);
      if (!service) continue;
      
      // Calculate weekly views for TV shows (higher base than movies due to episodic nature)
      const weeksStreaming = tvShow.weeksStreaming || 0;
      const qualityScore = ((tvShow.audienceScore || 7) * 10 + (tvShow.criticScore || 70)) / 2;
      const episodesPerSeason = tvShow.episodesPerSeason || 10;
      
      // TV shows get more views due to multiple episodes
      const subscriberBase = service.subscriberCount * 1000000;
      const watchRate = 0.008 + (qualityScore / 100) * 0.035; // Higher base rate for TV
      
      // Views decay slower for TV shows
      let decayMultiplier = 1;
      if (weeksStreaming <= 8) {
        decayMultiplier = 1 + (8 - weeksStreaming) * 0.15;
      } else {
        decayMultiplier = Math.max(0.15, 1 - (weeksStreaming - 8) * 0.05);
      }
      
      // Episode multiplier (more episodes = more viewing minutes)
      const episodeMultiplier = 1 + (episodesPerSeason / 10) * 0.5;
      
      const weeklyViews = Math.round(subscriberBase * watchRate * decayMultiplier * episodeMultiplier * (0.7 + Math.random() * 0.6));
      
      // Calculate weekly revenue (small per-view payment, same as movies)
      const revenuePerView = 0.02 + Math.random() * 0.03;
      const weeklyRevenue = Math.round(weeklyViews * revenuePerView);
      
      // Update TV show with new views
      const existingShowViews = tvShow.weeklyViews || [];
      const newShowViews = [...existingShowViews, weeklyViews];
      const newShowTotalViews = (tvShow.totalViews || 0) + weeklyViews;
      const newWeeksStreaming = weeksStreaming + 1;
      const newShowTotalRevenue = (tvShow.totalRevenue || 0) + weeklyRevenue;
      
      await storage.updateTVShow(tvShow.id, {
        weeklyViews: newShowViews,
        totalViews: newShowTotalViews,
        weeksStreaming: newWeeksStreaming,
        totalRevenue: newShowTotalRevenue,
      });
      
      // Also update the TV deal record to track views/revenue (for API consistency)
      const existingDealViews = (tvDeal as any).weeklyViews || [];
      const newDealViews = [...existingDealViews, weeklyViews];
      const newDealTotalViews = ((tvDeal as any).totalViews || 0) + weeklyViews;
      const newDealTotalRevenue = ((tvDeal as any).totalRevenue || tvDeal.totalValue || 0) + weeklyRevenue;
      const newWeeksActive = ((tvDeal as any).weeksActive || 0) + 1;
      
      await storage.updateTVDeal(tvDeal.id, {
        weeklyViews: newDealViews,
        totalViews: newDealTotalViews,
        totalRevenue: newDealTotalRevenue,
        weeklyRevenue,
        weeksActive: newWeeksActive,
      });
    }
  } catch (tvError) {
    console.error('[STREAMING-VIEWS] TV show view processing error:', tvError);
  }
}

// Ongoing AI TV Show creation during regular gameplay (not just preload)
async function processAITVShowCreation(
  playerGameId: string,
  currentWeek: number,
  currentYear: number
): Promise<void> {
  const allStudios = await storage.getAllStudios();
  const aiStudios = allStudios.filter(s => s.isAI && s.playerGameId === playerGameId);
  
  for (const aiStudio of aiStudios) {
    // 8% chance per AI studio per week to create a new TV show (lower than preload)
    if (Math.random() >= 0.08 || aiStudio.budget < 50000000) continue;
    
    const tvGenre = TV_SHOW_GENRES[Math.floor(Math.random() * TV_SHOW_GENRES.length)];
    const titleList = tvShowTitles[tvGenre] || tvShowTitles['drama'];
    const tvTitle = titleList[Math.floor(Math.random() * titleList.length)];
    
    // Check if this show already exists for this studio
    const existingShows = await storage.getTVShowsByStudio(aiStudio.id);
    const titleExists = existingShows.some(s => s.title === tvTitle);
    
    // Also limit total shows per studio to 5
    if (titleExists || existingShows.length >= 5) continue;
    
    // Episode budget based on genre
    let episodeBudget = 5000000;
    if (tvGenre === 'action' || tvGenre === 'scifi' || tvGenre === 'fantasy') {
      episodeBudget = 10000000 + Math.floor(Math.random() * 5000000);
    } else if (tvGenre === 'animation') {
      episodeBudget = 3000000 + Math.floor(Math.random() * 2000000);
    } else if (tvGenre === 'drama' || tvGenre === 'thriller') {
      episodeBudget = 6000000 + Math.floor(Math.random() * 4000000);
    } else {
      episodeBudget = 4000000 + Math.floor(Math.random() * 3000000);
    }
    
    const episodesPerSeason = tvGenre === 'animation' ? 10 : (8 + Math.floor(Math.random() * 5));
    
    // Pick a streaming service for this AI show
    const services = await storage.getAllStreamingServices();
    const targetService = services[Math.floor(Math.random() * services.length)];
    
    try {
      const newTVShow = await storage.createTVShow({
        studioId: aiStudio.id,
        title: tvTitle,
        genre: tvGenre,
        showType: tvGenre === 'comedy' ? 'sitcom' : 'drama',
        synopsis: `A compelling ${tvGenre} series from ${aiStudio.name}.`,
        episodeBudget,
        episodesPerSeason,
        isStreamingExclusive: true,
        streamingServiceId: targetService.id,
        releaseStrategy: Math.random() > 0.5 ? 'binge' : 'weekly',
        phase: 'airing', // AI shows start ready to air
        currentSeason: 1,
        renewalStatus: 'renewed',
        createdAtWeek: currentWeek,
        createdAtYear: currentYear,
        overallQuality: 50 + Math.floor(Math.random() * 40), // 50-90 quality
        weeksStreaming: 0, // Initialize properly
        weeklyViews: [], // Initialize empty array
        totalViews: 0,
        totalRevenue: 0,
      });
      
      // Create TV deal for the AI show
      const seasonBudget = episodeBudget * episodesPerSeason;
      const licenseFee = Math.floor(seasonBudget * (0.8 + Math.random() * 0.4));
      
      await storage.createTVDeal({
        tvShowId: newTVShow.id,
        playerGameId: playerGameId,
        dealType: 'streaming',
        streamingServiceId: targetService.id,
        licenseFee,
        totalValue: licenseFee,
        startWeek: currentWeek,
        startYear: currentYear,
        seasonsCommitted: 1 + Math.floor(Math.random() * 3),
        isActive: true,
        isExclusive: true,
        weeklyViews: [], // Initialize empty array
        totalViews: 0,
        weeklyRevenue: 0,
        totalRevenue: 0,
        weeksActive: 0,
      });
      
      // Deduct budget from AI studio
      await storage.updateStudio(aiStudio.id, {
        budget: aiStudio.budget - seasonBudget,
      });
      
    } catch (createError) {
    }
  }
}

// Main function to generate all emails for a week
async function generateWeeklyEmails(
  playerGameId: string,
  studio: Studio,
  films: Film[],
  currentWeek: number,
  currentYear: number
): Promise<void> {
  const playerFilms = films.filter(f => f.studioId === playerGameId);
  
  // Generate streaming offers for released films
  for (const film of playerFilms) {
    const email = await generateStreamingOfferEmail(film, playerGameId, currentWeek, currentYear);
    if (email) {
      await storage.createEmail(email);
    }
  }
  
  // Generate production deals (from production companies)
  const prodDealEmail = await generateProductionDealEmail(studio, playerGameId, currentWeek, currentYear);
  if (prodDealEmail) {
    await storage.createEmail(prodDealEmail);
  }
  
  // Generate first-look deals (from writers/directors with film pitches)
  const firstLookEmail = await generateFirstLookDealEmail(studio, playerGameId, currentWeek, currentYear);
  if (firstLookEmail) {
    await storage.createEmail(firstLookEmail);
  }
  
  // Generate streaming production deals (direct-to-streaming offers)
  const streamingProdDealEmail = await generateStreamingProductionDealEmail(studio, playerGameId, currentWeek, currentYear);
  if (streamingProdDealEmail) {
    await storage.createEmail(streamingProdDealEmail);
  }
  
}

// Process award show nominations and ceremonies
async function processAwardCeremonies(
  playerGameId: string,
  allFilms: Film[],
  currentWeek: number,
  currentYear: number
): Promise<{ nominations: string[], winners: string[] }> {
  const result = { nominations: [] as string[], winners: [] as string[] };
  
  console.log(`[Awards] Processing for playerGameId=${playerGameId}, week=${currentWeek}, year=${currentYear}, totalFilms=${allFilms.length}`);
  
  // Ensure award shows are seeded
  await storage.seedAwardShows();
  const awardShows = await storage.getAllAwardShows();
  
  console.log(`[Awards] Found ${awardShows.length} award shows`);
  
  // Get films released in the past year that are eligible for awards
  // Awards season typically honors films released the previous year
  // FIXED: Include films from current year AND previous year for award eligibility
  const eligibleFilms = allFilms.filter(f => {
    if (f.phase !== 'released') return false;
    if (!f.releaseYear) return false;
    // Films released in the previous calendar year OR current year are eligible
    const releaseYear = f.releaseYear;
    return releaseYear === currentYear - 1 || releaseYear === currentYear;
  });
  
  console.log(`[Awards] Eligible films: ${eligibleFilms.length} (released films from ${currentYear-1} or ${currentYear})`);
  
  for (const show of awardShows) {
    console.log(`[Awards] Processing ${show.name}: nominationsWeek=${show.nominationsWeek}, ceremonyWeek=${show.ceremonyWeek}`);
    
    // Check if it's nominations week for this show (or if we've passed it and need to catch up)
    // For shows with nominations in late year (week > 40) and ceremony in early year (week < 20):
    // - If we're in late year (week >= nominationsWeek), nominations are for NEXT year's ceremony
    // - If we're in early year (week < 20), nominations were already announced last year for THIS year's ceremony
    const nominationsWeekPassed = currentWeek >= show.nominationsWeek || 
      (show.nominationsWeek > 40 && currentWeek < 20); // Handle year wrap (e.g., nominations week 50, current week 11)
    
    if (nominationsWeekPassed) {
      // Calculate ceremony year correctly:
      // - If ceremony is in early year and nominations in late year (cross-year show like Golden Globes)
      //   - If we're in late year (past nominations week), ceremony is NEXT year
      //   - If we're in early year (before ceremony week), ceremony is THIS year
      // - Otherwise, ceremony is same year as nominations
      let ceremonyYear = currentYear;
      if (show.ceremonyWeek < show.nominationsWeek) {
        // Cross-year show (nominations in Dec, ceremony in Jan)
        if (currentWeek >= show.nominationsWeek) {
          // We're in late year, past nominations week - ceremony is next year
          ceremonyYear = currentYear + 1;
        } else if (currentWeek < 20) {
          // We're in early year (before week 20) - ceremony is this year (nominations were last year)
          ceremonyYear = currentYear;
        } else {
          // We're in mid-year - no ceremony processing needed for cross-year shows
          // Skip this show for now
          continue;
        }
      }
      
      console.log(`[Awards] ${show.name}: nominationsWeek=${show.nominationsWeek}, ceremonyWeek=${show.ceremonyWeek}, currentWeek=${currentWeek}, ceremonyYear=${ceremonyYear}`);
      
      // Check if ceremony already exists
      let ceremony = await storage.getCeremonyByShowAndYear(playerGameId, show.id, ceremonyYear);
      if (!ceremony) {
        console.log(`[Awards] ${show.name}: Creating new ceremony for year ${ceremonyYear}`);
        ceremony = await storage.createAwardCeremony({
          playerGameId,
          awardShowId: show.id,
          ceremonyYear,
          nominationsAnnounced: false,
          ceremonyComplete: false,
          winnersAnnounced: false,
        });
      } else {
        console.log(`[Awards] ${show.name}: Ceremony exists - nominationsAnnounced=${ceremony.nominationsAnnounced}, ceremonyComplete=${ceremony.ceremonyComplete}`);
      }
      
      // Generate nominations if not already announced
      if (!ceremony.nominationsAnnounced) {
        console.log(`[Awards] ${show.name}: Generating nominations (ceremony not yet announced)`);
        const categories = await storage.getCategoriesByShow(show.id);
        console.log(`[Awards] ${show.name}: Found ${categories.length} categories`);
        
        for (const category of categories) {
          try {
            // Filter eligible films for this category
          let categoryFilms = [...eligibleFilms];
          
          // Filter by genre if required
          if (category.requiresGenre) {
            categoryFilms = categoryFilms.filter(f => f.genre === category.requiresGenre);
          }
          
          // International film categories require films NOT released in North America
          if (category.isInternational) {
            const internationalFilms: typeof categoryFilms = [];
            for (const film of categoryFilms) {
              const filmReleases = await storage.getFilmReleasesByFilm(film.id);
              // Check if film has NO North America release
              const hasNARelease = filmReleases.some((r: { territoryCode: string }) => r.territoryCode === 'NA');
              if (!hasNARelease) {
                internationalFilms.push(film);
              }
            }
            categoryFilms = internationalFilms;
          }
          
          // Skip if no films for this category
          if (categoryFilms.length === 0) continue;
          
          // Score films based on category-specific criteria
          const scoredFilmsPromises = categoryFilms.map(async (film) => {
            let score = 0;
            const criticScore = film.criticScore || 0;
            const categoryName = category.name.toLowerCase();
            const categoryType = category.categoryType;
            
            // Base critic score for ALL categories
            score += criticScore * 2;
            
            // Animation is ONLY eligible for Score and Animated Feature categories
            const isScoreCategory = categoryName.includes('score') || categoryName.includes('music');
            const isAnimatedCategory = categoryName.includes('animation') || categoryName.includes('animated');
            if (film.genre === 'animation' && !isScoreCategory && !isAnimatedCategory) {
              score = -1000; // Exclude animated films from all other categories
            }
            
            // Drama genre boost for most categories (except animation/VFX specific)
            if (film.genre === 'drama' && !isAnimatedCategory && !categoryName.includes('vfx') && !categoryName.includes('visual effects')) {
              score += 15;
            }
            
            // Category-specific scoring
            if (categoryName.includes('picture') || categoryName.includes('film')) {
              // Best Picture/Film - exclude animation (already handled above), favor dramas
              // Golden Globes drama category - only drama films
              if (categoryType === 'film_drama') {
                if (film.genre !== 'drama') score = -1000;
              }
              // Golden Globes comedy/musical category - comedy, horror, thriller, musicals, animation
              if (categoryType === 'film_comedy') {
                const comedyGenres = ['comedy', 'horror', 'thriller', 'musicals', 'animation'];
                if (!comedyGenres.includes(film.genre)) score = -1000;
              }
            }
            
            if (categoryName.includes('director') || categoryName.includes('cinematography') || categoryName.includes('editing')) {
              // Director, Cinematography, Editing - based on director score
              if (film.directorId) {
                const director = await storage.getTalent(film.directorId);
                if (director) {
                  score += (director.performance || 50) * 0.5;
                  score += (director.experience || 50) * 0.3;
                }
              }
            }
            
            if (categoryName.includes('screenplay') || categoryName.includes('writing')) {
              // Screenplay - writer score + drama boost + random
              if (film.writerId) {
                const writer = await storage.getTalent(film.writerId);
                if (writer) {
                  score += (writer.performance || 50) * 0.5;
                  score += (writer.experience || 50) * 0.3;
                }
              }
              score += Math.random() * 15;
            }
            
            if (categoryName.includes('score') || categoryName.includes('music')) {
              // Original Score - composer score + random factor
              // Animation IS eligible for score awards
              if (film.composerId) {
                const composer = await storage.getTalent(film.composerId);
                if (composer) {
                  score += (composer.performance || 50) * 0.8;
                  score += (composer.experience || 50) * 0.4;
                }
              }
              score += Math.random() * 25;
            }
            
            if (categoryName.includes('production design') || categoryName.includes('prod. design')) {
              // Production Design - sets budget + drama/fantasy boost
              score += Math.min(30, (film.setsBudget || 0) / 1000000);
              if (film.genre === 'fantasy') score += 10;
            }
            
            if (categoryName.includes('costume')) {
              // Costume Design - costume budget + drama/fantasy boost
              score += Math.min(30, (film.costumesBudget || 0) / 500000);
              if (film.genre === 'fantasy') score += 10;
            }
            
            if (categoryName.includes('makeup') || categoryName.includes('hair')) {
              // Makeup - makeup budget + horror/fantasy boost
              score += Math.min(30, (film.makeupBudget || 0) / 300000);
              if (film.genre === 'horror' || film.genre === 'fantasy') score += 15;
            }
            
            if (categoryName.includes('vfx') || categoryName.includes('visual effects')) {
              // VFX - practical effects budget + scifi/fantasy/action boost
              score += Math.min(40, (film.practicalEffectsBudget || 0) / 2000000);
              if (['scifi', 'fantasy', 'action'].includes(film.genre)) score += 10;
            }
            
            if (categoryType === 'box_office' || categoryName.includes('box office')) {
              // Box Office Achievement - based on box office + audience score
              // Override the base critic score for this category
              score = 0; // Reset score
              score += Math.min(100, (film.totalBoxOffice || 0) / 10000000); // Box office (up to 100 points for $1B+)
              score += ((film.audienceScore || 7) * 10) * 2; // Audience score matters a lot (up to 200 points)
              score += Math.random() * 20; // Small random factor
            }
            
            // For non-acting categories, cast performance still matters for film quality
            // (Acting categories now use individual actor scoring handled separately below)
            const isActingCat = categoryType === 'acting' || categoryType === 'acting_drama' || categoryType === 'acting_comedy' || 
                categoryName.includes('actor') || categoryName.includes('actress');
            if (!isActingCat && film.castIds && film.castIds.length > 0) {
              let totalCastPerformance = 0;
              let castCount = 0;
              for (const castId of film.castIds) {
                const actor = await storage.getTalent(castId);
                if (actor && actor.type === 'actor') {
                  totalCastPerformance += actor.performance || 50;
                  castCount++;
                }
              }
              if (castCount > 0) {
                const avgCastPerformance = totalCastPerformance / castCount;
                // Moderate boost for high-performing cast in non-acting categories (up to +25 points)
                score += (avgCastPerformance - 50) * 0.5;
              }
            }
            
            // Check if film has awards campaign
            if (film.awards?.includes('Awards Campaign')) {
              score += 20;
            }
            
            // Random factor to add variety (reduced to make performance more important)
            score += Math.random() * 15;
            
            return { film, score };
          });
          
          const scoredFilms = await Promise.all(scoredFilmsPromises);
          
          // Sort by score
          scoredFilms.sort((a, b) => b.score - a.score);
          
          // For acting categories, we need to check eligibility before nominating
          const categoryName = category.name.toLowerCase();
          const isActingCategory = category.isPerformance && (category.categoryType === 'acting' || category.categoryType === 'acting_drama' || category.categoryType === 'acting_comedy');
          const isEnsembleCategory = categoryName.includes('ensemble') || categoryName.includes('cast');
          
          // For acting categories (except ensemble/cast awards), score INDIVIDUAL ACTORS across all films
          // This ensures the best performers get nominated, not just actors from the best films
          if (isActingCategory && !isEnsembleCategory) {
            const requiresMale = categoryName.includes('actor') && !categoryName.includes('actress');
            const requiresFemale = categoryName.includes('actress');
            const isSupportingCategory = categoryName.includes('supporting') || categoryName.includes('supp.');
            const isLeadCategory = !isSupportingCategory;
            
            // Collect ALL eligible actors from ALL eligible films with their individual scores
            const allEligibleActors: Array<{
              actorId: string;
              filmId: string;
              performance: number;
              filmCriticScore: number;
              filmAudienceScore: number;
              totalScore: number;
            }> = [];
            
            for (const { film } of scoredFilms) {
              if (film.genre === 'animation') continue; // Skip animation for acting categories
              
              const filmRoles = await storage.getFilmRolesByFilm(film.id);
              
              for (const role of filmRoles) {
                if (!role.actorId || !role.isCast) continue;
                
                // Check role importance matches category type
                const roleImportance = role.importance || 'supporting';
                if (isLeadCategory && roleImportance !== 'lead') continue;
                if (isSupportingCategory && roleImportance !== 'supporting') continue;
                
                const talent = await storage.getTalent(role.actorId);
                if (!talent || talent.type !== 'actor') continue;
                
                // Check gender matches category
                if (requiresMale && talent.gender !== 'male') continue;
                if (requiresFemale && talent.gender !== 'female') continue;
                
                const performance = talent.performance || 50;
                const filmCriticScore = film.criticScore || 0;
                const filmAudienceScore = film.audienceScore || 0;
                
                // INDIVIDUAL ACTOR SCORING:
                // - Performance is the PRIMARY factor (50% weight)
                // - Film critic score matters (30% weight) - great performances in great films
                // - Film audience score matters slightly (10% weight)
                // - Small random factor (10% weight)
                const totalScore = 
                  (performance * 2.0) +           // Performance: 0-200 points (50% of max)
                  (filmCriticScore * 1.2) +       // Film critics: 0-120 points (30% of max)
                  (filmAudienceScore * 4) +       // Film audience: 0-40 points (10% of max)
                  (Math.random() * 40);           // Random: 0-40 points (10% of max)
                
                allEligibleActors.push({
                  actorId: role.actorId,
                  filmId: film.id,
                  performance,
                  filmCriticScore,
                  filmAudienceScore,
                  totalScore
                });
              }
              
              // Fallback to castIds if no roles found
              if (filmRoles.length === 0 && film.castIds && film.castIds.length > 0) {
                for (const castId of film.castIds) {
                  const talent = await storage.getTalent(castId);
                  if (!talent || talent.type !== 'actor') continue;
                  
                  if (requiresMale && talent.gender !== 'male') continue;
                  if (requiresFemale && talent.gender !== 'female') continue;
                  
                  const performance = talent.performance || 50;
                  const totalScore = 
                    (performance * 2.0) +
                    ((film.criticScore || 0) * 1.2) +
                    ((film.audienceScore || 0) * 4) +
                    (Math.random() * 40);
                  
                  allEligibleActors.push({
                    actorId: castId,
                    filmId: film.id,
                    performance,
                    filmCriticScore: film.criticScore || 0,
                    filmAudienceScore: film.audienceScore || 0,
                    totalScore
                  });
                }
              }
            }
            
            // Sort by total score (best performers first)
            allEligibleActors.sort((a, b) => b.totalScore - a.totalScore);
            
            // Nominate top 5 unique actors (no duplicates)
            const nominatedActorIds = new Set<string>();
            let nominationCount = 0;
            const maxNominations = 5;
            
            for (const actor of allEligibleActors) {
              if (nominationCount >= maxNominations) break;
              if (nominatedActorIds.has(actor.actorId)) continue; // Skip if already nominated
              
              await storage.createAwardNomination({
                playerGameId,
                awardShowId: show.id,
                categoryId: category.id,
                filmId: actor.filmId,
                talentId: actor.actorId,
                ceremonyYear,
                isWinner: false,
                announcedWeek: currentWeek,
                announcedYear: currentYear,
              });
              
              nominatedActorIds.add(actor.actorId);
              nominationCount++;
              console.log(`[Awards] ${show.shortName} ${category.name}: Nominated ${actor.actorId} (perf=${actor.performance}, filmCritic=${actor.filmCriticScore}, score=${Math.round(actor.totalScore)})`);
            }
          } else {
            // Non-acting categories (or ensemble/cast awards): use film-based scoring
            let nominationCount = 0;
            const maxNominations = 5;
            
            for (const nominee of scoredFilms) {
              if (nominationCount >= maxNominations) break;
              
              // Skip films with negative scores (excluded from category)
              if (nominee.score < 0) continue;
              
              await storage.createAwardNomination({
                playerGameId,
                awardShowId: show.id,
                categoryId: category.id,
                filmId: nominee.film.id,
                talentId: undefined,
                ceremonyYear,
                isWinner: false,
                announcedWeek: currentWeek,
                announcedYear: currentYear,
              });
              
              nominationCount++;
            }
          }
          } catch (categoryError) {
            console.error(`[Awards] Error processing category ${category.name}:`, categoryError);
          }
        }
        
        // Mark nominations as announced
        await storage.updateAwardCeremony(ceremony.id, { nominationsAnnounced: true });
        result.nominations.push(show.name);
      }
    }
    
    // Check if it's ceremony week for this show (or if we've passed it and need to catch up)
    const ceremonyWeekPassed = currentWeek >= show.ceremonyWeek || 
      (show.ceremonyWeek > 40 && currentWeek < 10); // Handle year wrap
    
    if (ceremonyWeekPassed) {
      // Determine ceremony year - if ceremony week is in early year but we're past it, it's this year
      // If ceremony week is late year and we're early year, it was last year
      let ceremonyYear = currentYear;
      if (show.ceremonyWeek > 40 && currentWeek < 10) {
        ceremonyYear = currentYear - 1; // Ceremony was last year
      }
      
      const ceremony = await storage.getCeremonyByShowAndYear(playerGameId, show.id, ceremonyYear);
      if (ceremony && ceremony.nominationsAnnounced && !ceremony.winnersAnnounced) {
        // Determine winners for each category
        const nominations = await storage.getNominationsByCeremony(playerGameId, show.id, ceremonyYear);
        
        // Group nominations by category
        const byCategory = new Map<string, typeof nominations>();
        for (const nom of nominations) {
          const existing = byCategory.get(nom.categoryId) || [];
          existing.push(nom);
          byCategory.set(nom.categoryId, existing);
        }
        
        // Pick a winner for each category
        for (const [categoryId, categoryNoms] of Array.from(byCategory.entries())) {
          if (categoryNoms.length === 0) continue;
          
          // Get category info to check if it's an acting category
          const category = await storage.getAwardCategory(categoryId);
          const categoryName = category?.name.toLowerCase() || '';
          const isActingCategory = category?.isPerformance && 
            (category.categoryType === 'acting' || category.categoryType === 'acting_drama' || category.categoryType === 'acting_comedy');
          const isEnsembleCategory = categoryName.includes('ensemble') || categoryName.includes('cast');
          
          // Score nominees and pick winner
          let bestNom = categoryNoms[0];
          let bestScore = 0;
          
          for (const nom of categoryNoms) {
            const film = allFilms.find(f => f.id === nom.filmId);
            if (!film) continue;
            
            let score = (film.criticScore || 0) * 2;
            score += ((film.audienceScore || 0) * 10) * 0.5;
            if (film.awards?.includes('Awards Campaign')) {
              score += 30; // Campaign matters more for winning
            }
            
            // For acting categories (except ensemble), factor in individual actor performance
            if (isActingCategory && !isEnsembleCategory && nom.talentId) {
              const talent = await storage.getTalent(nom.talentId);
              if (talent) {
                // Actor performance is a MAJOR factor in winning
                score += (talent.performance || 50) * 1.5; // Up to 150 points for 100 performance
              }
            }
            
            score += Math.random() * 25; // Slightly reduced random factor
            
            if (score > bestScore) {
              bestScore = score;
              bestNom = nom;
            }
          }
          
          // Mark as winner
          await storage.updateAwardNomination(bestNom.id, { isWinner: true });
          
          // Add award to film's awards array
          const film = allFilms.find(f => f.id === bestNom.filmId);
          if (film) {
            const category = await storage.getAwardCategory(categoryId);
            const awardName = `${show.shortName} - ${category?.shortName || 'Winner'}`;
            const currentAwards = [...(film.awards || [])];
            if (!currentAwards.includes(awardName)) {
              currentAwards.push(awardName);
              await storage.updateFilm(film.id, { awards: currentAwards });
              
              // Update studio awards count and add prestige bonus
              const studio = await storage.getStudio(film.studioId);
              if (studio) {
                const prestigeBonus = show.prestigeLevel * 100000; // Prestige bonus for winning
                await storage.updateStudio(film.studioId, {
                  totalAwards: (studio.totalAwards || 0) + 1,
                  budget: studio.budget + prestigeBonus,
                });
              }
            }
          }
        }
        
        // Mark ceremony as complete
        await storage.updateAwardCeremony(ceremony.id, { 
          ceremonyComplete: true,
          winnersAnnounced: true,
        });
        result.winners.push(show.name);
      }
    }
  }
  
  return result;
}

const filmTitles: Record<string, string[]> = {
  action: [
    'Furiosa', 'The Fall Guy', 'Twisters', 'The Beekeeper', 'Monkey Man', 'Road House', 'Boy Kills World', 
    'Rebel Ridge', 'Kill', 'The Ministry of Ungentlemanly Warfare', 'Civil War', 'Damsel',
    'Red One', 'Twilight of the Warriors', 'Marco', 'Tenet', 'Extraction', 'The Old Guard', 'Mulan',
    'Black Widow', 'Shang-Chi and the Legend of the Ten Rings', 'The Suicide Squad', 'The Batman', 
    'Everything Everywhere All at Once', 'Bullet Train', 'The Last Stand', 'Perfect Storm', 'Midnight Strike', 
    'Black Thunder', 'Showdown', 'Violent Sky', 'Apex', 'Inferno', 'Escape Plan', 'The Commando', 
    'Last Action Hero', 'Predator', 'True Lies', 'Speed', 'Die Hard', 'Under Siege', 'Cliffhanger', 
    'Demolition Man', 'Judge Dredd', 'Timecop', 'Sudden Death', 'Eraser', 'The Running Man', 'Bloodsport', 
    'Kickboxer', 'Double Impact', 'Cyborg', 'Universal Soldier', 'Hard Boiled', 'Police Story', 
    'Operation Condor', 'Rumble in the Bronx', 'First Strike', 'City Hunter', 'Project A', 'Dragons Forever', 
    'Supercop', 'Salt', 'Colombiana', 'Atomic Blonde', 'Red Sparrow', 'The Spy Who Loved Me', 'Octopussy', 
    'A View to a Kill', 'The Living Daylights', 'Casino Royale', 'Skyfall', 'Spectre', 'GoldenEye', 
    'Tomorrow Never Dies', 'The World Is Not Enough', 'Operation Stealth', 'The Vengeance Protocol', 
    'Assault on Base', 'Diamond Squadron', 'Smoke and Gunfire', 'Rogue Asset', 'Dark Tide Rising', 
    'Fatal Precision', 'Siege at Midnight', 'Blazing Fury', 'Iron Fist Strike', 'The Enforcer',
    'Highway Wars', 'Last Chance Protocol', 'Crimson Storm', 'Neon Vendetta', 'The Takedown', 'Savage Terrain',
    'Burning Bridges', 'Code Red Alert', 'The Final Assault', 'Shattered Steel', 'Savage Hands', 'Locked and Loaded',
    'The Avenger Returns', 'Black Market Deal', 'Trigger Point', 'Zero Hour Countdown', 'Midnight Raid', 'The Hunt Begins',
    'Steel Vengeance', 'Rogue Danger', 'Agent Protocol', 'Fire and Ice', 'Silent Hunter', 'The Last Guardian',
    'Unstoppable Force', 'Critical Mass', 'The Verdict', 'Eternal Conflict', 'Savage Legacy', 'Rising Phoenix'
  ],
  drama: [
    'Anora', 'The Brutalist', 'The Apprentice', 'Queer', 'A Real Pain', 'Small Things Like These', 'Sing Sing',
    'Challengers', 'It Ends With Us', 'Bob Marley: One Love', 'Emilia Pérez', 'Nomadland', 'The Father',
    'Minari', 'Ma Rainey\'s Black Bottom', 'The Trial of the Chicago 7', 'Hillbilly Elegy', 'Another Round',
    'The Devil All the Time', 'CODA', 'The Power of the Dog', 'Belfast', 'King Richard',
    'Licorice Pizza', 'Pig', 'The Last Duel', 'The Fabelmans', 'Tár', 'The Whale', 'Women Talking',
    'Elvis', 'The Banshees of Inisherin', 'Oppenheimer', 'Killers of the Flower Moon', 'Past Lives',
    'The Zone of Interest', 'Maestro', 'The Shawshank Redemption', 'The Godfather',
    '12 Angry Men', 'Schindler\'s List', 'Pulp Fiction', 'Forrest Gump', 'Goodfellas', 'Saving Private Ryan',
    'The Departed', 'Whiplash', 'Parasite', 'Spirited Away', 'The Green Mile', 'The Lion King', 'Gladiator',
    'Crash', 'Million Dollar Baby', 'No Country for Old Men', 'Slumdog Millionaire', 'The Hurt Locker',
    'The Kings Speech', 'The Artist', 'Argo', '12 Years a Slave', 'Birdman', 'Spotlight', 'Moonlight',
    'The Shape of Water', 'Green Book', 'American Beauty', 'Shakespeare in Love', 'A Beautiful Mind',
    'The Weight of Silence', 'Echoes of Tomorrow', 'Still Waters', 'Between the Lines', 'The Last Light', 'Grace and Ruin',
    'Whispers of the Past', 'The Distance Between', 'Autumn Leaves', 'Broken Compass', 'The Long Road Home', 'Unbroken Bonds',
    'Silent Witness', 'The Weight of Truth', 'Missing Pieces', 'The Cost of Love', 'Forgotten Dreams', 'The Final Year',
    'Ashes and Dust', 'The Bridge', 'Homecoming', 'The Reckoning', 'Voices in the Rain', 'The Tide Turns',
    'Standing Still', 'The Empty Chair', 'Cruel Light', 'The Witness', 'Broken Promises', 'The Last Day'
  ],
  comedy: [
    'The Fall Guy', 'A Real Pain', 'Hit Man', 'Palm Springs', 'The Prom', 'Free Guy', 'Don\'t Look Up', 
    'Barb and Star Go to Vista Del Mar', 'Cruella', 'The French Dispatch', 'Amsterdam', 'Glass Onion', 
    'See How They Run', 'Violent Night', 'The Menu', 'Cocaine Bear', 'No Hard Feelings', 'Joy Ride', 
    'Theater Camp', 'Bottoms', 'The Holdovers', 'The Big Lebowski', 'Fargo', 'O Brother Where Art Thou',
    'Raising Arizona', 'Burn After Reading', 'Hail Caesar', 'Intolerable Cruelty', 'The Hudsucker Proxy',
    'Breakfast at Tiffany\'s', 'Sabrina', 'Some Like It Hot', 'Gentlemen Prefer Blondes',
    'How to Marry a Millionaire', 'The Philadelphia Story', 'It Happened One Night', 'Bringing Up Baby',
    'His Girl Friday', 'Ninotchka', 'The Shop Around the Corner', 'Meet John Doe', 'It\'s a Wonderful Life',
    'The Gold Rush', 'City Lights', 'Modern Times', 'The Kid', 'Sherlock Jr.', 'The General', 
    'Safety Last', 'Sunset Boulevard', 'The Maltese Falcon', 'The Big Sleep', 'Touch of Evil', 'The Killing', 
    'Ace in the Hole', 'The Sweet Smell of Success', 'Dating Game', 'Office Chaos', 'Love in the City', 
    'Mistaken Identity', 'The Wrong Guy', 'Weekend Getaway', 'Lost in Translation', 'Mixed Messages', 
    'The Setup', 'Wedding Mayhem', 'The Roommate', 'Unexpected Friends', 'Coffee Shop Chronicles', 
    'Social Media Disaster', 'The Blind Date', 'Family Reunion', 'Best Man Blues', 'Night Out',
    'Road Trip Roulette', 'The Reunion', 'Romantic Comedy', 'The Bad Luck Club', 'First Date Fiasco', 
    'Summer Shenanigans', 'Winter Escape', 'Holiday Hilarity', 'The Party Never Stops', 'Friendship Goals', 
    'Love Actually', 'The Matchmaker'
  ],
  horror: [
    'Nosferatu', 'MaXXXine', 'The Substance', 'Longlegs', 'Immaculate', 'Night Swim', 'Abigail', 
    'Lisa Frankenstein', 'The First Omen', 'In a Violent Nature', 'Late Night with the Devil',
    'Speak No Evil', 'The Invisible Man', 'Relic', 'His House', 'Saint Maud', 'The Lodge',
    'Candyman', 'Malignant', 'Old', 'Last Night in Soho', 'X', 'Pearl', 'Nope',
    'Barbarian', 'Smile', 'The Black Phone', 'Scream', 'M3GAN', 'Evil Dead Rise',
    'Talk to Me', 'Thanksgiving', 'Five Nights at Freddy\'s', 'Renfield', 'The Ring', 'Ringu', 'Saw',
    'The Conjuring', 'Annabelle', 'Insidious', 'The Exorcist', 'The Shining', 'The Omen',
    'Psycho', 'Jaws', 'The Thing', 'The Fly', 'An American Werewolf in London',
    'The Howling', 'Near Dark', 'Fright Night', 'Lost Boys', 'Dusk Till Dawn', '30 Days of Night',
    'Let the Right One In', 'The Hunger', 'Bram Stoker\'s Dracula', 'Shadow of the Vampire', 
    'The Night Creature', 'The Widow', 'Only Lovers Left Alive', 'The Haunting of Hill House', 
    'Shadows in the Dark', 'The Descent', 'Sinister', 'The Possession', 'Insomnia',
    'Night Terrors', 'The Cursed', 'Midnight Shadows', 'The Ritual', 'Hollow', 'The Hollow', 'Veins of Darkness',
    'The Stalker', 'Dark Whispers', 'The Watcher', 'Eyes in the Dark', 'The Hunt', 'Voices', 'The Scream',
    'Echoes of Death', 'The Final Breath', 'Skeletal', 'The Plague', 'Dead Calm', 'The Reanimated', 'Skin Deep',
    'The Sacrifice', 'Bleed Out', 'The Final Hour', 'Rising Dead', 'The Grave', 'Cold Blood', 'The Sleepwalker'
  ],
  scifi: [
    'Dune', 'Kingdom of the Planet of the Apes', 'Godzilla x Kong', 'Furiosa', 'Megalopolis', 'Atlas', 
    'Tenet', 'The Invisible Man', 'Underwater', 'The Tomorrow War', 'Don\'t Look Up', 'Free Guy', 
    'Everything Everywhere All at Once', 'Nope', 'The Adam Project', 'Ambulance', 'The Creator', '65', 
    'M3GAN', 'Interstellar', 'The Martian', 'Gravity', 'Inception', 'The Prestige', 'Memento', 'Primer', 
    'Looper', 'Edge of Tomorrow', 'Oblivion', 'Pacific Rim', 'Elysium', 'District 9', 'Avatar', 
    'The Matrix', 'Total Recall', 'RoboCop', 'Minority Report', 'Blade Runner', 'A.I. Artificial Intelligence', 
    'Bicentennial Man', 'I Robot', 'Ex Machina', 'The Terminator', 'Back to the Future', 'Time Machine',
    'Twelve Monkeys', 'Predestination', 'The Time Machine', 'Timecop', 'About Time', 'Star Wars',
    'Quantum Leap', 'The Nexus', 'Portal to Tomorrow', 'Dimension Jump', 'The Rift', 'Cosmic Frontier',
    'Deep Space', 'The Void', 'Nebula', 'Star Bound', 'The Eclipse', 'Cosmic Collision', 'Zero Gravity',
    'The Singularity', 'Robot Age', 'Android Rising', 'Cyborg World', 'The Algorithm', 'Neural Network', 'Silicon Dreams',
    'Holographic', 'The Splice', 'Genetic Uprising', 'Evolution\'s End', 'The Experiment', 'Clone Wars', 'Mutation Factor',
    'Underground Future', 'Beneath the Sky', 'The Uprising', 'New Dawn', 'The Awakening'
  ],
  thriller: [
    'Killers of the Flower Moon', 'Parasite', 'The Menu', 'Cocaine Bear', 'Hereditary', 'Midsommar',
    'Get Out', 'The Silence of the Lambs', 'Psycho', 'Rear Window', 'Vertigo',
    'Rope', 'Shadow of a Doubt', 'The 39 Steps', 'Marnie', 'Dial M for Murder', 'Strangers on a Train',
    'Spellbound', 'Suspicion', 'Sabotage', 'The Lodger', 'Murder', 'Blackmail', 'Downhill',
    'The Skin Game', 'Rich and Strange', 'Lifeboat', 'Notorious',
    'The Trouble with Harry', 'Man Who Knew Too Much', 'North by Northwest',
    'The Birds', 'Torn Curtain', 'Topaz', 'Frenzy', 'Family Plot',
    'The Witness', 'Deadly Secret', 'The Conspiracy', 'Blood Trail', 'The Betrayal', 'Final Justice',
    'The Deceiver', 'Twisted Truth', 'The Guilty', 'Hidden Motive', 'Deadly Game', 'The Setup',
    'Dangerous Lies', 'The Trap', 'Point of No Return', 'Fatal Choice', 'The Hunt', 'Inevitable End',
    'Midnight Murder', 'The Accident', 'Dark Intentions', 'The Fugitive', 'Criminal Minds', 'The Verdict'
  ],
  romance: [
    'Challengers', 'Past Lives', 'The Shape of Water', 'La La Land', 'Crazy Rich Asians', 'The Fault in Our Stars',
    'Me Before You', 'The Notebook', 'A Walk to Remember', 'The Time Traveler\'s Wife', 'Titanic',
    'The Vow', 'The Lucky One', 'Safe Haven', 'The Last Song', 'Nights in Rodanthe',
    'Dear John', 'The Longest Ride', 'Before We Collide', 'Set It Up', 'Love Hard', 'Christmas Prince', 
    'Princess Switch', 'Enchanted', 'Holidate', 'Falling Inn Love',
    'Serendipity', 'Eternal Love', 'Kiss Me Again', 'Forever Young', 'Dancing in the Moonlight', 'Heartstrings',
    'The Promise', 'Borrowed Time', 'Coastal Bliss', 'Winter Romance', 'The Proposal', 'Against All Odds',
    'Kindred Spirits', 'Second Chance', 'The Perfect Match', 'Sweet Surrender', 'Chance Encounter', 'Love Story',
    'Ocean of Dreams', 'City of Hearts', 'Painted Sunset', 'The Bridge Between', 'Moment of Truth', 'Forever Hours',
    'Tender Moments', 'The Comeback', 'Paradise Found', 'Star Crossed', 'The Journey Home', 'Our Song'
  ],
  animation: [
    'Moana', 'Encanto', 'Spirited Away', 'Howl\'s Moving Castle', 'Kiki\'s Delivery Service', 'Ponyo', 
    'Castle in the Sky', 'My Neighbor Totoro', 'Princess Mononoke', 'Nausicaä of the Valley of the Wind', 
    'The Wind Rises', 'Your Name', 'A Silent Voice', 'I Want to Eat Your Pancreas', 'Weathering with You',
    'Finding Nemo', 'The Lion King', 'Aladdin', 'Beauty and the Beast', 'Cinderella', 'Sleeping Beauty', 
    'Snow White', 'Tangled', 'Frozen', 'Coco', 'Monsters Inc', 'Toy Story', 'Cars', 'Ratatouille', 'WALL-E',
    'Up', 'The Incredibles', 'Brave', 'Inside Out', 'Soul', 'Luca', 'Turning Red',
    'The Adventure Awaits', 'Magic Mountain', 'Fairy Quest', 'Dragon\'s Heart', 'The Lost Kingdom', 'Princess Adventure',
    'Enchanted Forest', 'The Quest Begins', 'Warriors of Wonder', 'Crystal Castle', 'The Magical Realm', 'Rainbow Journey',
    'Celestial Dreams', 'Starlight Adventure', 'The Wonder World', 'Ocean Legends', 'Sky High', 'Nature\'s Guardians',
    'Beast\'s Tale', 'The Chosen One', 'Forest Spirits', 'Legendary Heroes', 'The Golden Quest', 'Shadow Realm',
    'Destiny\'s Call', 'Heart of Courage', 'Wings of Hope', 'Eternal Flame', 'The Last Dragon'
  ],
  fantasy: [
    'The Dark Crystal', 'Labyrinth', 'Legend', 'Highlander', 'Excalibur', 'Conan the Barbarian',
    'Dragonheart', 'Stardust', 'How to Train Your Dragon', 'The NeverEnding Story', 'The Secret of NIMH',
    'The Last Unicorn', 'Quest for Camelot', 'Shrek', 'Beowulf', 'The Spiderwick Chronicles', 
    'Percy Jackson', 'Fantastic Beasts', 'The Golden Compass', 'Avatar', 'Aquaman', 
    'Wonder Woman', 'Eternals', 'Black Panther', 'Mystical Realms', 'The Enchanted Kingdom', 
    'Dragon\'s Curse', 'Shadow of the King', 'The Forgotten Magic', 'Crystal Prophecy', 'The Realm Beyond', 
    'Curse of the Ancient', 'The Last Mage', 'Kingdom\'s Fall', 'Rising Destiny', 'The Sacred Quest', 
    'Blood of Dragons', 'The Crown\'s Shadow', 'Twilight of Gods', 'The Sorcerer\'s Stone', 'Dark Magic Rising',
    'Realm of Shadows', 'The Dragon\'s Lair', 'Kingdom of Thorns', 'The Wizard\'s Quest', 'Enchanted Lands',
    'The Fae Court', 'Moonlight Kingdom', 'The Ancient Prophecy', 'Warrior\'s Heart', 'The Mystical Artifact'
  ],
  musicals: [
    'The Greatest Showman', 'In the Heights', 'West Side Story', 'Into the Woods', 'Mamma Mia!', 'Hairspray', 
    'Legally Blonde: The Musical', 'Across the Universe', 'Chicago', 'Dreamgirls', 
    'Sweeney Todd: The Demon Barber of Fleet Street', 'Les Misérables', 'Phantom of the Opera', 'Miss Saigon', 
    'Cats', 'Rent', 'The Producers', 'Singin\' in the Rain', 'An American in Paris', 'Funny Girl', 'Gypsy', 
    'A Chorus Line', 'Cabaret', 'The Rocky Horror Picture Show', 'Grease', 'The Sound of Music', 
    'The Music Man', 'Hello, Dolly!', 'Fiddler on the Roof', 'South Pacific', 'Oklahoma!', 'Carousel', 
    'State Fair', 'Easter Parade', 'Annie Get Your Gun', 'The King and I', 'My Fair Lady', 'Oliver!', 
    'Topsy-Turvy', 'Hedwig and the Angry Inch', 'Tick, Tick... Boom!', 'Dear Evan Hansen', 'Six', 
    'Come From Away', 'Hamilton', 'Mean Girls', 'Enchanted', 'Tangled', 'Moana', 'Coco',
    'Repo! The Genetic Opera', 'The Prom', 'Matilda the Musical', 'Little Shop of Horrors',
    'Stage Dreams', 'Broadway Magic', 'Songbird\'s Journey', 'The Grand Performance', 'Starlight Serenade',
    'Musical Hearts', 'The Final Curtain', 'Rhythm of Life', 'Golden Melodies', 'The Opening Night',
    'Encore\'s Call', 'Melody Quest', 'The Standing Ovation', 'Song of Victory', 'Dance of Destiny'
  ]
};

// TV Show titles for AI studios (organized by genre)
const tvShowTitles: Record<string, string[]> = {
  drama: [
    'The Crown', 'Succession', 'Breaking Bad', 'Better Call Saul', 'Mad Men', 'The Wire', 'The Sopranos',
    'House of Cards', 'Ozark', 'Yellowstone', 'This Is Us', 'The Handmaid\'s Tale', 'Big Little Lies',
    'The Morning Show', 'Billions', 'Power', 'Empire', 'How to Get Away with Murder', 'Scandal',
    'Grey\'s Anatomy', 'The Good Wife', 'Downton Abbey', 'The Americans', 'Homeland', 'Dexter',
    'True Detective', 'Boardwalk Empire', 'Friday Night Lights', 'Sons of Anarchy', 'Peaky Blinders',
    'The Last of Us', 'Shogun', 'Slow Horses', 'The Bear', 'Industry', 'Bad Sisters', 'Pachinko',
    'Severance', 'The White Lotus', 'Mare of Easttown', 'Sharp Objects', 'The Outsider', 'Perry Mason',
    'Winning Time', 'The Gilded Age', 'House of the Dragon', 'The Diplomat', 'Lessons in Chemistry'
  ],
  comedy: [
    'The Office', 'Parks and Recreation', 'Brooklyn Nine-Nine', 'Schitt\'s Creek', 'Ted Lasso',
    'Fleabag', 'Atlanta', 'Barry', 'What We Do in the Shadows', 'Abbott Elementary', 'Hacks',
    'The Good Place', 'Arrested Development', 'It\'s Always Sunny in Philadelphia', 'Curb Your Enthusiasm',
    'Silicon Valley', 'Veep', 'Community', '30 Rock', 'New Girl', 'Modern Family', 'The Big Bang Theory',
    'Friends', 'Seinfeld', 'How I Met Your Mother', 'Scrubs', 'Frasier', 'Cheers', 'The Simpsons',
    'Bob\'s Burgers', 'Archer', 'Rick and Morty', 'South Park', 'Family Guy', 'Futurama',
    'Only Murders in the Building', 'Shrinking', 'The Righteous Gemstones', 'Reservation Dogs'
  ],
  thriller: [
    'You', 'Mindhunter', 'The Following', 'Hannibal', 'Killing Eve', 'Mr. Robot', 'The Blacklist',
    'Jack Ryan', 'Reacher', 'The Night Manager', 'Berlin Station', 'Condor', 'The Old Man',
    'Tehran', 'Fauda', 'Bodyguard', 'Line of Duty', 'Luther', 'Marcella', 'Happy Valley',
    'Broadchurch', 'The Fall', 'Criminal Minds', 'NCIS', 'FBI', 'Law & Order', 'CSI',
    'The Mentalist', 'Castle', 'Bones', 'The Killing', 'Bosch', 'Goliath', 'The Lincoln Lawyer'
  ],
  horror: [
    'The Walking Dead', 'American Horror Story', 'Stranger Things', 'The Haunting of Hill House',
    'Midnight Mass', 'The Fall of the House of Usher', 'Cabinet of Curiosities', 'Creepshow',
    'Chucky', 'Bates Motel', 'Penny Dreadful', 'The Exorcist', 'Scream Queens', 'Ash vs Evil Dead',
    'From', 'Archive 81', 'Brand New Cherry Flavor', 'Marianne', 'The Terror', 'Yellowjackets',
    'Evil', 'Supernatural', 'The X-Files', 'Buffy the Vampire Slayer', 'Angel', 'Vampire Diaries'
  ],
  scifi: [
    'Westworld', 'Black Mirror', 'The Expanse', 'For All Mankind', 'Foundation', 'Silo',
    'Battlestar Galactica', 'Star Trek: Discovery', 'Star Trek: Picard', 'Star Trek: Strange New Worlds',
    'The Mandalorian', 'Andor', 'Obi-Wan Kenobi', 'Ahsoka', 'The Book of Boba Fett',
    'Altered Carbon', 'Love, Death & Robots', 'Electric Dreams', 'Tales from the Loop',
    'Raised by Wolves', 'Invasion', 'The 100', 'Lost in Space', 'Another Life', 'Away',
    '3 Body Problem', 'Dark', 'Devs', 'Counterpart', 'Fringe', 'Dollhouse', 'Firefly'
  ],
  action: [
    '24', 'Prison Break', 'The Boys', 'Invincible', 'Cobra Kai', 'Warrior', 'Into the Badlands',
    'Banshee', 'Strike Back', 'The Punisher', 'Daredevil', 'Jessica Jones', 'Luke Cage', 'Iron Fist',
    'The Defenders', 'Arrow', 'The Flash', 'Legends of Tomorrow', 'Titans', 'Doom Patrol',
    'Peacemaker', 'Watchmen', 'Umbrella Academy', 'The Witcher', 'Shadow and Bone', 'Wheel of Time',
    'Vikings', 'The Last Kingdom', 'Marco Polo', 'Spartacus', 'Black Sails', 'Outlander'
  ],
  fantasy: [
    'Game of Thrones', 'House of the Dragon', 'The Lord of the Rings: Rings of Power',
    'The Witcher', 'Shadow and Bone', 'Wheel of Time', 'His Dark Materials', 'Good Omens',
    'American Gods', 'Carnival Row', 'The Nevers', 'Interview with the Vampire', 'Mayfair Witches',
    'A Discovery of Witches', 'Jonathan Strange & Mr Norrell', 'The Magicians', 'Once Upon a Time',
    'Grimm', 'Merlin', 'Legend of the Seeker', 'Xena: Warrior Princess', 'Hercules'
  ],
  animation: [
    'Arcane', 'Castlevania', 'Blue Eye Samurai', 'Primal', 'Invincible', 'Undone', 'BoJack Horseman',
    'Avatar: The Last Airbender', 'The Legend of Korra', 'Young Justice', 'Harley Quinn',
    'Clone Wars', 'Rebels', 'Bad Batch', 'Visions', 'Tales of the Jedi', 'What If...?',
    'X-Men \'97', 'Spider-Man: Freshman Year', 'Samurai Jack', 'Adventure Time', 'Regular Show',
    'Gravity Falls', 'The Owl House', 'Amphibia', 'Kipo', 'She-Ra', 'Voltron'
  ]
};

const TV_SHOW_GENRES = ['drama', 'comedy', 'thriller', 'horror', 'scifi', 'action', 'fantasy', 'animation'];

function generateSequelTitle(originalTitle: string, sequelNumber: number): string {
  if (sequelNumber === 2) {
    const formats = [
      `${originalTitle} 2`,
      `${originalTitle}: Part Two`,
      `${originalTitle} II`,
    ];
    return formats[Math.floor(Math.random() * formats.length)];
  } else if (sequelNumber === 3) {
    const formats = [
      `${originalTitle} 3`,
      `${originalTitle}: Part Three`,
      `${originalTitle} III`,
    ];
    return formats[Math.floor(Math.random() * formats.length)];
  } else {
    return `${originalTitle} ${sequelNumber}`;
  }
}

const aiStudioNames = [
  'Universal Pictures',
  'The Walt Disney Company',
  'Warner Bros. Discovery',
  'Paramount Pictures',
  'Sony Pictures',
  'Netflix Studios',
  'Amazon Studios',
];
const aiStrategies: ('action' | 'drama' | 'comedy' | 'scifi' | 'horror' | 'animation' | 'balanced')[] = ['balanced', 'balanced', 'balanced', 'balanced', 'balanced', 'balanced', 'balanced'];

// VFX Studios with quality ratings and costs
const vfxStudios = [
  { id: 'weta', name: 'Weta Digital', cost: 120000000, quality: 100, specialization: ['action', 'scifi'] },
  { id: 'ilm', name: 'Industrial Light & Magic', cost: 110000000, quality: 95, specialization: ['scifi', 'animation', 'horror'] },
  { id: 'dneg', name: 'Double Negative', cost: 95000000, quality: 88, specialization: ['action', 'horror'] },
  { id: 'mpc', name: 'Moving Picture Company', cost: 85000000, quality: 80, specialization: ['action', 'scifi', 'animation'] },
  { id: 'framestore', name: 'Framestore', cost: 70000000, quality: 72, specialization: ['animation', 'horror'] },
  { id: 'digital-domain', name: 'Digital Domain', cost: 55000000, quality: 62, specialization: ['action', 'animation'] },
  { id: 'rise', name: 'Rise', cost: 40000000, quality: 52, specialization: ['scifi', 'horror'] },
  { id: 'blur', name: 'Blur Studio', cost: 30000000, quality: 44, specialization: ['animation', 'scifi'] },
  { id: 'base-fx', name: 'BaseFX', cost: 18000000, quality: 35, specialization: ['action', 'horror'] },
];

// Genre-based review patterns from Rotten Tomatoes analysis
const genreReviewPatterns: Record<string, { criticBase: number; audienceBase: number; criticVar: number; audienceVar: number }> = {
  drama: { criticBase: 75, audienceBase: 72, criticVar: 20, audienceVar: 15 },
  horror: { criticBase: 72, audienceBase: 68, criticVar: 25, audienceVar: 20 },
  action: { criticBase: 60, audienceBase: 75, criticVar: 25, audienceVar: 15 },
  comedy: { criticBase: 65, audienceBase: 76, criticVar: 25, audienceVar: 18 },
  scifi: { criticBase: 70, audienceBase: 72, criticVar: 22, audienceVar: 18 },
  romance: { criticBase: 62, audienceBase: 74, criticVar: 20, audienceVar: 16 },
  animation: { criticBase: 77, audienceBase: 78, criticVar: 18, audienceVar: 12 },
  thriller: { criticBase: 68, audienceBase: 75, criticVar: 22, audienceVar: 16 },
  fantasy: { criticBase: 70, audienceBase: 76, criticVar: 20, audienceVar: 16 },
  musicals: { criticBase: 68, audienceBase: 74, criticVar: 22, audienceVar: 18 },
};

const awardTiers = {
  cinematicAwards: ['Palme d\'Or', 'Golden Bear', 'Golden Lion', 'Best Picture', 'Best Director'],
  majorAwards: ['Best Screenplay', 'Best Acting', 'Best Visual Effects', 'Best Score'],
};

// Calculate the total weeks from creation to release for AI films
// This is the single source of truth for AI film release date calculation
function calculateAIFilmTotalProductionWeeks(phaseDurations: { devWeeks: number; preWeeks: number; prodWeeks: number; postWeeks: number }): number {
  const { devWeeks, preWeeks, prodWeeks, postWeeks } = phaseDurations;
  // AI films go through: development → pre-production → production → post-production → released
  // No intermediate phases like awaiting-greenlight or filmed
  return devWeeks + preWeeks + prodWeeks + postWeeks;
}

// Calculate release week and year from a starting point
function calculateReleaseDate(startWeek: number, startYear: number, totalWeeks: number): { releaseWeek: number; releaseYear: number } {
  let releaseWeek = startWeek + totalWeeks;
  let releaseYear = startYear;
  
  while (releaseWeek > 52) {
    releaseWeek -= 52;
    releaseYear += 1;
  }
  
  return { releaseWeek, releaseYear };
}

// Calculate production phase durations based on genre and VFX needs
function calculatePhaseDurations(genre: string, productionBudget: number, hasVFX: boolean = false) {
  const devWeeks = 4; // Always 4 weeks for development
  
  // Pre-production: Genre-based with budget multiplier, max 10 weeks
  let preWeeks = 2; // Base weeks
  if (genre === 'action' || genre === 'scifi') {
    // Action/Sci-Fi need more time for set building and planning
    const budgetMultiplier = Math.min(2, productionBudget / 50000000); // Budget affects complexity
    preWeeks = Math.round(3 + budgetMultiplier * 3); // 3-6 weeks
  } else if (genre === 'animation') {
    preWeeks = 4; // Animation needs more pre-production planning
  } else if (genre === 'horror' || genre === 'thriller') {
    preWeeks = 3; // Moderate pre-production
  } else if (genre === 'fantasy') {
    preWeeks = 4; // Fantasy needs set/costume/effects planning
  } else if (genre === 'musicals') {
    preWeeks = 5; // Musicals need choreography and music arrangement
  } else {
    preWeeks = 2; // Drama, comedy, etc. minimal pre-production
  }
  preWeeks = Math.min(10, preWeeks); // Cap at 10 weeks
  
  const prodWeeks = 12; // Always 12 weeks for production
  
  // Post-production: VFX-dependent
  let postWeeks = hasVFX ? 
    8 + Math.floor(Math.random() * 5) :  // 8-12 weeks with VFX
    4 + Math.floor(Math.random() * 3);   // 4-6 weeks without VFX
  
  return { devWeeks, preWeeks, prodWeeks, postWeeks };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup WebSocket server for multiplayer
  setupWebSocket(httpServer);
  
  // Register multiplayer routes
  registerMultiplayerRoutes(app);
  
  // Run database migrations before seeding
  const { runMigrations } = await import("./db");
  await runMigrations();
  
  // Seed talent data on startup
  await storage.seedTalent();

  // Initialize AI studios on first run
  const allStudios = await storage.getAllStudios();
  if (allStudios.length === 0) {
    const defaultDeviceId = "default-device";
    const newStudio = await storage.createStudio({
      deviceId: defaultDeviceId,
      name: "Stellar Pictures",
      budget: 150000000,
      currentWeek: 1,
      currentYear: 2025,
      prestigeLevel: 1,
      totalEarnings: 0,
      totalAwards: 0,
      isAI: false,
    });
    
    // Create AI studios with varied budgets
    const budgets = [1000000000, 1000000000, 1000000000, 1000000000, 1000000000, 1000000000, 1000000000];
    for (let i = 0; i < aiStudioNames.length; i++) {
      await storage.createStudio({
        deviceId: defaultDeviceId,
        name: aiStudioNames[i],
        budget: budgets[i],
        currentWeek: 1,
        currentYear: 2025,
        prestigeLevel: 1,
        totalEarnings: 0,
        totalAwards: 0,
        isAI: true,
        strategy: aiStrategies[i],
      });
    }
  }

  // === STUDIO ROUTES ===
  
  app.get("/api/studio", async (req, res) => {
    try {
      const deviceId = req.query.deviceId || "default-device";
      const playerStudio = await storage.getPlayerStudioByDeviceId(deviceId as string);
      if (!playerStudio) {
        return res.status(500).json({ error: "Player studio not found" });
      }
      res.json(playerStudio);
    } catch (error) {
      console.error("Error fetching studio:", error);
      res.status(500).json({ error: "Failed to fetch studio" });
    }
  });

  app.get("/api/all-studios", async (req, res) => {
    try {
      const deviceId = req.query.deviceId || "default-device";
      const allStudios = await storage.getStudiosByDeviceId(deviceId as string);
      res.json(allStudios);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch studios" });
    }
  });

  app.get("/api/saves", async (req, res) => {
    try {
      const deviceId = req.query.deviceId || "default-device";
      const allStudios = await storage.getStudiosByDeviceId(deviceId as string);
      const playerStudios = allStudios.filter(s => !s.isAI).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      res.json(playerStudios);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch saves" });
    }
  });

  app.get("/api/studio/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const studio = await storage.getStudio(id);
      if (!studio) {
        return res.status(404).json({ error: "Studio not found" });
      }
      res.json(studio);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch studio" });
    }
  });

  // Backfill synopses for existing films that don't have them
  app.post("/api/backfill-synopses", async (req, res) => {
    try {
      const allStudios = await storage.getAllStudios();
      let updated = 0;
      
      for (const studio of allStudios) {
        const films = await storage.getFilmsByStudio(studio.id);
        for (const film of films) {
          if (!film.synopsis || film.synopsis === '') {
            try {
              const synopsis = await generateAIFilmSynopsis(film.id, film.title, film.genre);
              await storage.updateFilm(film.id, { synopsis } as any);
              updated++;
              console.log(`[BACKFILL] Generated synopsis for "${film.title}"`);
            } catch (err) {
              console.error(`[BACKFILL-ERROR] Failed for ${film.title}:`, err);
            }
          }
        }
      }
      
      res.json({ success: true, updatedFilms: updated });
    } catch (error) {
      console.error("Error backfilling synopses:", error);
      res.status(500).json({ error: "Failed to backfill synopses" });
    }
  });

  app.post("/api/studio/new", async (req, res) => {
    try {
      const { name, deviceId } = req.body;
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: "Invalid studio name" });
      }
      const actualDeviceId = deviceId || "default-device";

      const newStudio = await storage.createStudio({
        deviceId: actualDeviceId,
        name: name.trim(),
        budget: 150000000,
        currentWeek: 1,
        currentYear: 2025,
        prestigeLevel: 1,
        totalEarnings: 0,
        totalAwards: 0,
        isAI: false,
      });

      // Create fresh AI studios for this save
      const budgets = [1000000000, 1000000000, 1000000000, 1000000000, 1000000000, 1000000000, 1000000000];
      for (let i = 0; i < aiStudioNames.length; i++) {
        await storage.createStudio({
          deviceId: actualDeviceId,
          name: aiStudioNames[i],
          budget: budgets[i],
          currentWeek: 1,
          currentYear: 2025,
          prestigeLevel: 1,
          totalEarnings: 0,
          totalAwards: 0,
          isAI: true,
          strategy: aiStrategies[i],
          playerGameId: newStudio.id,
        });
      }

      res.status(201).json(newStudio);
    } catch (error) {
      console.error("Error creating studio:", error);
      res.status(500).json({ error: "Failed to create studio" });
    }
  });

  // Preload weeks to generate unique box office data for each save
  app.post("/api/studio/:id/preload", async (req, res) => {
    try {
      const { id } = req.params;
      const { weeks = 24 } = req.body;

      const studio = await storage.getStudio(id);
      if (!studio) {
        return res.status(404).json({ error: "Studio not found" });
      }

      let currentWeek = studio.currentWeek;
      let currentYear = studio.currentYear;

      // Simulate multiple weeks to generate box office data
      for (let i = 0; i < weeks; i++) {
        currentWeek += 1;
        if (currentWeek > 52) {
          currentWeek = 1;
          currentYear += 1;
        }

        // Get AI studios associated with this save
        const allStudios = await storage.getAllStudios();
        const aiStudios = allStudios.filter(s => s.isAI && s.playerGameId === id);
        const allFilms = await storage.getAllFilms();
        const saveFilms = allFilms.filter(f => {
          const filmStudio = allStudios.find(s => s.id === f.studioId);
          return filmStudio && (filmStudio.id === id || filmStudio.playerGameId === id);
        });

        // Update all films production progress (only for this save)
        for (const film of saveFilms) {
          if (film.phase !== 'released') {
            let newWeeksInPhase = (film.weeksInCurrentPhase || 0) + 1;
            let newPhase = film.phase;
            
            // DEBUG: Log Jack Hammer in detail
            if (film.title === 'Jack Hammer') {
              console.log(`[JACK-DEBUG] Current phase: ${film.phase}, weeks in phase: ${film.weeksInCurrentPhase}, new weeks: ${newWeeksInPhase}`);
            }
            
            // Special check: Awaiting greenlight transitions when talent is hired (regardless of time)
            if (film.phase === 'awaiting-greenlight' && film.hasHiredTalent) {
              console.log(`[PHASE-TRANSITION] ${film.title} transitioning from awaiting-greenlight to pre-production (hasHiredTalent=${film.hasHiredTalent})`);
              newPhase = 'pre-production';
              newWeeksInPhase = 0;
            }
            else if (film.phase === 'awaiting-greenlight') {
              console.log(`[PHASE-CHECK] ${film.title} stuck in awaiting-greenlight (hasHiredTalent=${film.hasHiredTalent})`);
            }
            // Special check: Production transitions to filmed when production weeks are complete
            else if (film.phase === 'production' && newWeeksInPhase >= (film.productionDurationWeeks || 4)) {
              console.log(`[PHASE-TRANSITION] ${film.title} transitioning from production to filmed (weeks: ${newWeeksInPhase} >= ${film.productionDurationWeeks || 4})`);
              newPhase = 'filmed';
              newWeeksInPhase = 0;
            }
            // Special check: Filmed transitions when edit is complete (regardless of time)
            else if (film.phase === 'filmed' && film.hasEditedPostProduction) {
              console.log(`[PHASE-TRANSITION] ${film.title} transitioning from filmed to post-production (hasEditedPostProduction=${film.hasEditedPostProduction})`);
              newPhase = 'post-production';
              newWeeksInPhase = 0;
            }
            else if (film.phase === 'filmed') {
              console.log(`[PHASE-CHECK] ${film.title} stuck in filmed (hasEditedPostProduction=${film.hasEditedPostProduction})`);
            }
            // Time-based phase transitions
            else {
              // Check if should advance to next phase
              const phaseDurations: Record<string, number> = {
                'development': film.developmentDurationWeeks || 2,
                'awaiting-greenlight': 999999, // Awaiting greenlight has no time duration - waits for talent hire
                'pre-production': film.preProductionDurationWeeks || 2,
                'production': film.productionDurationWeeks || 4,
                'filmed': 999999, // Filmed phase waits for post-production edit
                'post-production': film.postProductionDurationWeeks || 2,
              };
              
              if (film.title === 'Jack Hammer') {
                console.log(`[JACK-DEBUG] Phase durations check: ${film.phase} has duration ${phaseDurations[film.phase]}, checking: ${newWeeksInPhase} > ${phaseDurations[film.phase]} = ${newWeeksInPhase > phaseDurations[film.phase]}`);
              }
              
              if (newWeeksInPhase > phaseDurations[film.phase]) {
                // Development phase: advance to awaiting-greenlight
                if (film.phase === 'development') {
                  newPhase = 'awaiting-greenlight';
                  newWeeksInPhase = 0;
                }
                // Pre-production to production
                else if (film.phase === 'pre-production') {
                  newPhase = 'production';
                  newWeeksInPhase = 0;
                }
                // Production to filmed
                else if (film.phase === 'production') {
                  if (film.title === 'Jack Hammer') {
                    console.log(`[JACK-DEBUG] TRANSITIONING FROM PRODUCTION TO FILMED`);
                  }
                  newPhase = 'filmed';
                  newWeeksInPhase = 0;
                }
                // Post-production to production-complete
                else if (film.phase === 'post-production') {
                  newPhase = 'production-complete';
                  newWeeksInPhase = 0;
                }
              }
            }
            
            // Check if production-complete films have territory releases scheduled
            if (film.phase === 'production-complete' || newPhase === 'production-complete') {
              const releases = await storage.getFilmReleasesByFilm(film.id);
              if (releases && releases.length > 0) {
                newPhase = 'awaiting-release';
                newWeeksInPhase = 0;
              }
            }
            
            await storage.updateFilm(film.id, {
              weeksInCurrentPhase: newWeeksInPhase,
              phase: newPhase,
            } as any);
          }
        }

        // Handle box office for all released films (only for this save)
        const saveReleasedFilms = saveFilms.filter(f => f.phase === 'released' && f.weeklyBoxOffice.length > 0 && f.weeklyBoxOffice.length < 24);
        for (const film of saveReleasedFilms) {
          const lastWeek = film.weeklyBoxOffice[film.weeklyBoxOffice.length - 1];
          
          // Audience score-based decay system - boosted for better legs
          // Target: 90 audience score should give legs of ~3x (total/opening)
          // To get 3x legs with ~10 weeks, need avg hold of ~65-70%
          const audienceScore = (film.audienceScore || 7) * 10; // Convert to 0-100 scale
          
          // Tiered coefficient: higher scores get much better holds
          // 90+ → 0.85 coef (76% hold), 80+ → 0.78 (62%), 70+ → 0.72 (50%), below → 0.60 (36%)
          let coefficient = 0.60;
          if (audienceScore >= 90) coefficient = 0.85;
          else if (audienceScore >= 80) coefficient = 0.78;
          else if (audienceScore >= 70) coefficient = 0.72;
          
          let hold = (audienceScore / 100) * coefficient;
          
          // Apply ±10% randomness
          const randomMultiplier = 1 + (Math.random() - 0.5) * 0.20;
          hold = hold * randomMultiplier;
          
          // Bound hold between 20% and 80% (raised cap for great films)
          hold = Math.max(0.20, Math.min(0.80, hold));
          
          const newGross = Math.floor(lastWeek * hold);
          
          if (newGross > 50000) {
            const newWeeklyBoxOffice = [...film.weeklyBoxOffice, newGross];
            const newTotalBoxOffice = film.totalBoxOffice + newGross;
            
            await storage.updateFilm(film.id, {
              weeklyBoxOffice: newWeeklyBoxOffice,
              totalBoxOffice: newTotalBoxOffice,
            } as any);
          }
        }

        // AI logic: create and release films (only for this save's AI studios)
        for (const aiStudio of aiStudios) {
          // Create films
          if (Math.random() < 0.25 && aiStudio.budget > 30000000) {
            // Get AI studio's released films to check for sequel opportunities
            const aiFilms = await storage.getFilmsByStudio(aiStudio.id);
            const successfulFilms = aiFilms.filter(f => 
              f.phase === 'released' && 
              (f.totalBoxOffice || 0) >= 200000000 && // Films with $200M+ box office
              !(f as any).prequelId // Not already a sequel
            );
            
            let title: string;
            let genre: string;
            let prequelId: number | null = null;
            let isSequel = false;
            
            // 40% chance to make a sequel if there are successful films available
            if (successfulFilms.length > 0 && Math.random() < 0.40) {
              // Pick a random successful film to sequel
              const prequelFilm = successfulFilms[Math.floor(Math.random() * successfulFilms.length)];
              
              // Count existing sequels for this franchise
              const existingSequels = aiFilms.filter(f => (f as any).prequelId === prequelFilm.id).length;
              const sequelNumber = existingSequels + 2; // 2 for first sequel, 3 for second, etc.
              
              // Max 4 sequels per franchise
              if (sequelNumber <= 5) {
                // Get the original franchise title (strip any sequel numbering)
                const originalTitle = prequelFilm.title
                  .replace(/ \d+$/, '')
                  .replace(/: Part (Two|Three|Four|Five)$/, '')
                  .replace(/ (II|III|IV|V)$/, '');
                
                title = generateSequelTitle(originalTitle, sequelNumber);
                genre = prequelFilm.genre;
                prequelId = prequelFilm.id;
                isSequel = true;
              } else {
                // Too many sequels, make an original film
                genre = GENRES[Math.floor(Math.random() * GENRES.length)];
                const titleList = filmTitles[genre];
                title = titleList[Math.floor(Math.random() * titleList.length)];
              }
            } else {
              // Make an original film
              genre = GENRES[Math.floor(Math.random() * GENRES.length)];
              const titleList = filmTitles[genre];
              title = titleList[Math.floor(Math.random() * titleList.length)];
            }
            
            // Genre-based budget allocation (based on real-world industry data)
            let prodBudget: number;
            if (genre === 'action' || genre === 'scifi') {
              prodBudget = 40000000 + Math.random() * 90000000; // 40M-130M
            } else if (genre === 'animation') {
              prodBudget = 30000000 + Math.random() * 90000000; // 30M-120M
            } else if (genre === 'fantasy') {
              prodBudget = 50000000 + Math.random() * 80000000; // 50M-130M
            } else if (genre === 'thriller') {
              prodBudget = 15000000 + Math.random() * 65000000; // 15M-80M
            } else if (genre === 'comedy' || genre === 'romance') {
              prodBudget = 8000000 + Math.random() * 52000000; // 8M-60M
            } else if (genre === 'musicals') {
              prodBudget = 25000000 + Math.random() * 95000000; // 25M-120M (musicals need budget for choreography/music)
            } else if (genre === 'horror') {
              // Horror is the most profitable genre per dollar (avg $4-5M, range $1M-$15M for indie, $50M+ for franchises)
              // 80% indie horror, 20% big franchise horror
              if (Math.random() < 0.8) {
                prodBudget = 1000000 + Math.random() * 14000000; // 1M-15M (indie horror)
              } else {
                prodBudget = 40000000 + Math.random() * 40000000; // 40M-80M (major franchise)
              }
            } else if (genre === 'drama') {
              prodBudget = 4000000 + Math.random() * 36000000; // 4M-40M
            } else {
              prodBudget = 8000000 + Math.random() * 52000000; // 8M-60M (default)
            }
            
            // Roll department budgets based on genre and production budget
            const setsBudget = prodBudget * (0.08 + Math.random() * 0.12); // 8-20%
            const costumesBudget = prodBudget * (0.02 + Math.random() * 0.03); // 2-5%
            const stuntsBudget = (genre === 'action' || genre === 'scifi' || genre === 'fantasy') 
              ? prodBudget * (0.04 + Math.random() * 0.06) // 4-10% for heavy action
              : prodBudget * (0.01 + Math.random() * 0.03); // 1-4% for others
            const makeupBudget = prodBudget * (0.01 + Math.random() * 0.02); // 1-3%
            const practicalEffectsBudget = prodBudget * (0.02 + Math.random() * 0.04); // 2-6%
            const soundCrewBudget = prodBudget * (0.01 + Math.random() * 0.02); // 1-3%
            
            const departmentBudgetTotal = setsBudget + costumesBudget + stuntsBudget + makeupBudget + practicalEffectsBudget + soundCrewBudget;
            
            // Calculate marketing budget based on total investment budget (production + departments)
            // AI studios spend aggressively on marketing: 80-150% of investment budget
            const investmentBudget = prodBudget + departmentBudgetTotal;
            const marketingRatio = 0.80 + Math.random() * 0.70; // 80-150% guaranteed
            const marketBudget = investmentBudget * marketingRatio;
            
            const totalCost = prodBudget + marketBudget + departmentBudgetTotal;
            // totalBudget should match player films: production + departments (no marketing)
            const totalBudgetForDisplay = prodBudget + departmentBudgetTotal;
            console.log(`[PRELOAD-AI-FILM] ${title} (${genre}): prod=$${Math.round(prodBudget/1000000)}M, depts=$${Math.round(departmentBudgetTotal/1000000)}M, marketing=$${Math.round(marketBudget/1000000)}M, totalBudget=$${Math.round(totalBudgetForDisplay/1000000)}M`);

            if (aiStudio.budget >= totalCost) {
              // Generate phase durations based on genre and production needs
              const phaseDurations = calculatePhaseDurations(genre, Math.floor(prodBudget), false);
              const { devWeeks, preWeeks, prodWeeks, postWeeks } = phaseDurations;
              
              // Use centralized function for release date calculation
              const totalWeeks = calculateAIFilmTotalProductionWeeks(phaseDurations);
              const { releaseWeek, releaseYear } = calculateReleaseDate(currentWeek, currentYear, totalWeeks);

              const newFilm = await storage.createFilm({
                studioId: aiStudio.id,
                title,
                genre: genre as any,
                phase: 'development',
                productionBudget: Math.floor(prodBudget),
                marketingBudget: Math.floor(marketBudget),
                talentBudget: 0,
                setsBudget: Math.floor(setsBudget),
                costumesBudget: Math.floor(costumesBudget),
                stuntsBudget: Math.floor(stuntsBudget),
                makeupBudget: Math.floor(makeupBudget),
                practicalEffectsBudget: Math.floor(practicalEffectsBudget),
                soundCrewBudget: Math.floor(soundCrewBudget),
                totalBudget: Math.floor(totalBudgetForDisplay),
                scriptQuality: Math.floor(60 + Math.random() * 30),
                createdAtWeek: currentWeek,
                createdAtYear: currentYear,
                developmentDurationWeeks: devWeeks,
                preProductionDurationWeeks: preWeeks,
                productionDurationWeeks: prodWeeks,
                postProductionDurationWeeks: postWeeks,
                weeksInCurrentPhase: 0,
                releaseWeek,
                releaseYear,
                hasHiredTalent: true,
                hasEditedPostProduction: true,
                ...(prequelId ? { prequelId } : {}),
              });
              
              if (isSequel) {
                console.log(`[AI-SEQUEL] ${aiStudio.name} creating sequel: ${title} (prequel ID: ${prequelId})`);
              }

              // Generate roles, hire talent, and create synopsis for preloaded AI films
              try {
                await generateFilmRoles(newFilm.id, genre, prodBudget);
                await hireAITalent(newFilm.id, genre, aiStudio);
                const synopsis = await generateAIFilmSynopsis(newFilm.id, title, genre);
                await storage.updateFilm(newFilm.id, { synopsis });
              } catch (err) {
                console.error(`[PRELOAD-AI] Failed to setup talent/synopsis for ${title}:`, err);
              }

              // AI films with VFX-heavy genres MUST pick a VFX studio
              const vfxRequiredGenres = ['action', 'scifi', 'fantasy', 'animation', 'horror'];
              if (vfxRequiredGenres.includes(genre)) {
                // Randomly select a VFX studio
                const selectedVFXStudio = vfxStudios[Math.floor(Math.random() * vfxStudios.length)];
                const vfxCost = selectedVFXStudio.cost || 0;
                
                await storage.updateFilm(newFilm.id, {
                  vfxStudioId: selectedVFXStudio.id,
                  totalBudget: Math.floor(totalCost + vfxCost),
                });

                // Deduct VFX cost from AI studio budget
                await storage.updateStudio(aiStudio.id, {
                  budget: aiStudio.budget - Math.floor(totalCost) - Math.floor(vfxCost),
                });
              } else {
                // Non-VFX films just deduct the production + marketing cost
                await storage.updateStudio(aiStudio.id, {
                  budget: aiStudio.budget - Math.floor(totalCost),
                });
              }
            }
          }

          // OLD CODE REMOVED - AI films now use the production-complete → awaiting-release system
          // This happens in the main advanceWeek loop below
          
          // AI TV Show Creation - 15% chance per AI studio per week during preload
          if (Math.random() < 0.15 && aiStudio.budget > 50000000) {
            const tvGenre = TV_SHOW_GENRES[Math.floor(Math.random() * TV_SHOW_GENRES.length)];
            const titleList = tvShowTitles[tvGenre] || tvShowTitles['drama'];
            const tvTitle = titleList[Math.floor(Math.random() * titleList.length)];
            
            // Check if this show already exists for this studio
            const existingShows = await storage.getTVShowsByStudio(aiStudio.id);
            const titleExists = existingShows.some(s => s.title === tvTitle);
            
            if (!titleExists) {
              // Episode budget based on genre ($3M-$15M per episode)
              let episodeBudget = 5000000;
              if (tvGenre === 'action' || tvGenre === 'scifi' || tvGenre === 'fantasy') {
                episodeBudget = 10000000 + Math.floor(Math.random() * 5000000);
              } else if (tvGenre === 'animation') {
                episodeBudget = 3000000 + Math.floor(Math.random() * 2000000);
              } else if (tvGenre === 'drama' || tvGenre === 'thriller') {
                episodeBudget = 6000000 + Math.floor(Math.random() * 4000000);
              } else {
                episodeBudget = 4000000 + Math.floor(Math.random() * 3000000);
              }
              
              const episodesPerSeason = tvGenre === 'animation' ? 10 : (8 + Math.floor(Math.random() * 5));
              
              // Pick a streaming service for this AI show
              const services = await storage.getAllStreamingServices();
              const targetService = services[Math.floor(Math.random() * services.length)];
              
              const newTVShow = await storage.createTVShow({
                studioId: aiStudio.id,
                title: tvTitle,
                genre: tvGenre,
                showType: tvGenre === 'comedy' ? 'sitcom' : 'drama',
                synopsis: `A compelling ${tvGenre} series from ${aiStudio.name}.`,
                episodeBudget,
                episodesPerSeason,
                isStreamingExclusive: true,
                streamingServiceId: targetService.id,
                releaseStrategy: Math.random() > 0.5 ? 'binge' : 'weekly',
                phase: 'airing', // AI shows start ready to air
                currentSeason: 1,
                renewalStatus: 'renewed',
                createdAtWeek: currentWeek,
                createdAtYear: currentYear,
                overallQuality: 50 + Math.floor(Math.random() * 40),
                weeksStreaming: 0,
                weeklyViews: [],
                totalViews: 0,
                totalRevenue: 0,
              });
              
              // Create TV deal for the AI show
              const seasonBudget = episodeBudget * episodesPerSeason;
              const licenseFee = Math.floor(seasonBudget * (0.8 + Math.random() * 0.4));
              
              await storage.createTVDeal({
                tvShowId: newTVShow.id,
                playerGameId: id, // Links to player's game for tracking
                dealType: 'streaming',
                streamingServiceId: targetService.id,
                licenseFee,
                totalValue: licenseFee,
                startWeek: currentWeek,
                startYear: currentYear,
                seasonsCommitted: 1 + Math.floor(Math.random() * 3),
                isActive: true,
                isExclusive: true,
                weeklyViews: [],
                totalViews: 0,
                weeklyRevenue: 0,
                totalRevenue: 0,
                weeksActive: 0,
              });
              
              // Deduct budget from AI studio
              await storage.updateStudio(aiStudio.id, {
                budget: aiStudio.budget - seasonBudget,
              });
              
              console.log(`[AI-TV] ${aiStudio.name} created TV show: ${tvTitle} on ${targetService.name}`);
            }
          }
        }
      }

      // Update the player studio with the new week/year after preload
      await storage.updateStudio(id, {
        currentWeek,
        currentYear,
      });

      // Also sync all AI studios to the same week/year
      // For multiplayer, use gameSessionId to find shared AI studios
      const allStudios = await storage.getAllStudios();
      const isMultiplayer = !!studio.gameSessionId;
      const aiStudios = allStudios.filter(s => s.isAI && (
        isMultiplayer 
          ? s.gameSessionId === studio.gameSessionId 
          : s.playerGameId === id
      ));
      for (const aiStudio of aiStudios) {
        await storage.updateStudio(aiStudio.id, {
          currentWeek,
          currentYear,
        });
      }

      const updatedStudio = await storage.getStudio(id);
      res.json(updatedStudio);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';
      console.error("Error preloading game:", errorMsg);
      console.error("Stack:", errorStack);
      res.status(500).json({ error: "Failed to preload game", details: errorMsg });
    }
  });

  app.delete("/api/studio/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const studio = await storage.getStudio(id);
      if (!studio) {
        return res.status(404).json({ error: "Studio not found" });
      }

      // Get all studios and films for cleanup
      const allStudios = await storage.getAllStudios();
      
      // Get all films for this studio and AI studios
      // For multiplayer, use gameSessionId to find shared AI studios
      const studioFilms = await storage.getFilmsByStudio(id);
      const isMultiplayer = !!studio.gameSessionId;
      const aiStudios = allStudios.filter(s => s.isAI && (
        isMultiplayer 
          ? s.gameSessionId === studio.gameSessionId 
          : s.playerGameId === id
      ));
      const aiFilmIds = new Set<string>();
      for (const aiStudio of aiStudios) {
        const aiFilms = await storage.getFilmsByStudio(aiStudio.id);
        aiFilms.forEach(f => aiFilmIds.add(f.id));
      }
      
      // Collect all film IDs to delete
      const filmIdsToDelete = new Set([
        ...studioFilms.map(f => f.id),
        ...aiFilmIds
      ]);
      
      // First, delete all franchises that have ANY of these films as original films
      // This breaks the foreign key constraints before deleting the films
      // We need to check all studios, not just the current one
      try {
        const allStudios = await storage.getAllStudios();
        for (const studio of allStudios) {
          const studioFranchises = await storage.getFranchisesByStudio(studio.id) || [];
          for (const franchise of studioFranchises) {
            if (filmIdsToDelete.has(franchise.originalFilmId)) {
              await storage.deleteFranchise(franchise.id);
            }
          }
        }
      } catch (e) {
        console.log("Note: Some franchises may have already been deleted or don't exist");
      }
      
      // Clear franchise_id from all films to fully break references
      for (const filmId of filmIdsToDelete) {
        try {
          await storage.updateFilm(filmId, { franchiseId: null });
        } catch (e) {
          // Ignore if film doesn't exist
        }
      }

      // Delete all films for this studio and their dependent records
      await Promise.all(studioFilms.map(async (film) => {
        // Delete all streaming deals for this film first (foreign key constraint)
        await storage.deleteStreamingDealsByFilm(film.id);
        
        // Delete all award nominations for this film
        const nominations = await storage.getNominationsByFilm(film.id);
        await Promise.all(nominations.map(n => storage.deleteAwardNomination(n.id)));
        
        // Delete all releases for this film
        const releases = await storage.getFilmReleasesByFilm(film.id);
        await Promise.all(releases.map(r => storage.deleteFilmRelease(r.id)));
        
        // Delete all milestones for this film
        const milestones = await storage.getFilmMilestonesByFilm(film.id);
        await Promise.all(milestones.map(m => storage.deleteFilmMilestone(m.id)));
        
        // Delete all roles for this film
        const roles = await storage.getFilmRolesByFilm(film.id);
        await Promise.all(roles.map(r => storage.deleteFilmRole(r.id)));
        
        // Delete the film itself
        await storage.deleteFilm(film.id);
      }));

      // Delete all AI studios linked to this player game
      await Promise.all(aiStudios.map(async (aiStudio) => {
        // Delete AI studio films and their records
        const aiFilms = await storage.getFilmsByStudio(aiStudio.id);
        await Promise.all(aiFilms.map(async (film) => {
          // Delete streaming deals first (foreign key constraint)
          await storage.deleteStreamingDealsByFilm(film.id);
          
          // Delete award nominations
          const nominations = await storage.getNominationsByFilm(film.id);
          await Promise.all(nominations.map(n => storage.deleteAwardNomination(n.id)));
          
          // Delete releases
          const releases = await storage.getFilmReleasesByFilm(film.id);
          await Promise.all(releases.map(r => storage.deleteFilmRelease(r.id)));
          
          // Delete milestones
          const milestones = await storage.getFilmMilestonesByFilm(film.id);
          await Promise.all(milestones.map(m => storage.deleteFilmMilestone(m.id)));
          
          // Delete roles
          const roles = await storage.getFilmRolesByFilm(film.id);
          await Promise.all(roles.map(r => storage.deleteFilmRole(r.id)));
          
          // Delete film
          await storage.deleteFilm(film.id);
        }));
        
        // Delete TV deals for AI studio's TV shows before deleting the studio
        const aiTVShows = await storage.getTVShowsByStudio(aiStudio.id);
        await Promise.all(aiTVShows.map(show => storage.deleteTVDealsByShow(show.id)));
        
        // Delete the AI studio
        await storage.deleteStudio(aiStudio.id);
      }));

      // Reset all talent busy states so they can be hired again in new saves
      const allTalent = await storage.getAllTalent();
      await Promise.all(allTalent.map(t => 
        storage.updateTalent(t.id, { 
          currentFilmId: null, 
          busyUntilWeek: 0, 
          busyUntilYear: 0 
        })
      ));
      console.log(`[DELETE-SAVE] Reset busy states for ${allTalent.length} talent members`);

      // Delete the player studio
      await storage.deleteStudio(id);
      res.json({ message: "Save deleted" });
    } catch (error) {
      console.error("Error deleting save:", error);
      res.status(500).json({ error: "Failed to delete save" });
    }
  });

  app.patch("/api/studio/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const studio = await storage.updateStudio(id, updates);
      if (!studio) {
        return res.status(404).json({ error: "Studio not found" });
      }
      res.json(studio);
    } catch (error) {
      console.error("Error updating studio:", error);
      res.status(500).json({ error: "Failed to update studio" });
    }
  });

  app.post("/api/studio/:id/advance-week", async (req, res) => {
    try {
      const { id } = req.params;
      
      // OPTIMIZATION: Parallelize initial data fetches
      const [studio, initialStudios, initialFilms, allTalent] = await Promise.all([
        storage.getStudio(id),
        storage.getAllStudios(),
        storage.getAllFilms(),
        storage.getAllTalent()
      ]);
      
      if (!studio) {
        return res.status(404).json({ error: "Studio not found" });
      }

      let newWeek = studio.currentWeek + 1;
      let newYear = studio.currentYear;
      if (newWeek > 52) {
        newWeek = 1;
        newYear += 1;
      }

      const studioFilms = initialFilms.filter(f => f.studioId === id);
      let budgetChange = 0;

      // Get all studios and films, filter to only this game
      // For multiplayer, use gameSessionId to share AI studios across all players
      let allStudios = initialStudios;
      const isMultiplayer = !!studio.gameSessionId;
      let aiStudios = allStudios.filter(s => s.isAI && (
        isMultiplayer 
          ? s.gameSessionId === studio.gameSessionId 
          : s.playerGameId === id
      ));
      
      // Auto-create AI studios if they don't exist (for existing saves)
      if (aiStudios.length === 0) {
        const budgets = [1000000000, 1000000000, 1000000000, 1000000000, 1000000000, 1000000000, 1000000000];
        // OPTIMIZATION: Create AI studios in parallel
        await Promise.all(aiStudioNames.map((name, i) => 
          storage.createStudio({
            deviceId: studio.deviceId,
            name,
            budget: budgets[i],
            currentWeek: studio.currentWeek,
            currentYear: studio.currentYear,
            prestigeLevel: 1,
            totalEarnings: 0,
            totalAwards: 0,
            isAI: true,
            strategy: aiStrategies[i],
            playerGameId: isMultiplayer ? undefined : id,
            gameSessionId: isMultiplayer ? studio.gameSessionId : undefined,
          })
        ));
        // Re-fetch ALL studios after creating them - this is critical!
        allStudios = await storage.getAllStudios();
        aiStudios = allStudios.filter(s => s.isAI && (
          isMultiplayer 
            ? s.gameSessionId === studio.gameSessionId 
            : s.playerGameId === id
        ));
      }
      
      // OPTIMIZATION: Reuse cached allFilms instead of fetching again
      const allFilms = initialFilms;
      // Filter to ALL films that are not yet released (both player films and all AI films)
      // This ensures all films advance through phases properly
      const saveFilms = allFilms.filter(f => f.phase !== 'released' && f.status !== 'archived');

      // PARALLEL: Update all films' production progress (only this save)
      // Collect all film updates and AI studio budget changes, then execute in parallel
      const filmUpdatePromises: Promise<any>[] = [];
      const aiStudioBudgetChanges: Map<string, number> = new Map();
      
      // Helper to calculate genre multiplier
      const getGenreMultiplier = (genre: string) => {
        if (genre === 'action') return 1.3;
        if (genre === 'scifi') return 1.2;
        if (genre === 'comedy') return 0.9;
        if (genre === 'drama') return 0.8;
        if (genre === 'animation') return 1.1;
        if (genre === 'fantasy') return 1.15;
        if (genre === 'musicals') return 1.0;
        return 1.0;
      };
      
      // allTalent already fetched in parallel at the start
      const allVFXStudios = vfxStudios;
      
      // Genre-specific budget weights (impact on scores)
      const getBudgetWeights = (genre: string) => {
        const weights: Record<string, { production: number; sets: number; costumes: number; stunts: number; makeup: number }> = {
          'action': { production: 25, sets: 30, costumes: 10, stunts: 25, makeup: 10 },
          'scifi': { production: 20, sets: 35, costumes: 15, stunts: 15, makeup: 15 },
          'animation': { production: 40, sets: 10, costumes: 5, stunts: 0, makeup: 45 },
          'drama': { production: 40, sets: 15, costumes: 15, stunts: 5, makeup: 25 },
          'comedy': { production: 35, sets: 20, costumes: 20, stunts: 10, makeup: 15 },
          'horror': { production: 30, sets: 25, costumes: 15, stunts: 15, makeup: 15 },
          'romance': { production: 45, sets: 20, costumes: 20, stunts: 0, makeup: 15 },
          'thriller': { production: 30, sets: 25, costumes: 15, stunts: 20, makeup: 10 },
          'fantasy': { production: 30, sets: 35, costumes: 25, stunts: 10, makeup: 0 },
          'musicals': { production: 30, sets: 25, costumes: 35, stunts: 5, makeup: 5 },
        };
        return weights[genre] || weights['drama'];
      };
      
      // Calculate genre-specific cast quality (not just fame)
      const calculateCastQuality = (film: typeof saveFilms[0], genre: string) => {
        let criticScore = 0, audienceScore = 0;
        
        if (!film.castIds || film.castIds.length === 0) return { criticScore: 0, audienceScore: 0 };
        
        const genreSkillMap: Record<string, keyof typeof allTalent[0]> = {
          'action': 'skillAction',
          'scifi': 'skillScifi',
          'comedy': 'skillComedy',
          'drama': 'skillDrama',
          'horror': 'skillHorror',
          'animation': 'skillAnimation',
          'romance': 'skillRomance',
          'thriller': 'skillThriller',
          'fantasy': 'skillFantasy',
          'musicals': 'skillMusicals',
        };
        
        const skillKey = genreSkillMap[genre] || 'skillDrama';
        
        for (const castId of film.castIds) {
          const actor = allTalent.find(t => t.id === castId);
          if (actor) {
            const genreSkill = (actor[skillKey] as number) || 50;
            const performance = actor.performance || 50;
            const fame = actor.fame || 50;
            // Critics value performance heavily, genre skill has moderate impact
            criticScore += (performance - 50) / 3 + (genreSkill - 50) / 10;
            // Audiences value fame (stronger impact)
            audienceScore += (fame - 50) * 0.12;
          }
        }
        
        return {
          criticScore: Math.min(8, Math.max(-8, criticScore / Math.max(1, film.castIds.length))),
          audienceScore: Math.min(6, Math.max(-6, audienceScore / Math.max(1, film.castIds.length)))
        };
      };
      
      // Calculate director impact on scores
      const calculateDirectorImpact = (film: typeof saveFilms[0], genre: string) => {
        let criticScore = 0, audienceScore = 0;
        
        if (film.directorId) {
          const director = allTalent.find(t => t.id === film.directorId);
          if (director) {
            // Critics value performance + experience (increased impact)
            criticScore = ((director.performance || 50) - 50) * 0.18 + ((director.experience || 50) - 50) * 0.10;
            // Audience values fame (stronger impact)
            audienceScore = ((director.fame || 50) - 50) * 0.12;
            
            // Genre-specific director skill bonus (increased impact)
            const genreSkillMap: Record<string, keyof typeof director> = {
              'action': 'skillAction',
              'scifi': 'skillScifi',
              'comedy': 'skillComedy',
              'drama': 'skillDrama',
              'horror': 'skillHorror',
              'animation': 'skillAnimation',
              'romance': 'skillRomance',
              'thriller': 'skillThriller',
              'fantasy': 'skillFantasy',
              'musicals': 'skillMusicals',
            };
            
            const skillKey = genreSkillMap[genre];
            if (skillKey) {
              const directorGenreSkill = (director[skillKey] as number) || 50;
              criticScore += (directorGenreSkill - 50) * 0.03;
            }
          }
        }
        
        return {
          criticScore: Math.min(10, Math.max(-10, criticScore)),
          audienceScore: Math.min(6, Math.max(-6, audienceScore))
        };
      };
      
      // Calculate VFX studio impact (only for genres that need it)
      const calculateVFXImpact = (film: typeof saveFilms[0], genre: string) => {
        let bonus = 0;
        
        if (!film.vfxStudioId) return bonus;
        
        const vfxStudio = allVFXStudios.find(s => s.id === film.vfxStudioId);
        if (!vfxStudio) return bonus;
        
        // VFX importance by genre
        const vfxImportance: Record<string, number> = {
          'action': 0.30, 'scifi': 0.30, 'animation': 0.35, 'horror': 0.15,
          'fantasy': 0.25, 'musicals': 0.05
        };
        
        const importance = vfxImportance[genre] || 0.10;
        const qualityBonus = ((vfxStudio.quality || 50) - 50) * 0.08;
        
        // Specialization bonus/penalty
        const specializations = vfxStudio.specialization || [];
        const isSpecialized = specializations.some(s => s.toLowerCase() === genre.toLowerCase());
        const specializationBonus = isSpecialized ? 2 : -1;
        
        bonus = (qualityBonus + specializationBonus) * importance;
        return Math.min(8, Math.max(-3, bonus));
      };
      
      // Calculate genre-proportionate budget impact with genre-specific thresholds
      const calculateBudgetImpact = (film: typeof saveFilms[0], genre: string) => {
        const weights = getBudgetWeights(genre);
        const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
        
        // Genre-specific budget thresholds - lower for character-driven, higher for spectacle
        const genreThresholds: Record<string, { production: number; sets: number; costumes: number; stunts: number; makeup: number }> = {
          'drama': { production: 40000000, sets: 12000000, costumes: 4000000, stunts: 3000000, makeup: 1200000 },
          'comedy': { production: 35000000, sets: 10000000, costumes: 3500000, stunts: 2000000, makeup: 1000000 },
          'romance': { production: 30000000, sets: 10000000, costumes: 4000000, stunts: 1500000, makeup: 1000000 },
          'thriller': { production: 55000000, sets: 16000000, costumes: 4500000, stunts: 10000000, makeup: 2000000 },
          'horror': { production: 35000000, sets: 13000000, costumes: 4000000, stunts: 4000000, makeup: 1500000 },
          'action': { production: 130000000, sets: 40000000, costumes: 7000000, stunts: 28000000, makeup: 2500000 },
          'scifi': { production: 145000000, sets: 45000000, costumes: 8000000, stunts: 20000000, makeup: 3500000 },
          'animation': { production: 110000000, sets: 35000000, costumes: 5500000, stunts: 7000000, makeup: 2000000 },
          'fantasy': { production: 120000000, sets: 42000000, costumes: 10000000, stunts: 16000000, makeup: 4000000 },
          'musicals': { production: 70000000, sets: 28000000, costumes: 14000000, stunts: 7000000, makeup: 2500000 },
        };
        
        const thresholds = genreThresholds[genre] || genreThresholds['drama'];
        
        const production = film.productionBudget || 0;
        const sets = film.setsBudget || 0;
        const costumes = film.costumesBudget || 0;
        const stunts = film.stuntsBudget || 0;
        const makeup = film.makeupBudget || 0;
        
        const budgetScore = 
          (production / Math.max(1, thresholds.production)) * (weights.production / totalWeight) * 10 +
          (sets / Math.max(1, thresholds.sets)) * (weights.sets / totalWeight) * 8 +
          (costumes / Math.max(1, thresholds.costumes)) * (weights.costumes / totalWeight) * 6 +
          (stunts / Math.max(1, thresholds.stunts)) * (weights.stunts / totalWeight) * 7 +
          (makeup / Math.max(1, thresholds.makeup)) * (weights.makeup / totalWeight) * 5;
        
        return Math.min(10, Math.max(-3, budgetScore * 0.4));
      };
      
      const calculateScores = async (film: typeof saveFilms[0]) => {
        // Script quality: 70 is average (0 boost), 90 = +7, 50 = -7
        const qualityBoost = (film.scriptQuality - 70) * 0.35;
        // Critics base range: 52-65 (more realistic, most films land 50-70%)
        const criticRandomBase = 52 + Math.random() * 13;
        const audienceRandomBase = 50 + Math.random() * 17;
        // Reduced swing variance: ±10 instead of ±14
        const hugeCriticSwing = (Math.random() - 0.5) * 20;
        const hugeAudienceSwing = (Math.random() - 0.5) * 16;
        
        // Divisive factor: 10% chance of being a polarizing film (reduced from 15%, ±8 instead of ±10)
        const isDivisive = Math.random() < 0.10;
        const divisivePenalty = isDivisive ? (Math.random() - 0.5) * 16 : 0;
        
        // Calculate all components
        const castQuality = calculateCastQuality(film, film.genre);
        const directorImpact = calculateDirectorImpact(film, film.genre);
        const budgetImpact = calculateBudgetImpact(film, film.genre);
        const vfxImpact = calculateVFXImpact(film, film.genre);
        
        let genreBonus = 0, audienceGenreBonus = 0;
        if (film.genre === 'drama') { genreBonus = 6; audienceGenreBonus = -2; }
        else if (film.genre === 'action') { genreBonus = -6; audienceGenreBonus = 3; }
        else if (film.genre === 'comedy') { genreBonus = -2; audienceGenreBonus = 3; }
        else if (film.genre === 'horror') { genreBonus = -10; audienceGenreBonus = 2; }
        else if (film.genre === 'scifi') { genreBonus = 0; audienceGenreBonus = 2; }
        else if (film.genre === 'animation') { genreBonus = 4; audienceGenreBonus = 4; }
        else if (film.genre === 'fantasy') { genreBonus = 2; audienceGenreBonus = 3; }
        else if (film.genre === 'musicals') { genreBonus = 6; audienceGenreBonus = 1; }
        
        const rawCriticScore = criticRandomBase + hugeCriticSwing + qualityBoost + genreBonus + 
                              directorImpact.criticScore + budgetImpact + vfxImpact + castQuality.criticScore + divisivePenalty;
        const rawAudienceScore = audienceRandomBase + hugeAudienceSwing + qualityBoost + audienceGenreBonus + 
                               directorImpact.audienceScore + budgetImpact + vfxImpact + castQuality.audienceScore + 12;
        
        const criticBreakdown = {
          randomBase: Math.round(criticRandomBase * 100) / 100,
          criticSwing: Math.round(hugeCriticSwing * 100) / 100,
          qualityBoost: Math.round(qualityBoost * 100) / 100,
          genreBonus,
          directorCriticImpact: Math.round(directorImpact.criticScore * 100) / 100,
          budgetImpact: Math.round(budgetImpact * 100) / 100,
          vfxImpact: Math.round(vfxImpact * 100) / 100,
          castCriticQuality: Math.round(castQuality.criticScore * 100) / 100,
          divisivePenalty: Math.round(divisivePenalty * 100) / 100,
          totalCriticScore: Math.round(rawCriticScore * 100) / 100
        };

        const audienceBreakdown = {
          randomBase: Math.round(audienceRandomBase * 100) / 100,
          audienceSwing: Math.round(hugeAudienceSwing * 100) / 100,
          qualityBoost: Math.round(qualityBoost * 100) / 100,
          audienceGenreBonus,
          directorAudienceImpact: Math.round(directorImpact.audienceScore * 100) / 100,
          castAudienceQuality: Math.round(castQuality.audienceScore * 100) / 100,
          budgetImpact: Math.round(budgetImpact * 100) / 100,
          vfxImpact: Math.round(vfxImpact * 100) / 100,
          totalAudienceScore: Math.round(rawAudienceScore * 100) / 100
        };
        
        
        return {
          criticScore: Math.min(100, Math.max(20, Math.floor(rawCriticScore))),
          audienceScore: Math.min(10, Math.max(2, Math.round((rawAudienceScore / 10) * 10) / 10)),
          criticBreakdown,
          audienceBreakdown
        };
      };
      
      for (const film of saveFilms) {
        const filmStudio = allStudios.find(s => s.id === film.studioId);
        const isAIStudio = filmStudio?.isAI === true;
        
        // Removed verbose AI film tracking log for performance
        
        if (film.phase !== 'released') {
          // Normal phase progression - no more force-releasing based on stale releaseWeek
          let weeksInPhase = (film.weeksInCurrentPhase || 0) + 1;
          let currentPhase = film.phase;
            
            if (currentPhase === 'development' && weeksInPhase >= (film.developmentDurationWeeks || 2)) {
              currentPhase = 'awaiting-greenlight';
              weeksInPhase = 1;
            } else if (currentPhase === 'awaiting-greenlight' && film.hasHiredTalent === true && weeksInPhase >= 1) {
              currentPhase = 'pre-production';
              weeksInPhase = 0;
            } else if (currentPhase === 'pre-production' && weeksInPhase >= (film.preProductionDurationWeeks || 2)) {
              currentPhase = 'production';
              weeksInPhase = 0;
            } else if (currentPhase === 'production' && weeksInPhase >= (film.productionDurationWeeks || 4)) {
              currentPhase = 'filmed';
              weeksInPhase = 1;
            } else if (currentPhase === 'filmed' && weeksInPhase >= 1) {
              // Filmed phase - player films wait for edit, AI films auto-advance
              if (isAIStudio) {
                // AI films automatically advance from filmed to post-production
                currentPhase = 'post-production';
                weeksInPhase = 0;
              } else if (film.hasEditedPostProduction === true) {
                // Player films only advance when they've edited post-production
                currentPhase = 'post-production';
                weeksInPhase = 0;
              }
              // Otherwise stay in filmed with weeks incrementing (waiting for player action)
            } else if (currentPhase === 'post-production' && weeksInPhase >= (film.postProductionDurationWeeks || 2)) {
              // Post-production complete - check if player or AI
              const filmStudio = allStudios.find(s => s.id === film.studioId);
              const isAIFilm = filmStudio?.isAI === true;
              
              if (isAIFilm) {
                // AI films skip production-complete and go directly to released
                currentPhase = 'released';
                weeksInPhase = 0;
                
                // Calculate scores for the release (await since calculateScores is now async)
                const { criticScore, audienceScore, criticBreakdown, audienceBreakdown } = await calculateScores(film);
                const theaterCount = Math.floor(3500 + (film.productionBudget / 40000000) * 3000);
                
                // Create territory releases for AI film so box office simulation works
                // SAFETY: Only create releases for AI films, never for player films
                const existingReleases = await storage.getFilmReleasesByFilm(film.id);
                if (existingReleases.length === 0 && filmStudio?.isAI === true) {
                  const allTerritories = BOX_OFFICE_COUNTRIES.map(c => c.code);
                  const firstTerritory = allTerritories[0];
                  const safeMarketingBudget = film.marketingBudget || Math.floor(film.productionBudget * 0.8);
                  console.log(`[AI-AUTO-RELEASE] ${film.title} - Creating releases for all ${allTerritories.length} territories`);
                  
                  await Promise.all(allTerritories.map(territory => 
                    storage.createFilmRelease({
                      filmId: film.id,
                      territoryCode: territory,
                      releaseWeek: newWeek,
                      releaseYear: newYear,
                      productionBudget: film.productionBudget,
                      marketingBudget: territory === firstTerritory ? safeMarketingBudget : 0,
                      isReleased: false,
                      weeklyBoxOffice: [],
                      totalBoxOffice: 0,
                      theaterCount: 0,
                      weeksInRelease: 0,
                    })
                  ));
                }
                
                filmUpdatePromises.push(storage.updateFilm(film.id, {
                  phase: 'released',
                  releaseWeek: newWeek,
                  releaseYear: newYear,
                  weeklyBoxOffice: [],
                  weeklyBoxOfficeByCountry: [],
                  totalBoxOffice: 0,
                  totalBoxOfficeByCountry: {},
                  audienceScore: Math.round(audienceScore * 10) / 10,
                  criticScore,
                  criticScoreBreakdown: criticBreakdown,
                  audienceScoreBreakdown: audienceBreakdown,
                  theaterCount,
                  awards: [],
                }));
                continue;
              } else {
                // Player films go to production-complete (waiting for release scheduling)
                currentPhase = 'production-complete';
                weeksInPhase = 0;
              }
            }
            
            // Check if production-complete film has territory releases scheduled (player films only)
            if (currentPhase === 'production-complete') {
              const releases = await storage.getFilmReleasesByFilm(film.id);
              if (releases && releases.length > 0) {
                currentPhase = 'awaiting-release';
                weeksInPhase = 0;
              }
            }
            
            // Check if awaiting-release film has reached its earliest release date
            if (currentPhase === 'awaiting-release') {
              const releases = await storage.getFilmReleasesByFilm(film.id);
              if (releases && releases.length > 0) {
                // Find earliest release date
                let earliestWeek = releases[0].releaseWeek;
                let earliestYear = releases[0].releaseYear;
                for (const release of releases) {
                  if (release.releaseYear < earliestYear || 
                      (release.releaseYear === earliestYear && release.releaseWeek < earliestWeek)) {
                    earliestWeek = release.releaseWeek;
                    earliestYear = release.releaseYear;
                  }
                }
                
                // Check if we've reached the earliest release date
                if (earliestYear < newYear || 
                    (earliestYear === newYear && earliestWeek <= newWeek)) {
                  currentPhase = 'released';
                  weeksInPhase = 0;
                  
                  // Calculate scores for the release (await since calculateScores is now async)
                  const { criticScore, audienceScore, criticBreakdown, audienceBreakdown } = await calculateScores(film);
                  const theaterCount = Math.floor(3500 + (film.productionBudget / 40000000) * 3000);
                  
                  filmUpdatePromises.push(storage.updateFilm(film.id, {
                    phase: 'released',
                    weeklyBoxOffice: [],
                    weeklyBoxOfficeByCountry: [],
                    totalBoxOffice: 0,
                    totalBoxOfficeByCountry: {},
                    audienceScore: Math.round(audienceScore * 10) / 10,
                    criticScore,
                    criticScoreBreakdown: criticBreakdown,
                    audienceScoreBreakdown: audienceBreakdown,
                    theaterCount,
                    awards: [],
                  }));
                  continue;
                }
              }
            }
            
            // Update phase and weeks normally
            filmUpdatePromises.push(storage.updateFilm(film.id, {
              phase: currentPhase,
              weeksInCurrentPhase: weeksInPhase,
            } as any));
        }
      }
      
      // Execute all film phase updates in parallel
      await Promise.all(filmUpdatePromises);

      // PARALLEL: Handle box office for released films (only this save)
      // Re-fetch films after phase updates to include newly released films
      const updatedAllFilms = await storage.getAllFilms();
      const updatedSaveFilms = updatedAllFilms.filter(f => {
        const filmStudio = allStudios.find(s => s.id === f.studioId);
        return filmStudio && (filmStudio.id === id || filmStudio.playerGameId === id);
      });
      
      // Include all released films - we'll handle empty weeklyBoxOffice in the loop
      const saveReleasedFilms = updatedSaveFilms.filter(f => f.phase === 'released' && f.status !== 'archived');
      
      const filmReleasesMap = new Map<string, Awaited<ReturnType<typeof storage.getFilmReleasesByFilm>>>();
      
      // Parallel fetch all film releases
      const releaseFetchPromises = saveReleasedFilms.map(async film => {
        const releases = await storage.getFilmReleasesByFilm(film.id);
        filmReleasesMap.set(film.id, releases);
      });
      await Promise.all(releaseFetchPromises);
      
      // Collect all box office updates
      const boxOfficeUpdatePromises: Promise<any>[] = [];
      
      for (const film of saveReleasedFilms) {
        const filmReleases = filmReleasesMap.get(film.id);
        
        if (!filmReleases || filmReleases.length === 0) {
          // Skip films without territory releases
          continue;
        }
        
        if (filmReleases && filmReleases.length > 0) {
          // Marketing budget is stored only on ONE release (global budget, not per-territory)
          const releaseWithMarketing = filmReleases.find(r => r.marketingBudget && r.marketingBudget > 0);
          const marketingBudgetAtRelease = releaseWithMarketing?.marketingBudget || film.marketingBudget || 0;
          
          // Use totalBudget for box office calculations (includes all production costs)
          const investmentBudgetAtRelease = film.totalBudget || (film.productionBudget || 0);
          
          // Calculate marketing multiplier as ratio of marketing to investment (capped at 1.0)
          const marketingRatio = Math.min(1.0, marketingBudgetAtRelease / (investmentBudgetAtRelease || 1));
          const globalMarketingMultiplier = marketingRatio;
          
          // Calculate global weekly box office with quality/genre/decay modifiers
          let globalWeeklyGross = 0;
          const firstRelease = filmReleases[0];
          const releaseWeekNum = firstRelease.releaseYear * 52 + firstRelease.releaseWeek;
          const currentWeekNum = newYear * 52 + newWeek;
          const weeksOut = currentWeekNum - releaseWeekNum;
          
          // Validate that weeksOut matches weeklyBoxOffice.length
          // weeksOut should equal weeklyBoxOffice.length (0 entries = week 0, 1 entry = week 1, etc.)
          const expectedWeeksOut = film.weeklyBoxOffice.length;
          
          // Use weeklyBoxOffice.length as the source of truth for how many weeks the film has been out
          // This prevents issues where release date calculations don't match actual recorded data
          const actualWeeksOut = film.weeklyBoxOffice.length;
          
          // Check if this is truly opening week - no weekly data exists yet
          const isOpeningWeek = actualWeeksOut === 0;
          
          // Mark films that have reached 24 weeks as archived (theatrical run complete)
          if (actualWeeksOut >= 24) {
            if (film.status !== 'archived') {
              await storage.updateFilm(film.id, {
                status: 'archived',
                archivedWeek: newWeek,
                archivedYear: newYear,
              });
            }
            continue;
          }
          
          if (isOpeningWeek) {
            // Opening weekend - calculate global opening using PRODUCTION INVESTMENT BUDGET (production + talent + crew + composer + VFX)
            // NOTE: Marketing is handled separately as its own multiplier
            const qualityFactor = (film.scriptQuality || 70) / 100;
            const genreMultiplier = getGenreMultiplier(film.genre);
            const marketingMultiplier = globalMarketingMultiplier;
            const audienceBoost = getAudienceMultiplier(film.audienceScore || 7);
            
            // Investment budget = totalBudget minus marketing
            let investmentBudget = investmentBudgetAtRelease;
            
            // Production budget is a one-time GLOBAL cost, not split per territory
            // Use full investment budget for all territory opening calculations
            const clampedInvestmentBudget1 = clampInvestmentBudgetByGenre(investmentBudget, film.genre);
            const randomLuck = 0.5 + Math.random() * 0.8;
            
            // Sequel boost: sequels get a 25-40% opening weekend boost due to built-in audience
            let sequelBoost = 1.0;
            if (film.isSequel && film.prequelFilmId) {
              const prequelFilm = await storage.getFilm(film.prequelFilmId);
              if (prequelFilm && prequelFilm.totalBoxOffice) {
                // Bigger boost for successful prequels (25% base + up to 15% based on prequel success)
                const prequelSuccessRatio = Math.min(prequelFilm.totalBoxOffice / 500000000, 1);
                sequelBoost = 1.25 + (prequelSuccessRatio * 0.15);
              } else {
                sequelBoost = 1.25; // Base 25% boost even without prequel data
              }
            }
            
            // Holiday modifier: certain weeks boost or hurt box office based on genre
            const holidayModifier = getGenreHolidayModifier(firstRelease.releaseWeek, film.genre);
            const holiday = getHolidayForWeek(firstRelease.releaseWeek);
            
            const qualityModifier = 0.5 + qualityFactor * 0.8;
            globalWeeklyGross = clampedInvestmentBudget1 * randomLuck * marketingMultiplier * 
              qualityModifier * genreMultiplier * audienceBoost * sequelBoost * holidayModifier;
            
            console.log(`[OPENING-WEEKEND] ${film.title} (${film.genre}):
  investmentBudget=$${Math.round(investmentBudgetAtRelease/1000000)}M, marketingBudget=$${Math.round(marketingBudgetAtRelease/1000000)}M, marketingMult=${marketingMultiplier.toFixed(3)}
  CALCULATION: $${Math.round(clampedInvestmentBudget1/1000000)}M × ${randomLuck.toFixed(2)} × ${marketingMultiplier.toFixed(2)} × ${qualityModifier.toFixed(2)} × ${genreMultiplier} × ${audienceBoost.toFixed(2)} × ${sequelBoost.toFixed(2)} × ${holidayModifier.toFixed(2)} = $${Math.round(globalWeeklyGross/1000000)}M`);
            
          } else {
            // Subsequent weeks (actualWeeksOut > 0) - apply decay with quality/genre modifiers
            const lastWeekGross = film.weeklyBoxOffice[film.weeklyBoxOffice.length - 1] || 0;
            
            // If somehow no previous gross, just return 0 for this week
            if (!lastWeekGross || isNaN(lastWeekGross)) {
              globalWeeklyGross = 0;
            } else {
              // Week-based decay with audience score modifiers - boosted for better legs
              const audienceScore = (film.audienceScore || 7) * 10; // Convert to 0-100 scale
              // Tiered coefficient: higher scores get much better holds
              let coefficient = 0.60;
              if (audienceScore >= 90) coefficient = 0.85;
              else if (audienceScore >= 80) coefficient = 0.78;
              else if (audienceScore >= 70) coefficient = 0.72;
              let baseHold = (audienceScore / 100) * coefficient;
              
              // Week-based decay: films drop faster in later weeks
              const weekNumber = actualWeeksOut + 1; // Current week (1-indexed)
              let weekDecayMultiplier = 1.0;
              if (weekNumber <= 3) {
                weekDecayMultiplier = 1.0; // Weeks 1-3: normal hold
              } else if (weekNumber <= 6) {
                weekDecayMultiplier = 0.90; // Weeks 4-6: 10% faster drop
              } else if (weekNumber <= 12) {
                weekDecayMultiplier = 0.80; // Weeks 7-12: 20% faster drop
              } else {
                weekDecayMultiplier = 0.70; // Weeks 13+: 30% faster drop
              }
              
              let hold = baseHold * weekDecayMultiplier;
              
              // Check if film is on a streaming service - apply faster decay
              const filmStreamingDeals = await storage.getStreamingDealsByFilm(film.id);
              const hasActiveStreamingDeal = filmStreamingDeals.some(deal => deal.isActive);
              if (hasActiveStreamingDeal) {
                // Films on streaming drop 25-35% faster at box office
                hold = hold * 0.70; // Reduce hold by 30%
              }
              
              // Apply ±15% randomness (increased from 10%)
              const randomMultiplier = 1 + (Math.random() - 0.5) * 0.30;
              hold = hold * randomMultiplier;
              
              // Bound hold between 15% and 70% (lower minimum for streaming films)
              hold = Math.max(hasActiveStreamingDeal ? 0.15 : 0.20, Math.min(0.70, hold));
              
              globalWeeklyGross = Math.floor(lastWeekGross * hold);
            }
          }
          
          // Round box office to nearest dollar (database expects integers)
          globalWeeklyGross = Math.round(globalWeeklyGross);
          
          // Distribute global box office to territories using fixed percentages
          // Use stored percentages if available, otherwise generate new ones (first week)
          // Genre affects domestic/international split
          let territoryPcts = film.territoryPercentages as Record<string, number> | null;
          if (!territoryPcts || Object.keys(territoryPcts).length === 0) {
            territoryPcts = generateTerritoryPercentages(film.genre);
          }
          const weeklyByCountry = globalWeeklyGross > 0 ? distributeBoxOfficeWithFixedPercentages(globalWeeklyGross, territoryPcts) : {};
          const releaseUpdatePromises: Promise<any>[] = [];
          
          for (const release of filmReleases) {
            const countryName = getCountryName(release.territoryCode) || release.territoryCode;
            const territoryGross = weeklyByCountry[countryName] || 0;
            
            if (territoryGross > 0) {
              releaseUpdatePromises.push(storage.updateFilmRelease(release.id, {
                weeklyBoxOffice: [...(release.weeklyBoxOffice || []), Math.round(territoryGross)],
                totalBoxOffice: (release.totalBoxOffice || 0) + Math.round(territoryGross),
              }));
            }
          }
          
          // Queue release updates
          boxOfficeUpdatePromises.push(...releaseUpdatePromises);
          
          // Safety check: ensure values are valid numbers, not NaN
          if (isNaN(globalWeeklyGross) || globalWeeklyGross < 0) {
            globalWeeklyGross = 0;
          }
          
          // Always record weekly box office (even if $0) so week count advances properly
          const newWeeklyBoxOffice = [...film.weeklyBoxOffice, Math.round(globalWeeklyGross)];
          const newTotalBoxOffice = (film.totalBoxOffice || 0) + Math.round(globalWeeklyGross);
          const newWeeklyByCountry = [...(Array.isArray(film.weeklyBoxOfficeByCountry) ? film.weeklyBoxOfficeByCountry : []), weeklyByCountry];
          
          const newTotalByCountry = { ...(typeof film.totalBoxOfficeByCountry === 'object' && film.totalBoxOfficeByCountry !== null ? film.totalBoxOfficeByCountry as Record<string, number> : {}) };
          for (const [country, amount] of Object.entries(weeklyByCountry)) {
            newTotalByCountry[country] = (newTotalByCountry[country] || 0) + Math.round(amount || 0);
          }
          
          // Include territoryPercentages in update if this is the first week (to store them)
          const filmUpdate: any = {
            weeklyBoxOffice: newWeeklyBoxOffice,
            weeklyBoxOfficeByCountry: newWeeklyByCountry,
            totalBoxOffice: newTotalBoxOffice,
            totalBoxOfficeByCountry: newTotalByCountry,
          };
          // Store territory percentages on first week so they stay fixed
          if (!film.territoryPercentages || Object.keys(film.territoryPercentages as object).length === 0) {
            filmUpdate.territoryPercentages = territoryPcts;
          }
          boxOfficeUpdatePromises.push(storage.updateFilm(film.id, filmUpdate));
          
          // Only credit studio if there's actual earnings
          if (globalWeeklyGross > 0) {
            const studioShare = Math.floor(globalWeeklyGross * 0.7);
            if (film.studioId === id) {
              budgetChange += studioShare;
            } else {
              aiStudioBudgetChanges.set(film.studioId, (aiStudioBudgetChanges.get(film.studioId) || 0) + studioShare);
            }
          }
        } else {
          // Legacy fallback: No territory releases
          // If weeklyBoxOffice is empty, this is opening week - calculate opening box office
          if (!film.weeklyBoxOffice || film.weeklyBoxOffice.length === 0) {
            const qualityFactor = (film.scriptQuality || 70) / 100;
            const genreMultiplier = getGenreMultiplier(film.genre);
            // Use totalBudget for box office calculations
            let totalInvestmentBudget = film.totalBudget || (film.productionBudget || 0);
            const marketingMultiplier = film.marketingBudget ? (film.marketingBudget / (totalInvestmentBudget || 1)) : 0.15;
            const audienceBoost = getAudienceMultiplier(film.audienceScore || 7);
            
            // Use totalBudget for investment budget
            let investmentBudget = film.totalBudget || (film.productionBudget || 0);
            
            // Add VFX studio cost if hired (MUST be before composer check for correct order)
            if (film.vfxStudioId) {
              const vfxStudio = vfxStudios.find(s => s.id === film.vfxStudioId);
              if (vfxStudio) {
                investmentBudget += vfxStudio.cost || 0;
                console.log(`[VFX-COST] ${film.title}: Added VFX studio ${vfxStudio.name} cost ${vfxStudio.cost} to investment budget`);
              }
            }
            
            // Add composer cost if hired
            if (film.composerId) {
              const allTalent = await storage.getAllTalent();
              const composer = allTalent.find(t => t.id === film.composerId);
              if (composer) {
                investmentBudget += composer.askingPrice || 0;
              }
            }
            
            const clampedInvestmentBudget2 = clampInvestmentBudgetByGenre(investmentBudget, film.genre);
            const randomFactor = (0.5 + Math.random() * 0.8);
            const qualityModifier = (0.5 + qualityFactor * 0.8);
            
            // Sequel boost: sequels get a 25-40% opening weekend boost due to built-in audience
            let sequelBoost = 1.0;
            if (film.isSequel && film.prequelFilmId) {
              const prequelFilm = await storage.getFilm(film.prequelFilmId);
              if (prequelFilm && prequelFilm.totalBoxOffice) {
                const prequelSuccessRatio = Math.min(prequelFilm.totalBoxOffice / 500000000, 1);
                sequelBoost = 1.25 + (prequelSuccessRatio * 0.15);
              } else {
                sequelBoost = 1.25;
              }
            }
            
            // Holiday modifier: certain weeks boost or hurt box office based on genre
            const holidayModifier = getGenreHolidayModifier(film.releaseWeek || 1, film.genre);
            const holiday = getHolidayForWeek(film.releaseWeek || 1);
            
            const globalWeeklyGross = Math.round(clampedInvestmentBudget2 * randomFactor * marketingMultiplier * 
              qualityModifier * genreMultiplier * audienceBoost * sequelBoost * holidayModifier);
            
            console.log(`[OPENING-NO-RELEASES] ${film.title} (${film.genre}): investBudget=${Math.round(investmentBudget)}, marketingBudget=${film.marketingBudget}, marketingMult=${marketingMultiplier.toFixed(2)}, random=${randomFactor.toFixed(2)}, quality=${qualityModifier.toFixed(2)}, genre=${genreMultiplier}, audience=${audienceBoost.toFixed(2)}, sequelBoost=${sequelBoost.toFixed(2)}, holidayMod=${holidayModifier.toFixed(2)}${holiday ? ` (${holiday.name})` : ''}, GROSS=${globalWeeklyGross}`);
            
            const newWeeklyBoxOffice = [globalWeeklyGross];
            const newTotalBoxOffice = globalWeeklyGross;
            // Generate and store fixed territory percentages for this film's first week
            // Genre affects domestic/international split
            const aiTerritoryPcts = generateTerritoryPercentages(film.genre);
            const weeklyByCountry = globalWeeklyGross > 0 ? distributeBoxOfficeWithFixedPercentages(globalWeeklyGross, aiTerritoryPcts) : {};
            const newWeeklyByCountry = [weeklyByCountry];
            
            const newTotalByCountry: Record<string, number> = {};
            for (const [country, amount] of Object.entries(weeklyByCountry)) {
              newTotalByCountry[country] = Math.round(amount || 0);
            }
            
            boxOfficeUpdatePromises.push(storage.updateFilm(film.id, {
              weeklyBoxOffice: newWeeklyBoxOffice,
              weeklyBoxOfficeByCountry: newWeeklyByCountry,
              totalBoxOffice: newTotalBoxOffice,
              totalBoxOfficeByCountry: newTotalByCountry,
              territoryPercentages: aiTerritoryPcts,
            }));
            
            // Credit studio if there's earnings
            if (globalWeeklyGross > 0) {
              const studioShare = Math.floor(globalWeeklyGross * 0.7);
              if (film.studioId === id) {
                budgetChange += studioShare;
              } else {
                aiStudioBudgetChanges.set(film.studioId, (aiStudioBudgetChanges.get(film.studioId) || 0) + studioShare);
              }
            }
            continue;
          }
          
          const lastWeek = film.weeklyBoxOffice[film.weeklyBoxOffice.length - 1];
          
          // Week-based decay with audience score modifiers - boosted for better legs
          const audienceScore = (film.audienceScore || 7) * 10; // Convert to 0-100 scale
          // Tiered coefficient: higher scores get much better holds
          let coefficient = 0.60;
          if (audienceScore >= 90) coefficient = 0.85;
          else if (audienceScore >= 80) coefficient = 0.78;
          else if (audienceScore >= 70) coefficient = 0.72;
          let baseHold = (audienceScore / 100) * coefficient;
          
          // Week-based decay: films drop faster in later weeks
          const weekNumber = film.weeklyBoxOffice.length + 1; // Current week (1-indexed)
          let weekDecayMultiplier = 1.0;
          if (weekNumber <= 3) {
            weekDecayMultiplier = 1.0; // Weeks 1-3: normal hold
          } else if (weekNumber <= 6) {
            weekDecayMultiplier = 0.90; // Weeks 4-6: 10% faster drop
          } else if (weekNumber <= 12) {
            weekDecayMultiplier = 0.80; // Weeks 7-12: 20% faster drop
          } else {
            weekDecayMultiplier = 0.70; // Weeks 13+: 30% faster drop
          }
          
          let hold = baseHold * weekDecayMultiplier;
          
          // Apply ±15% randomness (increased from 10%)
          const randomMultiplier = 1 + (Math.random() - 0.5) * 0.30;
          hold = hold * randomMultiplier;
          
          // Bound hold between 20% and 80% (raised cap for great films)
          hold = Math.max(0.20, Math.min(0.80, hold));
          
          const newGross = Math.floor(lastWeek * hold);
          
          // Always record weekly box office (even if $0) so week count advances properly
          const newWeeklyBoxOffice = [...film.weeklyBoxOffice, newGross];
          const newTotalBoxOffice = film.totalBoxOffice + newGross;
          // Use stored territory percentages (should already exist from first week)
          const aiStoredPcts = film.territoryPercentages as Record<string, number> | null;
          const weeklyByCountry = (newGross > 0 && aiStoredPcts && Object.keys(aiStoredPcts).length > 0) 
            ? distributeBoxOfficeWithFixedPercentages(newGross, aiStoredPcts) 
            : {};
          const newWeeklyByCountry = [...(Array.isArray(film.weeklyBoxOfficeByCountry) ? film.weeklyBoxOfficeByCountry : []), weeklyByCountry];
          
          const newTotalByCountry = { ...(typeof film.totalBoxOfficeByCountry === 'object' && film.totalBoxOfficeByCountry !== null ? film.totalBoxOfficeByCountry as Record<string, number> : {}) };
          for (const [country, amount] of Object.entries(weeklyByCountry)) {
            newTotalByCountry[country] = (newTotalByCountry[country] || 0) + amount;
          }
          
          boxOfficeUpdatePromises.push(storage.updateFilm(film.id, {
            weeklyBoxOffice: newWeeklyBoxOffice,
            weeklyBoxOfficeByCountry: newWeeklyByCountry,
            totalBoxOffice: newTotalBoxOffice,
            totalBoxOfficeByCountry: newTotalByCountry,
          } as any));
          
          // Only credit studio if there's actual earnings
          if (newGross > 0 && film.studioId === id) {
            const studioShare = Math.floor(newGross * 0.7);
            budgetChange += studioShare;
          }
        }
      }
      
      // Execute all box office updates in parallel
      await Promise.all(boxOfficeUpdatePromises);

      // Archive films that have completed 12+ weeks and are earning < $100K
      // Re-fetch films to get updated box office data after this week's update
      const updatedFilms = await storage.getAllFilms();
      const archivePromises: Promise<any>[] = [];
      for (const film of updatedFilms) {
        if (film.phase === 'released' && film.status !== 'archived' && film.weeklyBoxOffice.length >= 12) {
          const lastWeek = film.weeklyBoxOffice[film.weeklyBoxOffice.length - 1] || 0;
          
          // Archive ONLY if: exactly hit 12 weeks or more AND last week earnings < $100K
          if (lastWeek < 100000) {
            archivePromises.push(storage.updateFilm(film.id, {
              status: 'archived',
              archivedWeek: newWeek,
              archivedYear: newYear,
            }));
          }
        }
      }
      await Promise.all(archivePromises);

      // FREE TALENT whose busy period has ended
      const allTalentNow = await storage.getAllTalent();
      const talentReleasePromises: Promise<any>[] = [];
      for (const talent of allTalentNow) {
        if (talent.currentFilmId && talent.busyUntilWeek && talent.busyUntilYear) {
          // Check if current week/year has passed their busy_until date
          const shouldBeFree = 
            newYear > talent.busyUntilYear || 
            (newYear === talent.busyUntilYear && newWeek >= talent.busyUntilWeek);
          
          if (shouldBeFree) {
            talentReleasePromises.push(storage.updateTalent(talent.id, {
              currentFilmId: null,
              busyUntilWeek: null,
              busyUntilYear: null,
            }));
          }
        }
      }
      if (talentReleasePromises.length > 0) {
        await Promise.all(talentReleasePromises);
      }

      // HIRE TALENT for existing films that don't have crew (catch-up for older films)
      const filmsNeedingTalent = saveFilms.filter(f => 
        f.phase !== 'released' && 
        f.status !== 'archived' && 
        (!f.directorId || !f.writerId || !f.castIds || f.castIds.length === 0)
      );
      
      for (const film of filmsNeedingTalent) {
        const filmStudio = allStudios.find(s => s.id === film.studioId);
        if (filmStudio && filmStudio.isAI) {
          try {
            await hireAITalent(film.id, film.genre, filmStudio);
          } catch (err) {
            console.error(`[TALENT-CATCHUP-ERROR] Failed for "${film.title}":`, err);
          }
        }
      }

      // PARALLEL: Update player studio and all AI studios' weeks/budgets together
      const AI_MINIMUM_BUDGET = 50000000; // $50M minimum budget floor
      const MAX_INT32 = 2147483647; // Maximum 32-bit integer (database limit)
      const studioUpdatePromises: Promise<any>[] = [];
      const aiStudiosWithWeeks: Array<{id: string, oldStudio: typeof aiStudios[0], aiNewWeek: number, aiNewYear: number, updatedBudget: number}> = [];
      
      // Calculate slate financing deductions from box office profits
      let slateFinancingDeduction = 0;
      const slateDeals = await storage.getActiveSlateFinancingDeals(id);
      
      // Only deduct if there are profits (positive budgetChange) and active deals
      if (budgetChange > 0 && slateDeals.length > 0) {
        // Count films that just released (transitioned to released phase) this week
        const filmsReleasedThisWeek = saveFilms.filter(f => 
          f.phase === 'releasing' && // Still in releasing phase before update
          f.studioId === id &&
          f.releaseWeek === studio.currentWeek &&
          f.releaseYear === studio.currentYear
        );
        
        // For each active slate deal, deduct profit share and update deal
        for (const deal of slateDeals) {
          if (deal.filmsRemaining > 0) {
            // Calculate investor's share of this week's profits
            const investorShare = Math.floor(budgetChange * (deal.profitSharePercent / 100));
            slateFinancingDeduction += investorShare;
            
            // Determine if any new films were released under this deal
            const newFilmsReleased = filmsReleasedThisWeek.length > 0 ? 1 : 0;
            const newFilmsRemaining = Math.max(0, deal.filmsRemaining - newFilmsReleased);
            
            // Update the slate financing deal
            await storage.updateSlateFinancingDeal(deal.id, {
              filmsCompleted: deal.filmsCompleted + newFilmsReleased,
              filmsRemaining: newFilmsRemaining,
              totalProfitPaid: deal.totalProfitPaid + investorShare,
              isActive: newFilmsRemaining > 0, // Deactivate when all films are done
            });
            
            if (investorShare > 0) {
              // Investor receives their share
            }
          }
        }
      }
      
      // Player studio update (subtract slate financing deductions from profits)
      const adjustedBudgetChange = budgetChange - slateFinancingDeduction;
      const playerNewBudget = Math.min(studio.budget + adjustedBudgetChange, MAX_INT32);
      const playerNewEarnings = Math.min(studio.totalEarnings + adjustedBudgetChange, MAX_INT32);
      studioUpdatePromises.push(storage.updateStudio(id, {
        currentWeek: newWeek,
        currentYear: newYear,
        budget: playerNewBudget,
        totalEarnings: playerNewEarnings,
      }));
      
      // Calculate AI studio updates and prepare for parallel execution
      for (const aiStudio of aiStudios) {
        let aiNewWeek = aiStudio.currentWeek + 1;
        let aiNewYear = aiStudio.currentYear;
        if (aiNewWeek > 52) {
          aiNewWeek = 1;
          aiNewYear += 1;
        }
        
        // Include accumulated box office earnings + top-up if needed
        const accumulatedEarnings = aiStudioBudgetChanges.get(aiStudio.id) || 0;
        let newBudget = Math.min(aiStudio.budget + accumulatedEarnings, MAX_INT32);
        
        if (newBudget < AI_MINIMUM_BUDGET) {
          const topUp = AI_MINIMUM_BUDGET + Math.floor(Math.random() * 50000000);
          newBudget = topUp;
        }
        
        const aiNewEarnings = Math.min(aiStudio.totalEarnings + accumulatedEarnings, MAX_INT32);
        studioUpdatePromises.push(storage.updateStudio(aiStudio.id, {
          currentWeek: aiNewWeek,
          currentYear: aiNewYear,
          budget: newBudget,
          totalEarnings: aiNewEarnings,
        }));
        
        aiStudiosWithWeeks.push({id: aiStudio.id, oldStudio: { ...aiStudio, budget: newBudget }, aiNewWeek, aiNewYear, updatedBudget: newBudget});
      }
      
      // Execute all studio updates in parallel
      await Promise.all(studioUpdatePromises);
      // AI logic: create and release films (sequential to avoid budget race conditions)
      for (let studioIndex = 0; studioIndex < aiStudiosWithWeeks.length; studioIndex++) {
        const {id: aiStudioId, oldStudio: aiStudio, aiNewWeek, aiNewYear, updatedBudget} = aiStudiosWithWeeks[studioIndex];
        // AI creates new films every 4 weeks with 75% chance
        // Each studio is offset by its index (0, 1, 2, 3...) to stagger releases across weeks
        const studioOffset = studioIndex % 4;
        const isStudioWeek = (aiNewWeek + studioOffset) % 4 === 0;
        const randomRoll = Math.random();
        const meetsRandomChance = randomRoll < 0.75;
        const hasSufficientBudget = updatedBudget > 15000000;
        
        if (isStudioWeek && meetsRandomChance && hasSufficientBudget) {
          const genre = GENRES[Math.floor(Math.random() * GENRES.length)] as keyof typeof filmTitles;
          
          const titleList = filmTitles[genre];
          const title = titleList[Math.floor(Math.random() * titleList.length)];
          
          // Genre-based budget allocation (based on real-world industry data)
          let prodBudget: number;
          if (genre === 'action' || genre === 'scifi') {
            prodBudget = 40000000 + Math.random() * 90000000; // 40M-130M
          } else if (genre === 'animation') {
            prodBudget = 30000000 + Math.random() * 90000000; // 30M-120M
          } else if (genre === 'fantasy') {
            prodBudget = 50000000 + Math.random() * 80000000; // 50M-130M
          } else if (genre === 'thriller') {
            prodBudget = 15000000 + Math.random() * 65000000; // 15M-80M
          } else if (genre === 'comedy' || genre === 'romance') {
            prodBudget = 8000000 + Math.random() * 52000000; // 8M-60M
          } else if (genre === 'musicals') {
            prodBudget = 25000000 + Math.random() * 95000000; // 25M-120M (musicals need budget for choreography/music)
          } else if (genre === 'horror') {
            // Horror is the most profitable genre per dollar (avg $4-5M, range $1M-$15M for indie, $50M+ for franchises)
            // 80% indie horror, 20% big franchise horror
            if (Math.random() < 0.8) {
              prodBudget = 1000000 + Math.random() * 14000000; // 1M-15M (indie horror)
            } else {
              prodBudget = 40000000 + Math.random() * 40000000; // 40M-80M (major franchise)
            }
          } else if (genre === 'drama') {
            prodBudget = 4000000 + Math.random() * 36000000; // 4M-40M
            prodBudget = 3000000 + Math.random() * 17000000; // 3M-20M
          } else {
            prodBudget = 8000000 + Math.random() * 52000000; // 8M-60M (default)
          }
          
          // Roll department budgets based on genre and production budget
          const setsBudget = prodBudget * (0.08 + Math.random() * 0.12); // 8-20%
          const costumesBudget = prodBudget * (0.02 + Math.random() * 0.03); // 2-5%
          const stuntsBudget = (genre === 'action' || genre === 'scifi' || genre === 'fantasy') 
            ? prodBudget * (0.04 + Math.random() * 0.06) // 4-10% for heavy action
            : prodBudget * (0.01 + Math.random() * 0.03); // 1-4% for others
          const makeupBudget = prodBudget * (0.01 + Math.random() * 0.02); // 1-3%
          const practicalEffectsBudget = prodBudget * (0.02 + Math.random() * 0.04); // 2-6%
          const soundCrewBudget = prodBudget * (0.01 + Math.random() * 0.02); // 1-3%
          
          const departmentBudgetTotal = setsBudget + costumesBudget + stuntsBudget + makeupBudget + practicalEffectsBudget + soundCrewBudget;
          
          // Calculate marketing budget based on total investment (production + departments)
          // AI studios spend aggressively on marketing: 80-150% of investment budget
          const investmentBudget = prodBudget + departmentBudgetTotal;
          const marketingRatio = 0.80 + Math.random() * 0.70; // 80-150% guaranteed
          const marketBudget = investmentBudget * marketingRatio;
          
          const totalCost = prodBudget + marketBudget + departmentBudgetTotal;
          // totalBudget should match player films: production + marketing + talent (no departments separately)
          // For AI films, we include departments in production conceptually
          const totalBudgetForDisplay = prodBudget + departmentBudgetTotal; // This is what we show as "budget"
          console.log(`[AI-FILM-CREATE] ${title} (${genre}): prod=$${Math.round(prodBudget/1000000)}M, depts=$${Math.round(departmentBudgetTotal/1000000)}M, marketing=$${Math.round(marketBudget/1000000)}M, totalBudget=$${Math.round(totalBudgetForDisplay/1000000)}M`);

          if (aiStudio.budget >= totalCost) {
            // Generate phase durations based on genre and production needs
            const phaseDurations = calculatePhaseDurations(genre, Math.floor(prodBudget), false);
            const { devWeeks, preWeeks, prodWeeks, postWeeks } = phaseDurations;
            
            // Use centralized function for release date calculation
            const totalWeeks = calculateAIFilmTotalProductionWeeks(phaseDurations);
            const { releaseWeek, releaseYear } = calculateReleaseDate(aiNewWeek, aiNewYear, totalWeeks);

            try {
              const newFilm = await storage.createFilm({
                studioId: aiStudio.id,
                title,
                genre: genre as any,
                phase: 'development',
                productionBudget: Math.floor(prodBudget),
                marketingBudget: Math.floor(marketBudget),
                talentBudget: 0,
                setsBudget: Math.floor(setsBudget),
                costumesBudget: Math.floor(costumesBudget),
                stuntsBudget: Math.floor(stuntsBudget),
                makeupBudget: Math.floor(makeupBudget),
                practicalEffectsBudget: Math.floor(practicalEffectsBudget),
                soundCrewBudget: Math.floor(soundCrewBudget),
                totalBudget: Math.floor(totalBudgetForDisplay),
                scriptQuality: Math.floor(60 + Math.random() * 30),
                createdAtWeek: aiNewWeek,
                createdAtYear: aiNewYear,
                developmentDurationWeeks: devWeeks,
                preProductionDurationWeeks: preWeeks,
                productionDurationWeeks: prodWeeks,
                postProductionDurationWeeks: postWeeks,
                weeksInCurrentPhase: 0,
                releaseWeek,
                releaseYear,
                hasHiredTalent: true,
                hasEditedPostProduction: true,
              });

              // Generate roles and hire talent for the AI film
              try {
                await generateFilmRoles(newFilm.id, genre, prodBudget);
                const talentCost = await hireAITalent(newFilm.id, genre, aiStudio);
                // Deduct talent cost from AI studio budget
                aiStudioBudgetChanges.set(aiStudio.id, (aiStudioBudgetChanges.get(aiStudio.id) || 0) - talentCost);
                
                // Generate synopsis after talent is assigned
                const synopsis = await generateAIFilmSynopsis(newFilm.id, title, genre);
                await storage.updateFilm(newFilm.id, { synopsis });
              } catch (talentErr) {
                console.error(`[AI-TALENT-ERROR] Failed to hire talent for ${title}:`, talentErr);
              }

              // AI films with VFX-heavy genres pick a VFX studio (skip drama, comedy, romance, etc.)
              const vfxRequiredGenres = ['action', 'scifi', 'fantasy', 'animation', 'horror'];
              if (vfxRequiredGenres.includes(genre)) {
                const selectedVFXStudio = vfxStudios[Math.floor(Math.random() * vfxStudios.length)];
                const vfxCost = selectedVFXStudio.cost || 0;
                
                await storage.updateFilm(newFilm.id, {
                  vfxStudioId: selectedVFXStudio.id,
                  totalBudget: Math.floor(totalCost + vfxCost),
                });
                
                // Track VFX cost in budget changes
                aiStudioBudgetChanges.set(aiStudio.id, (aiStudioBudgetChanges.get(aiStudio.id) || 0) - vfxCost);
              }

              // Create territory releases immediately for the new AI film (BATCHED for performance)
              // ALL AI films release in ALL territories globally
              // Marketing is stored only on FIRST territory (global budget, not per-territory)
              const allTerritories = BOX_OFFICE_COUNTRIES.map(c => c.code);
              const safeMarketingBudget = Math.floor(marketBudget);
              const firstTerritory = allTerritories[0];
              
              // Batch create all territory releases in parallel
              await Promise.all(allTerritories.map(territory => 
                storage.createFilmRelease({
                  filmId: newFilm.id,
                  territoryCode: territory,
                  releaseWeek: releaseWeek,
                  releaseYear: releaseYear,
                  productionBudget: Math.floor(prodBudget),
                  marketingBudget: territory === firstTerritory ? safeMarketingBudget : 0,
                  isReleased: false,
                  weeklyBoxOffice: [],
                  totalBoxOffice: 0,
                  theaterCount: 0,
                  weeksInRelease: 0,
                })
              ));
              await storage.updateStudio(aiStudio.id, {
                budget: aiStudio.budget - Math.floor(totalCost),
              });
            } catch (err) {
              console.error(`[AI-FILM-ERROR] Failed to create film for ${aiStudio.name}:`, err);
            }
          }
        }

        // AI handles films in various phases - schedule releases for production-complete, release for awaiting-release
        // Note: Territory fix-up and sync loops removed - all new films get all 11 territories at creation time
        const aiFilms = await storage.getFilmsByStudio(aiStudio.id);
        for (const film of aiFilms) {
          // Check if film needs to move from production-complete to awaiting-release (schedule releases)
          if (film.phase === 'production-complete') {
            // AI schedules territory releases for production-complete films
            const existingReleases = await storage.getFilmReleasesByFilm(film.id);
            if (existingReleases.length === 0) {
              // Schedule territory releases for ALL territories (BATCHED for performance)
              // Marketing is stored only on FIRST territory (global budget, not per-territory)
              const allTerritories = BOX_OFFICE_COUNTRIES.map(c => c.code);
              const firstTerritory = allTerritories[0];
              
              const safeMarketingBudget = film.marketingBudget || Math.floor(film.productionBudget * 0.8);
              
              // Schedule release 2-4 weeks from now
              const releaseOffset = 2 + Math.floor(Math.random() * 3);
              let releaseWeek = aiNewWeek + releaseOffset;
              let releaseYear = aiNewYear;
              while (releaseWeek > 52) { releaseWeek -= 52; releaseYear += 1; }
              
              // Batch create all territory releases in parallel
              await Promise.all(allTerritories.map(territory => 
                storage.createFilmRelease({
                  filmId: film.id,
                  territoryCode: territory,
                  releaseWeek: releaseWeek,
                  releaseYear: releaseYear,
                  productionBudget: film.productionBudget,
                  marketingBudget: territory === firstTerritory ? safeMarketingBudget : 0,
                  isReleased: false,
                  weeklyBoxOffice: [],
                  totalBoxOffice: 0,
                  theaterCount: 0,
                  weeksInRelease: 0,
                })
              ));
              
              // Update film release date but keep in production-complete (AI films skip awaiting-release)
              await storage.updateFilm(film.id, {
                releaseWeek,
                releaseYear,
              });
              console.log(`[AI-SCHEDULE] ${film.title} scheduled for release Week ${releaseWeek}, ${releaseYear} in ${allTerritories.length} territories`);
            }
            
            // Check if production-complete film has reached release date (AI films go directly to released)
            const releases = await storage.getFilmReleasesByFilm(film.id);
            if (releases && releases.length > 0) {
              // Find earliest release date
              let earliestWeek = releases[0].releaseWeek;
              let earliestYear = releases[0].releaseYear;
              for (const release of releases) {
                if (release.releaseYear < earliestYear || 
                    (release.releaseYear === earliestYear && release.releaseWeek < earliestWeek)) {
                  earliestWeek = release.releaseWeek;
                  earliestYear = release.releaseYear;
                }
              }
              
              // Check if we've reached the earliest release date
              const isReleaseTime = earliestYear < aiNewYear || 
                                    (earliestYear === aiNewYear && earliestWeek <= aiNewWeek);
              if (isReleaseTime) {
                // Quality boost - threshold 70: average scripts = 0 boost
                const qualityBoost = (film.scriptQuality - 70) * 0.35;
                
                // Small random genre preferences (±3 points), heavily overridden by randomness
                let genreBonus = 0;
                let audienceGenreBonus = 0;
                if (film.genre === 'drama') { genreBonus = 3; audienceGenreBonus = -2; }
                else if (film.genre === 'action') { genreBonus = -3; audienceGenreBonus = 3; }
                else if (film.genre === 'comedy') { genreBonus = -1; audienceGenreBonus = 3; }
                else if (film.genre === 'horror') { genreBonus = -5; audienceGenreBonus = 2; }
                else if (film.genre === 'scifi') { genreBonus = 1; audienceGenreBonus = 2; }
                else if (film.genre === 'animation') { genreBonus = 2; audienceGenreBonus = 2; }
                
                // Randomness with realistic base range (52-65)
                const randomBase = 52 + Math.random() * 13;
                const hugeCriticSwing = (Math.random() - 0.5) * 20;  // ±10
                const hugeAudienceSwing = (Math.random() - 0.5) * 16;
                
                // 10% chance of divisive film (±8)
                const isDivisive = Math.random() < 0.10;
                const divisivePenalty = isDivisive ? (Math.random() - 0.5) * 16 : 0;
                
                const rawCriticScore = randomBase + hugeCriticSwing + qualityBoost + genreBonus + divisivePenalty;
                const rawAudienceScore = randomBase + hugeAudienceSwing + qualityBoost + audienceGenreBonus;
                
                const criticScore = Math.min(100, Math.max(20, Math.floor(rawCriticScore)));
                const audienceScore = Math.min(10, Math.max(2, Math.round((rawAudienceScore / 10) * 10) / 10));
                
                const theaterCount = Math.floor(3500 + (film.productionBudget / 40000000) * 3000);
                
                // Set film to released status - the box office calculation loop will handle opening revenue
                await storage.updateFilm(film.id, {
                  phase: 'released',
                  weeklyBoxOffice: [],
                  weeklyBoxOfficeByCountry: [],
                  totalBoxOffice: 0,
                  totalBoxOfficeByCountry: {},
                  audienceScore: Math.round(audienceScore * 10) / 10,
                  criticScore,
                  theaterCount,
                });
                
                // Mark territory releases as released for territories that have reached their release date (BATCHED)
                const releaseUpdates = releases
                  .filter(release => {
                    const releaseReached = release.releaseYear < aiNewYear || 
                                          (release.releaseYear === aiNewYear && release.releaseWeek <= aiNewWeek);
                    return releaseReached && !release.isReleased;
                  })
                  .map(release => storage.updateFilmRelease(release.id, { isReleased: true }));
                await Promise.all(releaseUpdates);
                
                console.log(`[AI-RELEASE] ${aiStudio.name} released "${film.title}" (direct from production-complete)`);
              }
            }
            continue;
          }
        }
      }

      // OPTIMIZATION: Fetch films once for both emails and awards
      const finalFilms = await storage.getAllFilms();
      const playerFilmsForEmails = finalFilms.filter(f => f.studioId === id);
      
      // Filter films to only this game session for awards processing
      const allStudiosForAwards = await storage.getAllStudios();
      const isMultiplayerForAwards = !!studio.gameSessionId;
      const gameStudioIds = new Set(
        allStudiosForAwards.filter(s => 
          s.id === id || 
          s.playerGameId === id ||
          (isMultiplayerForAwards && s.gameSessionId === studio.gameSessionId)
        ).map(s => s.id)
      );
      const gameFilmsForAwards = finalFilms.filter(f => gameStudioIds.has(f.studioId));
      
      // OPTIMIZATION: Run independent end-of-week processes in parallel
      await Promise.all([
        // Generate weekly emails
        generateWeeklyEmails(id, studio, playerFilmsForEmails, newWeek, newYear).catch(() => {}),
        // Process awards - only pass films from this game session
        processAwardCeremonies(id, gameFilmsForAwards, newWeek, newYear).catch((err) => console.error('[Awards] Error:', err)),
        // Process AI streaming acquisitions
        processAIStreamingAcquisitions(id, newWeek, newYear).catch(() => {}),
        // Process streaming views
        processStreamingViews(id, newWeek, newYear).catch(() => {}),
        // Process AI TV shows
        processAITVShowCreation(id, newWeek, newYear).catch(() => {})
      ]);

      const updatedStudio = await storage.getStudio(id);
      res.json(updatedStudio);
    } catch (error) {
      console.error("Error advancing week:", error);
      res.status(500).json({ error: "Failed to advance week" });
    }
  });

  // === DIAGNOSTIC: Test AI Streaming Logic ===
  app.get("/api/debug/ai-streaming/:playerId", async (req, res) => {
    const { playerId } = req.params;
    const diagnostics: any = {
      playerId,
      timestamp: new Date().toISOString(),
      aiStudios: [],
      eligibleFilms: [],
      existingDeals: [],
      errors: []
    };
    
    try {
      const allStudios = await storage.getAllStudios();
      diagnostics.totalStudios = allStudios.length;
      
      const aiStudios = allStudios.filter(s => s.isAI && s.playerGameId === playerId);
      diagnostics.aiStudiosCount = aiStudios.length;
      diagnostics.aiStudios = aiStudios.map(s => ({ id: s.id, name: s.name, playerGameId: s.playerGameId }));
      
      for (const aiStudio of aiStudios) {
        const aiFilms = await storage.getFilmsByStudio(aiStudio.id);
        const releasedFilms = aiFilms.filter(f => f.phase === 'released');
        
        for (const film of releasedFilms) {
          const weeksInRelease = film.weeklyBoxOffice?.length || 0;
          const existingDeals = await storage.getStreamingDealsByFilm(film.id);
          
          diagnostics.eligibleFilms.push({
            filmId: film.id,
            title: film.title,
            studio: aiStudio.name,
            weeksInRelease,
            isEligible: weeksInRelease >= 8,
            hasExistingDeal: existingDeals.length > 0,
            dealCount: existingDeals.length
          });
        }
      }
      
      // Get all existing streaming deals
      const allDeals = await storage.getAllStreamingDeals();
      diagnostics.existingDeals = allDeals.map(d => ({
        id: d.id,
        filmId: d.filmId,
        serviceId: d.streamingServiceId,
        playerGameId: d.playerGameId
      }));
      
    } catch (error: any) {
      diagnostics.errors.push(error.message);
    }
    
    res.json(diagnostics);
  });

  // === VFX STUDIOS ===
  app.get("/api/vfx-studios", async (req, res) => {
    res.json(vfxStudios);
  });

  // === STUDIOS ===
  app.get("/api/studios/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      const allStudios = await storage.getAllStudios();
      
      // Filter to only show studios for this game
      const filtered = allStudios.filter(s => s.id === playerId || s.playerGameId === playerId);
      res.json(filtered);
    } catch (error) {
      console.error("Error fetching studios:", error);
      res.status(500).json({ error: "Failed to fetch studios" });
    }
  });

  // === FILM ROUTES ===
  
  app.get("/api/studio/:studioId/films", async (req, res) => {
    try {
      const { studioId } = req.params;
      const studioFilms = await storage.getFilmsByStudio(studioId);
      res.json(studioFilms);
    } catch (error) {
      console.error("Error fetching films:", error);
      res.status(500).json({ error: "Failed to fetch films" });
    }
  });

  app.get("/api/all-films/:playerId", async (req, res) => {
    try {
      const { playerId } = req.params;
      const allStudios = await storage.getAllStudios();
      const allFilms = await storage.getAllFilms();
      const playerStudio = allStudios.find(s => s.id === playerId);
      
      if (!playerStudio) {
        return res.status(404).json({ error: "Player not found" });
      }
      
      // Filter to only show films for this game
      // Include films from player studio AND all AI studios that belong to this game
      const gameStudios = allStudios.filter(s => 
        s.id === playerId || 
        s.playerGameId === playerId ||
        (playerStudio.gameSessionId && s.gameSessionId === playerStudio.gameSessionId)
      );
      const gameStudioIds = new Set(gameStudios.map(s => s.id));
      
      const filtered = allFilms.filter(f => gameStudioIds.has(f.studioId));
      
      console.log(`[ALL-FILMS] Player: ${playerId}, gameSessionId: ${playerStudio.gameSessionId}, gameStudios: ${gameStudios.length}, totalFilms: ${allFilms.length}, filteredFilms: ${filtered.length}`);
      
      // Fix totalBudget for AI films - should be production + departments, not including marketing
      // This corrects existing films that had inflated totalBudget values
      for (const film of filtered) {
        const filmStudio = allStudios.find(s => s.id === film.studioId);
        if (filmStudio?.isAI) {
          // Recalculate totalBudget as production + departments (no marketing)
          const correctTotalBudget = (film.productionBudget || 0) + 
            (film.setsBudget || 0) + (film.costumesBudget || 0) + 
            (film.stuntsBudget || 0) + (film.makeupBudget || 0) + 
            (film.practicalEffectsBudget || 0) + (film.soundCrewBudget || 0);
          film.totalBudget = correctTotalBudget;
        }
      }
      
      // Enrich films with lead/supporting actor info for Oscar predictions
      const enrichedFilms = await Promise.all(filtered.map(async (film) => {
        const roles = await storage.getFilmRolesByFilm(film.id);
        let leadActorId: string | null = null;
        let leadActressId: string | null = null;
        let supportingActorId: string | null = null;
        let supportingActressId: string | null = null;
        
        for (const role of roles) {
          if (!role.actorId || !role.isCast) continue;
          const talent = await storage.getTalent(role.actorId);
          if (!talent || talent.type !== 'actor') continue;
          
          if (role.importance === 'lead') {
            if (talent.gender === 'male' && !leadActorId) {
              leadActorId = talent.id;
            } else if (talent.gender === 'female' && !leadActressId) {
              leadActressId = talent.id;
            }
          } else if (role.importance === 'supporting') {
            if (talent.gender === 'male' && !supportingActorId) {
              supportingActorId = talent.id;
            } else if (talent.gender === 'female' && !supportingActressId) {
              supportingActressId = talent.id;
            }
          }
        }
        
        // Calculate opening weekend projection using exact same formula as release
        // but with average values for random components
        let projectedOpeningLow = 0;
        let projectedOpeningHigh = 0;
        
        if (film.phase !== 'released') {
          const scriptQuality = film.scriptQuality || 70;
          const qualityFactor = scriptQuality / 100;
          const qualityMultiplier = 0.5 + qualityFactor * 0.8;
          
          // Total investment for marketing calculation
          const totalInvestmentForMarketing = (film.productionBudget || 0) + 
            (film.talentBudget || 0) + 
            (film.setsBudget || 0) + 
            (film.costumesBudget || 0) + 
            (film.stuntsBudget || 0) + 
            (film.makeupBudget || 0) + 
            (film.practicalEffectsBudget || 0) + 
            (film.soundCrewBudget || 0);
          const marketingMultiplier = Math.min(2.0, (film.marketingBudget || 0) / (totalInvestmentForMarketing || 1));
          
          // Genre box office multiplier
          let genreBoxOfficeMultiplier = 1.0;
          if (film.genre === 'action') genreBoxOfficeMultiplier = 1.3;
          else if (film.genre === 'scifi') genreBoxOfficeMultiplier = 1.2;
          else if (film.genre === 'comedy') genreBoxOfficeMultiplier = 0.9;
          else if (film.genre === 'drama') genreBoxOfficeMultiplier = 0.8;
          else if (film.genre === 'animation') genreBoxOfficeMultiplier = 1.1;
          
          // Clamp budget by genre
          const investmentBudget = film.totalBudget || (film.productionBudget || 0);
          const clampedBudget = clampInvestmentBudgetByGenre(investmentBudget, film.genre);
          
          // Use average values for random components, then apply ±30% range
          // Average luck = 0.9 (midpoint of 0.5-1.3)
          // Average audience boost = 1.5 for good scripts (7.0+), 0.85 for bad scripts
          const avgLuck = 0.9;
          const avgAudienceBoost = scriptQuality >= 70 ? 1.5 : 0.85;
          
          // Calculate base projection with average values
          const baseProjection = clampedBudget * avgLuck * marketingMultiplier * qualityMultiplier * genreBoxOfficeMultiplier * avgAudienceBoost;
          
          // Apply ±30% range for reasonable variance
          projectedOpeningLow = Math.floor(baseProjection * 0.7);
          projectedOpeningHigh = Math.floor(baseProjection * 1.3);
        }
        
        return {
          ...film,
          leadActorId,
          leadActressId,
          supportingActorId,
          supportingActressId,
          projectedOpeningLow,
          projectedOpeningHigh,
        };
      }));
      
      // Ensure all films have release weeks AND years assigned
      const currentWeek = playerStudio.currentWeek;
      const currentYear = playerStudio.currentYear;
      for (const film of enrichedFilms) {
        // First, check if this film has scheduled territory releases (player films)
        const territoryReleases = await storage.getFilmReleasesByFilm(film.id);
        if (territoryReleases.length > 0) {
          // Use the earliest scheduled territory release date
          let earliestWeek = territoryReleases[0].releaseWeek;
          let earliestYear = territoryReleases[0].releaseYear;
          for (const release of territoryReleases) {
            const releaseNum = release.releaseYear * 52 + release.releaseWeek;
            const earliestNum = earliestYear * 52 + earliestWeek;
            if (releaseNum < earliestNum) {
              earliestWeek = release.releaseWeek;
              earliestYear = release.releaseYear;
            }
          }
          // Update film's release date to match scheduled territory release
          if (film.releaseWeek !== earliestWeek || film.releaseYear !== earliestYear) {
            await storage.updateFilm(film.id, { releaseWeek: earliestWeek, releaseYear: earliestYear });
          }
          film.releaseWeek = earliestWeek;
          film.releaseYear = earliestYear;
        } else if (film.phase !== 'released') {
          // No territory releases scheduled - only calculate release dates for AI films
          // Player films should NOT appear on calendar until they schedule territory releases
          const filmStudio = allStudios.find(s => s.id === film.studioId);
          const isAIFilm = filmStudio?.isAI === true;
          
          if (!isAIFilm) {
            // Player film without scheduled releases - clear any stale release dates
            if (film.releaseWeek || film.releaseYear) {
              await storage.updateFilm(film.id, { releaseWeek: null, releaseYear: null });
              film.releaseWeek = null;
              film.releaseYear = null;
            }
            continue;
          }
          
          // AI films - ALWAYS recalculate release date based on current phase and remaining weeks
          // This ensures the calendar shows accurate release dates as films progress through production
          // AI films go through: development → pre-production → production → post-production → released
          let totalRemainingWeeks = 0;
          
          if (film.phase === 'development') {
            totalRemainingWeeks = (film.developmentDurationWeeks - film.weeksInCurrentPhase) + 
              film.preProductionDurationWeeks + film.productionDurationWeeks + film.postProductionDurationWeeks;
          } else if (film.phase === 'pre-production') {
            totalRemainingWeeks = (film.preProductionDurationWeeks - film.weeksInCurrentPhase) + 
              film.productionDurationWeeks + film.postProductionDurationWeeks;
          } else if (film.phase === 'production') {
            totalRemainingWeeks = (film.productionDurationWeeks - film.weeksInCurrentPhase) + 
              film.postProductionDurationWeeks;
          } else if (film.phase === 'post-production') {
            totalRemainingWeeks = film.postProductionDurationWeeks - film.weeksInCurrentPhase;
          }
          
          // Calculate release date from current week + remaining weeks
          const { releaseWeek, releaseYear } = calculateReleaseDate(currentWeek, currentYear, Math.max(totalRemainingWeeks, 1));
          
          // Update film if release date changed
          if (film.releaseWeek !== releaseWeek || film.releaseYear !== releaseYear) {
            await storage.updateFilm(film.id, { releaseWeek, releaseYear });
            film.releaseWeek = releaseWeek;
            film.releaseYear = releaseYear;
          }
        }
      }
      
      res.json(enrichedFilms);
    } catch (error) {
      console.error("Error fetching all films:", error);
      res.status(500).json({ error: "Failed to fetch films" });
    }
  });

  app.post("/api/films", async (req, res) => {
    try {
      const filmData = req.body;
      const studio = await storage.getStudio(filmData.studioId);
      if (!studio) {
        return res.status(404).json({ error: "Studio not found" });
      }
      
      // Calculate VFX cost if studio is assigned
      let vfxCost = 0;
      if (filmData.vfxStudioId) {
        const vfxStudio = vfxStudios.find(s => s.id === filmData.vfxStudioId);
        if (vfxStudio) {
          vfxCost = vfxStudio.cost || 0;
        }
      }
      
      const totalCost = filmData.totalBudget || 
        (filmData.productionBudget || 0) + (filmData.marketingBudget || 0) + (filmData.talentBudget || 0) + vfxCost;
      
      if (studio.budget < totalCost) {
        return res.status(400).json({ error: "Insufficient budget" });
      }

      // Generate phase durations based on genre and VFX needs
      const hasVFX = !!filmData.vfxStudioId;
      const phaseDurations = calculatePhaseDurations(filmData.genre, filmData.productionBudget || 0, hasVFX);
      const { devWeeks, preWeeks, prodWeeks, postWeeks } = phaseDurations;

      const film = await storage.createFilm({
        ...filmData,
        totalBudget: totalCost,
        scriptQuality: Math.floor(Math.random() * 30) + 60,
        createdAtWeek: studio.currentWeek,
        createdAtYear: studio.currentYear,
        developmentDurationWeeks: devWeeks,
        preProductionDurationWeeks: preWeeks,
        productionDurationWeeks: prodWeeks,
        postProductionDurationWeeks: postWeeks,
        weeksInCurrentPhase: 0,
      });

      await storage.updateStudio(studio.id, {
        budget: studio.budget - totalCost,
      });

      res.status(201).json(film);
    } catch (error) {
      console.error("Error creating film:", error);
      res.status(500).json({ error: "Failed to create film" });
    }
  });

  app.patch("/api/films/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const film = await storage.updateFilm(id, updates);
      if (!film) {
        return res.status(404).json({ error: "Film not found" });
      }
      res.json(film);
    } catch (error) {
      console.error("Error updating film:", error);
      res.status(500).json({ error: "Failed to update film" });
    }
  });

  app.post("/api/films/:id/hire-talent", async (req, res) => {
    try {
      const { id } = req.params;
      const { directorId, castIds, productionBudget, setsBudget, costumesBudget, stuntsBudget, makeupBudget, practicalEffectsBudget, soundCrewBudget, talentBudget, totalCost } = req.body;
      
      const film = await storage.getFilm(id);
      if (!film) return res.status(404).json({ error: "Film not found" });
      
      const studio = await storage.getStudio(film.studioId);
      if (!studio) return res.status(404).json({ error: "Studio not found" });
      
      // Deduct total cost from studio budget
      const newBudget = Math.max(0, studio.budget - (totalCost || 0));
      await storage.updateStudio(studio.id, { budget: newBudget });
      
      // Calculate VFX cost if studio is assigned
      let vfxCost = 0;
      if (film.vfxStudioId) {
        const vfxStudio = vfxStudios.find(s => s.id === film.vfxStudioId);
        if (vfxStudio) {
          vfxCost = vfxStudio.cost || 0;
        }
      }
      
      // Calculate accurate total budget: production + marketing + talent + all department budgets + VFX cost
      const calculatedTotalBudget = Math.floor(
        (productionBudget || 0) + 
        (film.marketingBudget || 0) + 
        (talentBudget || 0) + 
        (setsBudget || 0) + 
        (costumesBudget || 0) + 
        (stuntsBudget || 0) + 
        (makeupBudget || 0) + 
        (practicalEffectsBudget || 0) + 
        (soundCrewBudget || 0) +
        vfxCost
      );
      
      // Update film with hired talent and budgets
      const updated = await storage.updateFilm(id, {
        directorId,
        castIds,
        talentBudget: talentBudget || 0,
        productionBudget: productionBudget || 0,
        setsBudget: setsBudget || 0,
        costumesBudget: costumesBudget || 0,
        stuntsBudget: stuntsBudget || 0,
        makeupBudget: makeupBudget || 0,
        practicalEffectsBudget: practicalEffectsBudget || 0,
        soundCrewBudget: soundCrewBudget || 0,
        totalBudget: calculatedTotalBudget,
        hasHiredTalent: true,
      });
      
      // CRITICAL: Also update roles with actorIds so they display correctly
      if (castIds && castIds.length > 0) {
        const roles = await storage.getFilmRolesByFilm(id);
        const unassignedRoles = roles.filter(r => !r.actorId);
        
        for (let i = 0; i < castIds.length; i++) {
          const actorId = castIds[i];
          // Check if this actor already has a role assigned
          const existingRole = roles.find(r => r.actorId === actorId);
          if (!existingRole && unassignedRoles[i]) {
            // Assign this actor to the next unassigned role
            await storage.updateFilmRole(unassignedRoles[i].id, {
              actorId: actorId,
              isCast: true,
            });
          }
        }
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error hiring talent:", error);
      res.status(500).json({ error: "Failed to hire talent" });
    }
  });

  app.post("/api/films/:id/edit-postproduction", async (req, res) => {
    try {
      const { id } = req.params;
      const { composerId, editorId, vfxStudioId } = req.body;
      
      const film = await storage.getFilm(id);
      if (!film) return res.status(404).json({ error: "Film not found" });
      
      const studio = await storage.getStudio(film.studioId);
      if (!studio) return res.status(404).json({ error: "Studio not found" });
      
      // Calculate post-production costs
      let composerCost = 0;
      let vfxCost = 0;
      
      // Composer cost
      if (composerId) {
        const allTalent = await storage.getAllTalent();
        const composer = allTalent.find(t => t.id === composerId);
        if (composer) {
          composerCost = composer.askingPrice || 0;
        }
      }
      
      // VFX Studio cost (new assignment)
      if (vfxStudioId) {
        const vfxStudio = vfxStudios.find(s => s.id === vfxStudioId);
        if (vfxStudio) {
          vfxCost = vfxStudio.cost || 0;
        }
      }
      
      const postProdCost = composerCost + vfxCost;
      
      // Deduct cost from studio budget
      const newStudioBudget = Math.max(0, studio.budget - postProdCost);
      await storage.updateStudio(studio.id, { budget: newStudioBudget });
      
      // Recalculate total budget: production + marketing + talent + all department budgets + composer + VFX
      const totalVfxCost = vfxStudioId ? vfxCost : ((film.vfxStudioId ? (() => {
        const existingVfx = vfxStudios.find(s => s.id === film.vfxStudioId);
        return existingVfx?.cost || 0;
      })() : 0));
      
      const calculatedTotalBudget = Math.floor(
        (film.productionBudget || 0) +
        (film.marketingBudget || 0) +
        (film.talentBudget || 0) +
        (film.setsBudget || 0) +
        (film.costumesBudget || 0) +
        (film.stuntsBudget || 0) +
        (film.makeupBudget || 0) +
        (film.practicalEffectsBudget || 0) +
        (film.soundCrewBudget || 0) +
        (vfxStudioId ? vfxCost : totalVfxCost) +
        composerCost
      );
      
      // Update film with post-production crew and recalculated total budget
      const updated = await storage.updateFilm(id, {
        composerId,
        editorId,
        vfxStudioId: vfxStudioId || film.vfxStudioId,
        totalBudget: calculatedTotalBudget,
        hasEditedPostProduction: true,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error editing post-production:", error);
      res.status(500).json({ error: "Failed to edit post-production" });
    }
  });

  app.post("/api/films/:id/release", async (req, res) => {
    try {
      const { id } = req.params;
      const film = await storage.getFilm(id);
      if (!film) {
        return res.status(404).json({ error: "Film not found" });
      }

      const studio = await storage.getStudio(film.studioId);
      if (!studio) {
        return res.status(404).json({ error: "Studio not found" });
      }

      const qualityFactor = film.scriptQuality / 100;
      const budgetFactor = Math.min(1, film.productionBudget / 100000000);
      
      // Quality boost - threshold 80: only high quality scripts get boost
      const qualityBoost = (film.scriptQuality - 80) * 0.35;
      
      // Calculate cast fame bonus for audience score
      let castFameBonus = 0;
      if (film.castIds && film.castIds.length > 0) {
        const allTalent = await storage.getAllTalent();
        const castTalent = film.castIds
          .map(id => allTalent.find(t => t.id === id))
          .filter(Boolean);
        if (castTalent.length > 0) {
          const avgFame = castTalent.reduce((sum, t) => sum + (t?.fame || 50), 0) / castTalent.length;
          // Fame 50 = neutral, Fame 100 = +10 points, Fame 0 = -5 points
          castFameBonus = ((avgFame - 50) / 50) * 10;
        }
      }
      
      // Director matters for both scores - both fame AND skill
      let directorFameBonus = 0;
      let directorSkillBonus = 0;
      if (film.directorId) {
        const director = await storage.getTalent(film.directorId);
        if (director) {
          // Fame: 50 = neutral, 100 = +5, 0 = -5
          directorFameBonus = ((director.fame || 50) - 50) / 50 * 5;
          // Experience/skill: affects critics directly (experienced directors = better critical reception)
          directorSkillBonus = ((director.experience || 50) - 50) / 50 * 8; // Up to ±8 points
        }
      }
      
      // Budget quality boost - higher budgets tend to have better production value, but don't guarantee high scores
      const budgetQualityBoost = Math.max(-1, (budgetFactor - 0.5) * 2); // -1 to +1, not cumulative with other factors
      
      // Genre preferences - doubled for more pronounced effects
      let genreBonus = 0;
      let audienceGenreBonus = 0;
      if (film.genre === 'drama') {
        genreBonus = 10; // Critics prefer drama
        audienceGenreBonus = -5;
      } else if (film.genre === 'action') {
        genreBonus = -5; // Critics less impressed
        audienceGenreBonus = 7; // Audience loves action
      } else if (film.genre === 'comedy') {
        genreBonus = -3;
        audienceGenreBonus = 0;
      } else if (film.genre === 'horror') {
        genreBonus = -5; // Critics harsh on horror
        audienceGenreBonus = 3; // Audiences enjoy it more
      } else if (film.genre === 'scifi') {
        genreBonus = 0;
        audienceGenreBonus = 4;
      } else if (film.genre === 'animation') {
        genreBonus = 0;
        audienceGenreBonus = 5;
      } else if (film.genre === 'fantasy') {
        genreBonus = -3;
        audienceGenreBonus = 5;
      } else if (film.genre === 'musicals') {
        genreBonus = 5;
        audienceGenreBonus = 2;
      } else if (film.genre === 'romance') {
        genreBonus = 5;
        audienceGenreBonus = 2;
      } else if (film.genre === 'thriller') {
        genreBonus = 3;
        audienceGenreBonus = 5;
      }
      
      // Randomness reduced - director fame provides variety
      const randomBase = 55 + Math.random() * 15;  // Increased range: 55-70
      const audienceSwing = (Math.random() - 0.5) * 15;  // Reduced from ±10 to ±7.5
      
      const rawCriticScore = randomBase + qualityBoost + genreBonus + directorFameBonus + directorSkillBonus + budgetQualityBoost;
      const rawAudienceScore = randomBase + audienceSwing + qualityBoost + audienceGenreBonus + castFameBonus + budgetQualityBoost;
      
      const criticScore = Math.min(100, Math.max(20, Math.floor(rawCriticScore)));
      const audienceScore = Math.min(10, Math.max(2, Math.round((rawAudienceScore / 10) * 10) / 10));
      
      // Calculate total investment budget including all crew costs (sets, costumes, stunts, makeup, effects, sound)
      let totalInvestmentForMarketing = (film.productionBudget || 0) + 
        (film.talentBudget || 0) + 
        (film.setsBudget || 0) + 
        (film.costumesBudget || 0) + 
        (film.stuntsBudget || 0) + 
        (film.makeupBudget || 0) + 
        (film.practicalEffectsBudget || 0) + 
        (film.soundCrewBudget || 0);
      const marketingMultiplier = Math.min(2.0, film.marketingBudget / (totalInvestmentForMarketing || 1));
      // Genre modifiers: action/scifi do better, drama does worse
      let genreBoxOfficeMultiplier = 1.0;
      if (film.genre === 'action') genreBoxOfficeMultiplier = 1.3;
      else if (film.genre === 'scifi') genreBoxOfficeMultiplier = 1.2;
      else if (film.genre === 'comedy') genreBoxOfficeMultiplier = 0.9;
      else if (film.genre === 'drama') genreBoxOfficeMultiplier = 0.8;
      else if (film.genre === 'animation') genreBoxOfficeMultiplier = 1.1;
      
      // Audience score boost using tier-based multiplier: exceptional films get disproportionate rewards
      const audienceBoost = getAudienceMultiplier(audienceScore);
      
      // Use totalBudget for box office calculations
      // NOTE: Marketing is separate and has its own multiplier
      let investmentBudget = film.totalBudget || (film.productionBudget || 0);
      
      const clampedInvestmentBudget3 = clampInvestmentBudgetByGenre(investmentBudget, film.genre);
      const randomLuck = 0.5 + Math.random() * 0.8;
      const qualityMultiplier = 0.5 + qualityFactor * 0.8;
      const baseOpening = clampedInvestmentBudget3 * randomLuck * marketingMultiplier * qualityMultiplier * genreBoxOfficeMultiplier * audienceBoost;
      const openingWeekend = Math.floor(baseOpening);
      
      const boxOfficeBreakdown = {
        investmentBudget: Math.round(investmentBudget),
        randomLuck: Math.round(randomLuck * 1000) / 1000,
        marketingMultiplier: Math.round(marketingMultiplier * 1000) / 1000,
        qualityFactor: Math.round(qualityFactor * 1000) / 1000,
        qualityMultiplier: Math.round(qualityMultiplier * 1000) / 1000,
        genreBoxOfficeMultiplier,
        audienceScore,
        audienceBoost: Math.round(audienceBoost * 1000) / 1000,
        audiencePenaltyRoll: audienceScore >= 7.0 ? `boost: ${Math.round(audienceBoost * 100)}% of 1.0-2.0x range` : `penalty: ${Math.round(audienceBoost * 100)}% of 0.3-1.0x range`,
        baseOpening: Math.round(baseOpening),
        openingWeekend
      };
      
      const theaterCount = Math.floor(3500 + (film.productionBudget / 40000000) * 3000);

      // Awards are now determined at proper award ceremonies, not on release
      const updatedFilm = await storage.updateFilm(id, {
        phase: 'released',
        weeklyBoxOffice: [openingWeekend],
        totalBoxOffice: openingWeekend,
        audienceScore: Math.round(audienceScore * 10) / 10,
        criticScore,
        boxOfficeBreakdown,
        theaterCount,
        awards: [],
      });

      const studioShare = Math.floor(openingWeekend * 0.7);
      await storage.updateStudio(studio.id, {
        budget: studio.budget + studioShare,
        totalEarnings: studio.totalEarnings + studioShare,
      });

      res.json(updatedFilm);
    } catch (error) {
      console.error("Error releasing film:", error);
      res.status(500).json({ error: "Failed to release film" });
    }
  });

  app.delete("/api/films/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteFilm(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting film:", error);
      res.status(500).json({ error: "Failed to delete film" });
    }
  });

  // === FILM RELEASES (TERRITORY-BASED) ROUTES ===
  
  app.get("/api/all-releases", async (req, res) => {
    try {
      const releases = await db.select().from(filmReleases);
      res.json(releases);
    } catch (error) {
      console.error("Error fetching all releases:", error);
      res.status(500).json({ error: "Failed to fetch all releases" });
    }
  });
  
  app.get("/api/films/:filmId/releases", async (req, res) => {
    try {
      const { filmId } = req.params;
      const releases = await storage.getFilmReleasesByFilm(filmId);
      res.json(releases);
    } catch (error) {
      console.error("Error fetching film releases:", error);
      res.status(500).json({ error: "Failed to fetch film releases" });
    }
  });

  app.get("/api/films/:filmId/releases/:territoryCode", async (req, res) => {
    try {
      const { filmId, territoryCode } = req.params;
      const release = await storage.getFilmReleaseByTerritory(filmId, territoryCode);
      if (!release) {
        return res.status(404).json({ error: "Film release not found for this territory" });
      }
      res.json(release);
    } catch (error) {
      console.error("Error fetching film release:", error);
      res.status(500).json({ error: "Failed to fetch film release" });
    }
  });

  app.post("/api/films/:filmId/releases", async (req, res) => {
    try {
      const { filmId } = req.params;
      const { territoryCode, releaseWeek, releaseYear, productionBudget, marketingBudget } = req.body;
      
      // Tracked films: Maleficent & Saving Grace
      const trackedFilms = {
        '50fcf540-c29a-4912-851e-635714070315': 'Maleficent',
        'af242531-bdb2-4d4b-a1df-5e713e05d442': 'Saving Grace'
      };
      const filmName = trackedFilms[filmId] || 'Unknown';
      const isTracked = filmName !== 'Unknown' ? '★' : '';
      
      const film = await storage.getFilm(filmId);
      if (!film) {
        console.error(`\n${isTracked}>>> CREATE RELEASE [${filmName}]: ERROR - Film not found`);
        return res.status(404).json({ error: "Film not found" });
      }
      
      // For tracked films, show full budget breakdown
      const budgetInfo = isTracked ? ` | DB: Prod=$${film.productionBudget}, Mkt=$${film.marketingBudget}, Talent=$${film.talentBudget}, Total=$${film.totalBudget} | Release: Prod=$${productionBudget}, Mkt=$${marketingBudget}` : '';
      
      console.error(`\n${isTracked}>>> CREATE RELEASE [${filmName}]: territory=${territoryCode}, week=${releaseWeek}/${releaseYear}${budgetInfo}`);
      
      // Check if release already exists for this territory
      const existing = await storage.getFilmReleaseByTerritory(filmId, territoryCode);
      if (existing) {
        console.error(`    WARNING: Release already exists for territory`);
        return res.status(400).json({ error: "Release already scheduled for this territory" });
      }
      
      console.error(`    ✓ Creating release for ${filmName}...`);
      
      // Calculate distribution fee based on territory size
      const distributionFees: Record<string, number> = {
        'NA': 2000000,    // $2M - North America
        'CN': 1500000,    // $1.5M - China
        'GB': 1000000,    // $1M - UK & Ireland
        'FR': 1000000,    // $1M - France
        'JP': 1000000,    // $1M - Japan
        'DE': 800000,     // $800K - Germany
        'KR': 800000,     // $800K - South Korea
        'MX': 500000,     // $500K - Mexico
        'AU': 500000,     // $500K - Australia
        'IN': 500000,     // $500K - India
        'OTHER': 300000,  // $300K - Other territories
      };
      const distributionFee = distributionFees[territoryCode] || 500000;
      
      // Check if this is the first territory release (marketing is charged once, not per territory)
      const existingReleases = await storage.getFilmReleasesByFilm(filmId);
      const isFirstRelease = existingReleases.length === 0;
      
      // Charge distribution fee + marketing on first release, distribution only on subsequent releases
      const totalCost = distributionFee + (isFirstRelease ? (marketingBudget || 0) : 0);
      
      // Get studio and check if they can afford the cost
      const studio = await storage.getStudio(film.studioId);
      if (!studio) {
        return res.status(404).json({ error: "Studio not found" });
      }
      
      if (studio.budget < totalCost) {
        const costBreakdown = isFirstRelease 
          ? `${formatMoney(distributionFee)} distribution + ${formatMoney(marketingBudget || 0)} marketing`
          : `${formatMoney(distributionFee)} distribution`;
        return res.status(400).json({ 
          error: `Insufficient budget. Need ${formatMoney(totalCost)} (${costBreakdown})` 
        });
      }
      
      // Deduct the cost from studio budget
      await storage.updateStudio(studio.id, {
        budget: studio.budget - totalCost,
      });
      
      // Store marketing budget only on first release, so $30M is global, not per-territory
      const releaseMarketingBudget = isFirstRelease ? (marketingBudget || 0) : 0;
      
      const release = await storage.createFilmRelease({
        filmId,
        territoryCode,
        releaseWeek,
        releaseYear,
        productionBudget: productionBudget || film.productionBudget,
        marketingBudget: releaseMarketingBudget,
        isReleased: false,
        weeklyBoxOffice: [],
        totalBoxOffice: 0,
        theaterCount: 0,
      });
      
      // Update film's releaseWeek/releaseYear to earliest scheduled territory release
      // This ensures advance-week will transition the film to 'released' on opening week
      const allReleases = await storage.getFilmReleasesByFilm(filmId);
      if (allReleases.length > 0) {
        const earliestRelease = allReleases.reduce((earliest, r) => {
          const rWeekNum = r.releaseYear * 52 + r.releaseWeek;
          const eWeekNum = earliest.releaseYear * 52 + earliest.releaseWeek;
          return rWeekNum < eWeekNum ? r : earliest;
        });
        
        // Only update if film doesn't have a release date or new one is earlier
        const filmWeekNum = film.releaseYear && film.releaseWeek ? film.releaseYear * 52 + film.releaseWeek : Infinity;
        const earliestWeekNum = earliestRelease.releaseYear * 52 + earliestRelease.releaseWeek;
        
        if (earliestWeekNum < filmWeekNum) {
          // Save poster URL if provided (only on first release)
          const posterUrl = req.body.posterUrl;
          await storage.updateFilm(filmId, {
            releaseWeek: earliestRelease.releaseWeek,
            releaseYear: earliestRelease.releaseYear,
            ...(posterUrl && { posterUrl }),
          });
        }
      }
      
      res.status(201).json(release);
    } catch (error) {
      console.error("Error creating film release:", error);
      res.status(500).json({ error: "Failed to create film release" });
    }
  });

  app.patch("/api/films/:filmId/releases/:releaseId", async (req, res) => {
    try {
      const { filmId, releaseId } = req.params;
      const { marketingBudget } = req.body;
      
      // Get the old release to calculate budget difference
      const oldRelease = await storage.getFilmRelease(releaseId);
      if (!oldRelease) {
        return res.status(404).json({ error: "Release not found" });
      }
      
      // Get the film to access studio info
      const film = await storage.getFilm(filmId);
      if (!film) {
        return res.status(404).json({ error: "Film not found" });
      }
      
      // If marketing budget is being updated, handle studio budget adjustment
      if (marketingBudget !== undefined && marketingBudget !== oldRelease.marketingBudget) {
        const budgetDifference = (marketingBudget || 0) - (oldRelease.marketingBudget || 0);
        
        const studio = await storage.getStudio(film.studioId);
        if (!studio) {
          return res.status(404).json({ error: "Studio not found" });
        }
        
        // Check if studio can afford the increase (or has enough refund available)
        if (budgetDifference > 0 && studio.budget < budgetDifference) {
          return res.status(400).json({ 
            error: `Insufficient budget. Need ${formatMoney(budgetDifference)} more for marketing increase` 
          });
        }
        
        // Update studio budget (deduct if positive, refund if negative)
        await storage.updateStudio(studio.id, {
          budget: studio.budget - budgetDifference,
        });
      }
      const updates = req.body;
      
      const release = await storage.updateFilmRelease(releaseId, updates);
      if (!release) {
        return res.status(404).json({ error: "Film release not found" });
      }
      
      // Recalculate film's releaseWeek/releaseYear based on earliest territory release
      const allReleases = await storage.getFilmReleasesByFilm(filmId);
      if (allReleases.length > 0) {
        const earliestRelease = allReleases.reduce((earliest, r) => {
          const rWeekNum = r.releaseYear * 52 + r.releaseWeek;
          const eWeekNum = earliest.releaseYear * 52 + earliest.releaseWeek;
          return rWeekNum < eWeekNum ? r : earliest;
        });
        
        await storage.updateFilm(filmId, {
          releaseWeek: earliestRelease.releaseWeek,
          releaseYear: earliestRelease.releaseYear,
        });
      }
      
      res.json(release);
    } catch (error) {
      console.error("Error updating film release:", error);
      res.status(500).json({ error: "Failed to update film release" });
    }
  });

  app.delete("/api/films/:filmId/releases/:releaseId", async (req, res) => {
    try {
      const { filmId, releaseId } = req.params;
      
      // Get the release to get territory code and marketing budget
      const release = await storage.getFilmRelease(releaseId);
      if (!release) {
        return res.status(404).json({ error: "Film release not found" });
      }
      
      // Get the film to get studio ID
      const film = await storage.getFilm(filmId);
      if (!film) {
        return res.status(404).json({ error: "Film not found" });
      }
      
      // Get the studio
      const studio = await storage.getStudio(film.studioId);
      if (!studio) {
        return res.status(404).json({ error: "Studio not found" });
      }
      
      // Calculate distribution fee based on territory size
      const distributionFees: Record<string, number> = {
        'NA': 2000000,    // $2M - North America
        'CN': 1500000,    // $1.5M - China
        'GB': 1000000,    // $1M - UK & Ireland
        'FR': 1000000,    // $1M - France
        'JP': 1000000,    // $1M - Japan
        'DE': 800000,     // $800K - Germany
        'KR': 800000,     // $800K - South Korea
        'MX': 500000,     // $500K - Mexico
        'AU': 500000,     // $500K - Australia
        'IN': 500000,     // $500K - India
        'OTHER': 300000,  // $300K - Other territories
      };
      const distributionFee = distributionFees[release.territoryCode] || 500000;
      const refundAmount = distributionFee + (release.marketingBudget || 0);
      
      // Refund the studio
      await storage.updateStudio(studio.id, {
        budget: studio.budget + refundAmount,
      });
      
      // Delete the release
      await storage.deleteFilmRelease(releaseId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting film release:", error);
      res.status(500).json({ error: "Failed to delete film release" });
    }
  });

  app.delete("/api/films/:filmId/releases", async (req, res) => {
    try {
      const { filmId } = req.params;
      const { releaseIds } = req.body;
      
      if (!Array.isArray(releaseIds) || releaseIds.length === 0) {
        return res.status(400).json({ error: "releaseIds must be a non-empty array" });
      }
      
      // Get the film to get studio ID
      const film = await storage.getFilm(filmId);
      if (!film) {
        return res.status(404).json({ error: "Film not found" });
      }
      
      // Get the studio
      const studio = await storage.getStudio(film.studioId);
      if (!studio) {
        return res.status(404).json({ error: "Studio not found" });
      }
      
      // Distribution fees
      const distributionFees: Record<string, number> = {
        'NA': 2000000,    // $2M - North America
        'CN': 1500000,    // $1.5M - China
        'GB': 1000000,    // $1M - UK & Ireland
        'FR': 1000000,    // $1M - France
        'JP': 1000000,    // $1M - Japan
        'DE': 800000,     // $800K - Germany
        'KR': 800000,     // $800K - South Korea
        'MX': 500000,     // $500K - Mexico
        'AU': 500000,     // $500K - Australia
        'IN': 500000,     // $500K - India
        'OTHER': 300000,  // $300K - Other territories
      };
      
      // Calculate total refund for all releases
      let totalRefund = 0;
      const releases = [];
      for (const releaseId of releaseIds) {
        const release = await storage.getFilmRelease(releaseId);
        if (release) {
          releases.push(release);
          const distributionFee = distributionFees[release.territoryCode] || 500000;
          totalRefund += distributionFee + (release.marketingBudget || 0);
        }
      }
      
      // Update studio budget with total refund in one operation
      await storage.updateStudio(studio.id, {
        budget: studio.budget + totalRefund,
      });
      
      // Delete all releases
      for (const releaseId of releaseIds) {
        await storage.deleteFilmRelease(releaseId);
      }
      
      res.json({ refundAmount: totalRefund, deletedCount: releases.length });
    } catch (error) {
      console.error("Error batch deleting film releases:", error);
      res.status(500).json({ error: "Failed to delete film releases" });
    }
  });

  // === FILM MILESTONES (DEVELOPMENT TRACKING) ROUTES ===
  
  app.get("/api/films/:filmId/milestones", async (req, res) => {
    try {
      const { filmId } = req.params;
      const milestones = await storage.getFilmMilestonesByFilm(filmId);
      res.json(milestones);
    } catch (error) {
      console.error("Error fetching film milestones:", error);
      res.status(500).json({ error: "Failed to fetch film milestones" });
    }
  });

  app.post("/api/films/:filmId/milestones", async (req, res) => {
    try {
      const { filmId } = req.params;
      const { milestoneId, status, durationWeeks, notes } = req.body;
      
      const film = await storage.getFilm(filmId);
      if (!film) {
        return res.status(404).json({ error: "Film not found" });
      }
      
      const milestone = await storage.createFilmMilestone({
        filmId,
        milestoneId,
        status: status || 'pending',
        durationWeeks: durationWeeks || 2,
        notes,
      });
      
      res.status(201).json(milestone);
    } catch (error) {
      console.error("Error creating film milestone:", error);
      res.status(500).json({ error: "Failed to create film milestone" });
    }
  });

  app.patch("/api/films/:filmId/milestones/:milestoneId", async (req, res) => {
    try {
      const { milestoneId } = req.params;
      const updates = req.body;
      
      const milestone = await storage.updateFilmMilestone(milestoneId, updates);
      if (!milestone) {
        return res.status(404).json({ error: "Film milestone not found" });
      }
      res.json(milestone);
    } catch (error) {
      console.error("Error updating film milestone:", error);
      res.status(500).json({ error: "Failed to update film milestone" });
    }
  });

  app.delete("/api/films/:filmId/milestones/:milestoneId", async (req, res) => {
    try {
      const { milestoneId } = req.params;
      await storage.deleteFilmMilestone(milestoneId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting film milestone:", error);
      res.status(500).json({ error: "Failed to delete film milestone" });
    }
  });

  // === TALENT ROUTES ===
  
  app.get("/api/talent", async (req, res) => {
    try {
      const allTalent = await storage.getAllTalent();
      res.json(allTalent);
    } catch (error) {
      console.error("Error fetching talent:", error);
      res.status(500).json({ error: "Failed to fetch talent" });
    }
  });

  app.get("/api/talent/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const t = await storage.getTalent(id);
      if (!t) {
        return res.status(404).json({ error: "Talent not found" });
      }
      res.json(t);
    } catch (error) {
      console.error("Error fetching talent:", error);
      res.status(500).json({ error: "Failed to fetch talent" });
    }
  });

  // === STREAMING SERVICES ROUTES ===
  
  app.get("/api/streaming-services", async (req, res) => {
    try {
      await storage.seedStreamingServices();
      const services = await storage.getAllStreamingServices();
      res.json(services);
    } catch (error) {
      console.error("Error fetching streaming services:", error);
      res.status(500).json({ error: "Failed to fetch streaming services" });
    }
  });

  app.get("/api/streaming-services/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const service = await storage.getStreamingService(id);
      if (!service) {
        return res.status(404).json({ error: "Streaming service not found" });
      }
      res.json(service);
    } catch (error) {
      console.error("Error fetching streaming service:", error);
      res.status(500).json({ error: "Failed to fetch streaming service" });
    }
  });

  // === TV SHOWS ROUTES ===

  app.get("/api/tv-shows", async (req, res) => {
    try {
      const { studioId } = req.query;
      if (studioId && typeof studioId === 'string') {
        const shows = await storage.getTVShowsByStudio(studioId);
        return res.json(shows);
      }
      const shows = await storage.getAllTVShows();
      res.json(shows);
    } catch (error) {
      console.error("Error fetching TV shows:", error);
      res.status(500).json({ error: "Failed to fetch TV shows" });
    }
  });

  app.get("/api/tv-shows/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const show = await storage.getTVShow(id);
      if (!show) {
        return res.status(404).json({ error: "TV show not found" });
      }
      res.json(show);
    } catch (error) {
      console.error("Error fetching TV show:", error);
      res.status(500).json({ error: "Failed to fetch TV show" });
    }
  });

  app.post("/api/tv-shows", async (req, res) => {
    try {
      const showData = req.body;
      const show = await storage.createTVShow(showData);
      res.status(201).json(show);
    } catch (error) {
      console.error("Error creating TV show:", error);
      res.status(500).json({ error: "Failed to create TV show" });
    }
  });

  app.patch("/api/tv-shows/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const show = await storage.updateTVShow(id, updates);
      if (!show) {
        return res.status(404).json({ error: "TV show not found" });
      }
      res.json(show);
    } catch (error) {
      console.error("Error updating TV show:", error);
      res.status(500).json({ error: "Failed to update TV show" });
    }
  });

  app.delete("/api/tv-shows/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTVShow(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting TV show:", error);
      res.status(500).json({ error: "Failed to delete TV show" });
    }
  });

  // TV Seasons
  app.get("/api/tv-shows/:showId/seasons", async (req, res) => {
    try {
      const { showId } = req.params;
      const seasons = await storage.getTVSeasonsByShow(showId);
      res.json(seasons);
    } catch (error) {
      console.error("Error fetching TV seasons:", error);
      res.status(500).json({ error: "Failed to fetch TV seasons" });
    }
  });

  app.get("/api/tv-seasons/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const season = await storage.getTVSeason(id);
      if (!season) {
        return res.status(404).json({ error: "TV season not found" });
      }
      res.json(season);
    } catch (error) {
      console.error("Error fetching TV season:", error);
      res.status(500).json({ error: "Failed to fetch TV season" });
    }
  });

  app.post("/api/tv-seasons", async (req, res) => {
    try {
      const seasonData = req.body;
      const season = await storage.createTVSeason(seasonData);
      
      // Update the show's total seasons count
      const show = await storage.getTVShow(seasonData.tvShowId);
      if (show) {
        await storage.updateTVShow(seasonData.tvShowId, {
          totalSeasons: show.totalSeasons + 1,
        });
      }
      
      res.status(201).json(season);
    } catch (error) {
      console.error("Error creating TV season:", error);
      res.status(500).json({ error: "Failed to create TV season" });
    }
  });

  app.patch("/api/tv-seasons/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const season = await storage.updateTVSeason(id, updates);
      if (!season) {
        return res.status(404).json({ error: "TV season not found" });
      }
      res.json(season);
    } catch (error) {
      console.error("Error updating TV season:", error);
      res.status(500).json({ error: "Failed to update TV season" });
    }
  });

  app.delete("/api/tv-seasons/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTVSeason(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting TV season:", error);
      res.status(500).json({ error: "Failed to delete TV season" });
    }
  });

  // TV Episodes
  app.get("/api/tv-seasons/:seasonId/episodes", async (req, res) => {
    try {
      const { seasonId } = req.params;
      const episodes = await storage.getTVEpisodesBySeason(seasonId);
      res.json(episodes);
    } catch (error) {
      console.error("Error fetching TV episodes:", error);
      res.status(500).json({ error: "Failed to fetch TV episodes" });
    }
  });

  app.get("/api/tv-episodes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const episode = await storage.getTVEpisode(id);
      if (!episode) {
        return res.status(404).json({ error: "TV episode not found" });
      }
      res.json(episode);
    } catch (error) {
      console.error("Error fetching TV episode:", error);
      res.status(500).json({ error: "Failed to fetch TV episode" });
    }
  });

  app.post("/api/tv-episodes", async (req, res) => {
    try {
      const episodeData = req.body;
      const episode = await storage.createTVEpisode(episodeData);
      res.status(201).json(episode);
    } catch (error) {
      console.error("Error creating TV episode:", error);
      res.status(500).json({ error: "Failed to create TV episode" });
    }
  });

  app.patch("/api/tv-episodes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const episode = await storage.updateTVEpisode(id, updates);
      if (!episode) {
        return res.status(404).json({ error: "TV episode not found" });
      }
      res.json(episode);
    } catch (error) {
      console.error("Error updating TV episode:", error);
      res.status(500).json({ error: "Failed to update TV episode" });
    }
  });

  // TV Networks
  app.get("/api/tv-networks", async (req, res) => {
    try {
      await storage.seedTVNetworks();
      const networks = await storage.getAllTVNetworks();
      res.json(networks);
    } catch (error) {
      console.error("Error fetching TV networks:", error);
      res.status(500).json({ error: "Failed to fetch TV networks" });
    }
  });

  app.get("/api/tv-networks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const network = await storage.getTVNetwork(id);
      if (!network) {
        return res.status(404).json({ error: "TV network not found" });
      }
      res.json(network);
    } catch (error) {
      console.error("Error fetching TV network:", error);
      res.status(500).json({ error: "Failed to fetch TV network" });
    }
  });

  // === STREAMING DEALS ROUTES ===

  app.get("/api/streaming-deals", async (req, res) => {
    try {
      const { playerGameId } = req.query;
      if (!playerGameId || typeof playerGameId !== 'string') {
        return res.status(400).json({ error: "playerGameId is required" });
      }
      const deals = await storage.getStreamingDealsByPlayer(playerGameId);
      res.json(deals);
    } catch (error) {
      console.error("Error fetching streaming deals:", error);
      res.status(500).json({ error: "Failed to fetch streaming deals" });
    }
  });

  app.get("/api/streaming-deals/film/:filmId", async (req, res) => {
    try {
      const { filmId } = req.params;
      const deals = await storage.getStreamingDealsByFilm(filmId);
      res.json(deals);
    } catch (error) {
      console.error("Error fetching streaming deals for film:", error);
      res.status(500).json({ error: "Failed to fetch streaming deals" });
    }
  });

  app.get("/api/streaming-deals/service/:serviceId", async (req, res) => {
    try {
      const { serviceId } = req.params;
      const { playerGameId } = req.query;
      const allDeals = await storage.getStreamingDealsByService(serviceId);
      
      // Filter deals to only include those from the current game session
      const deals = playerGameId 
        ? allDeals.filter(deal => deal.playerGameId === playerGameId)
        : allDeals;
      
      // Get all films for these deals (including AI films)
      const filmsWithDeals = await Promise.all(
        deals.map(async (deal) => {
          const film = await storage.getFilm(deal.filmId || '');
          const studio = deal.playerGameId ? await storage.getStudio(deal.playerGameId) : null;
          return {
            deal,
            film,
            studioName: studio?.name || 'Unknown Studio',
            isAI: studio?.isAI || false,
          };
        })
      );
      
      res.json(filmsWithDeals.filter(f => f.film)); // Only return valid films
    } catch (error) {
      console.error("Error fetching streaming deals for service:", error);
      res.status(500).json({ error: "Failed to fetch streaming deals" });
    }
  });

  // Get all streaming content across all services (for global Top 10 charts)
  app.get("/api/streaming-deals/all-content", async (req, res) => {
    try {
      const { playerGameId } = req.query;
      const services = await storage.getAllStreamingServices();
      const allContent: { deal: any; film: any; tvShow?: any; studioName: string; isAI: boolean; serviceName: string; serviceId: string; serviceColor: string; contentType: 'movie' | 'tvshow' }[] = [];
      
      // Get the player's studio to find studios in the same game session
      for (const service of services) {
        // Get movie deals
        const movieDeals = await storage.getStreamingDealsByService(service.id);
        // Filter deals to only include those from the current game session by checking playerGameId directly
        const filteredMovieDeals = playerGameId 
          ? movieDeals.filter(deal => deal.playerGameId === playerGameId)
          : movieDeals;
        const filmsWithDeals = await Promise.all(
          filteredMovieDeals.map(async (deal) => {
            const film = await storage.getFilm(deal.filmId || '');
            const studio = deal.playerGameId ? await storage.getStudio(deal.playerGameId) : null;
            return {
              deal,
              film,
              studioName: studio?.name || 'Unknown Studio',
              isAI: studio?.isAI || false,
              serviceName: service.name,
              serviceId: service.id,
              serviceColor: service.color || '#3b82f6',
              contentType: 'movie' as const,
            };
          })
        );
        allContent.push(...filmsWithDeals.filter(f => f.film));
        
        // Get TV show deals for this service
        const allTVDeals = await storage.getAllTVDeals();
        const tvDealsForService = allTVDeals.filter(d => d.streamingServiceId === service.id && d.isActive);
        // Filter TV deals to only include those from the current game session by checking playerGameId directly
        const filteredTVDeals = playerGameId
          ? tvDealsForService.filter(deal => deal.playerGameId === playerGameId)
          : tvDealsForService;
        const showsWithDeals = await Promise.all(
          filteredTVDeals.map(async (deal) => {
            const tvShow = await storage.getTVShow(deal.tvShowId);
            // Get the studio that owns this TV show for proper attribution
            const studioId = tvShow?.studioId;
            const studio = studioId ? await storage.getStudio(studioId) : null;
            // Create a pseudo-deal object compatible with the streaming chart format
            // Source metrics from the TV deal directly (updated each week)
            const pseudoDeal = {
              id: deal.id,
              filmId: null,
              streamingServiceId: deal.streamingServiceId,
              playerGameId: deal.playerGameId,
              licenseFee: deal.licenseFee,
              startWeek: deal.startWeek,
              startYear: deal.startYear,
              endWeek: deal.endWeek,
              endYear: deal.endYear,
              isActive: deal.isActive,
              weeklyViews: deal.weeklyViews || [],
              totalViews: deal.totalViews || 0,
              totalRevenue: deal.totalRevenue || deal.totalValue || 0,
              weeksActive: deal.weeksActive || 0,
            };
            return {
              deal: pseudoDeal,
              film: tvShow ? { ...tvShow, title: tvShow.title, id: tvShow.id } : null,
              tvShow,
              studioName: studio?.name || 'Unknown Studio',
              isAI: studio?.isAI || false,
              serviceName: service.name,
              serviceId: service.id,
              serviceColor: service.color || '#3b82f6',
              contentType: 'tvshow' as const,
            };
          })
        );
        allContent.push(...showsWithDeals.filter(s => s.tvShow));
      }
      
      res.json(allContent);
    } catch (error) {
      console.error("Error fetching all streaming content:", error);
      res.status(500).json({ error: "Failed to fetch all streaming content" });
    }
  });

  app.post("/api/streaming-deals", async (req, res) => {
    try {
      const { filmId, streamingServiceId, playerGameId, licenseFee, startWeek, startYear } = req.body;
      
      const film = await storage.getFilm(filmId);
      if (!film) {
        return res.status(404).json({ error: "Film not found" });
      }

      const service = await storage.getStreamingService(streamingServiceId);
      if (!service) {
        return res.status(404).json({ error: "Streaming service not found" });
      }

      // Check if film already has an active deal with ANY streaming service
      const existingDeals = await storage.getStreamingDealsByFilm(filmId);
      const hasActiveDeal = existingDeals.some(d => d.isActive);
      if (hasActiveDeal) {
        return res.status(400).json({ error: "This film already has an active streaming deal" });
      }

      // Check if film has ANY expired deals - if so, it can't be re-licensed
      const studio = await storage.getStudio(playerGameId);
      if (!studio) {
        return res.status(404).json({ error: "Studio not found" });
      }

      const hasExpiredDeal = existingDeals.some(d => {
        if (!d.endWeek || !d.endYear) return false;
        const currentTime = studio.currentYear * 52 + studio.currentWeek;
        const dealEndTime = d.endYear * 52 + d.endWeek;
        return dealEndTime <= currentTime;
      });

      if (hasExpiredDeal) {
        return res.status(400).json({ error: "This film has already completed its streaming run and cannot be re-licensed to any service" });
      }

      const deal = await storage.createStreamingDeal({
        filmId,
        streamingServiceId,
        playerGameId,
        licenseFee,
        weeklyRevenue: 0,
        totalRevenue: licenseFee,
        startWeek,
        startYear,
        weeksActive: 0,
        isActive: true,
      });

      // Add license fee to studio budget
      const filmStudio = await storage.getStudio(film.studioId);
      if (filmStudio) {
        await storage.updateStudio(filmStudio.id, {
          budget: filmStudio.budget + licenseFee,
          totalEarnings: filmStudio.totalEarnings + licenseFee,
        });
      }

      res.status(201).json(deal);
    } catch (error) {
      console.error("Error creating streaming deal:", error);
      res.status(500).json({ error: "Failed to create streaming deal" });
    }
  });

  // === MARKETPLACE SCRIPTS ROUTES ===

  app.get("/api/marketplace-scripts", async (req, res) => {
    try {
      await storage.seedMarketplaceScripts();
      const scripts = await storage.getAvailableMarketplaceScripts();
      res.json(scripts);
    } catch (error) {
      console.error("Error fetching marketplace scripts:", error);
      res.status(500).json({ error: "Failed to fetch marketplace scripts" });
    }
  });

  app.get("/api/marketplace-scripts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const script = await storage.getMarketplaceScript(id);
      if (!script) {
        return res.status(404).json({ error: "Script not found" });
      }
      res.json(script);
    } catch (error) {
      console.error("Error fetching script:", error);
      res.status(500).json({ error: "Failed to fetch script" });
    }
  });

  app.post("/api/marketplace-scripts/:id/purchase", async (req, res) => {
    try {
      const { id } = req.params;
      const { studioId } = req.body;
      
      const script = await storage.getMarketplaceScript(id);
      if (!script) {
        return res.status(404).json({ error: "Script not found" });
      }
      
      if (!script.isAvailable) {
        return res.status(400).json({ error: "Script is no longer available" });
      }
      
      const studio = await storage.getStudio(studioId);
      if (!studio) {
        return res.status(404).json({ error: "Studio not found" });
      }
      
      if (studio.budget < script.price) {
        return res.status(400).json({ error: "Insufficient funds" });
      }
      
      await storage.updateStudio(studioId, {
        budget: studio.budget - script.price
      });
      
      await storage.updateMarketplaceScript(id, {
        isAvailable: false
      });
      
      res.json({ 
        success: true, 
        script,
        message: `Successfully purchased "${script.title}" for $${(script.price / 1000000).toFixed(1)}M`
      });
    } catch (error) {
      console.error("Error purchasing script:", error);
      res.status(500).json({ error: "Failed to purchase script" });
    }
  });

  // === EMAIL ROUTES ===

  app.get("/api/emails", async (req, res) => {
    try {
      const { playerGameId } = req.query;
      if (!playerGameId || typeof playerGameId !== 'string') {
        return res.status(400).json({ error: "playerGameId is required" });
      }
      const allEmails = await storage.getEmailsByPlayer(playerGameId);
      
      // Get current week/year to filter expired emails
      const studio = await storage.getStudio(playerGameId);
      if (!studio) {
        return res.json(allEmails);
      }
      
      const currentWeekTotal = studio.currentYear * 52 + studio.currentWeek;
      
      // Get active streaming deals to filter out streaming service emails
      const streamingDeals = await storage.getStreamingDealsByPlayer(playerGameId);
      const activeStreamingServiceIds = new Set(
        streamingDeals
          .filter(deal => deal.isActive)
          .map(deal => deal.streamingServiceId)
      );
      
      // Filter emails: remove expired ones, festival emails, and streaming offers from services with active deals
      const filteredEmails = allEmails.filter(email => {
        // Skip archived emails
        if (email.isArchived) return false;
        
        // Skip festival and awards campaign emails (removed features) - archive them
        if (email.type === 'festival' || email.type === 'festival_invite' || email.type === 'awards' || email.type === 'award_campaign') {
          storage.updateEmail(email.id, { isArchived: true });
          return false;
        }
        
        // Check expiration
        if (email.expiresWeek && email.expiresYear) {
          const expiresWeekTotal = email.expiresYear * 52 + email.expiresWeek;
          if (currentWeekTotal > expiresWeekTotal) {
            // Mark as archived asynchronously
            storage.updateEmail(email.id, { isArchived: true });
            return false;
          }
        }
        
        // Filter out streaming offers from services the player already has deals with
        if (email.type === 'streaming_offer' && email.actionData) {
          const actionData = email.actionData as Record<string, unknown>;
          const streamingServiceId = actionData.streamingServiceId as string;
          if (activeStreamingServiceIds.has(streamingServiceId)) {
            // Archive this email since player already has a deal with this service
            storage.updateEmail(email.id, { isArchived: true });
            return false;
          }
        }
        
        return true;
      });
      
      res.json(filteredEmails);
    } catch (error) {
      console.error("Error fetching emails:", error);
      res.status(500).json({ error: "Failed to fetch emails" });
    }
  });

  app.get("/api/emails/unread-count", async (req, res) => {
    try {
      const { playerGameId } = req.query;
      if (!playerGameId || typeof playerGameId !== 'string') {
        return res.status(400).json({ error: "playerGameId is required" });
      }
      
      // Get all emails and apply the same filtering as the email list endpoint
      const allEmails = await storage.getEmailsByPlayer(playerGameId);
      const studio = await storage.getStudio(playerGameId);
      
      if (!studio) {
        res.json({ count: 0 });
        return;
      }
      
      const currentWeekTotal = studio.currentYear * 52 + studio.currentWeek;
      
      // Get active streaming deals to filter out streaming service emails
      const streamingDeals = await storage.getStreamingDealsByPlayer(playerGameId);
      const activeStreamingServiceIds = new Set(
        streamingDeals
          .filter(deal => deal.isActive)
          .map(deal => deal.streamingServiceId)
      );
      
      // Count only unread emails that pass the same filters as the email list
      const unreadCount = allEmails.filter(email => {
        // Must be unread
        if (email.isRead) return false;
        
        // Skip archived emails
        if (email.isArchived) return false;
        
        // Skip festival and awards campaign emails (removed features)
        if (email.type === 'festival' || email.type === 'festival_invite' || email.type === 'awards' || email.type === 'award_campaign') return false;
        
        // Check expiration
        if (email.expiresWeek && email.expiresYear) {
          const expiresWeekTotal = email.expiresYear * 52 + email.expiresWeek;
          if (currentWeekTotal > expiresWeekTotal) {
            return false;
          }
        }
        
        // Filter out streaming offers from services the player already has deals with
        if (email.type === 'streaming_offer' && email.actionData) {
          const actionData = email.actionData as Record<string, unknown>;
          const streamingServiceId = actionData.streamingServiceId as string;
          if (activeStreamingServiceIds.has(streamingServiceId)) {
            return false;
          }
        }
        
        return true;
      }).length;
      
      res.json({ count: unreadCount });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ error: "Failed to fetch unread count" });
    }
  });

  app.get("/api/emails/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const email = await storage.getEmail(id);
      if (!email) {
        return res.status(404).json({ error: "Email not found" });
      }
      res.json(email);
    } catch (error) {
      console.error("Error fetching email:", error);
      res.status(500).json({ error: "Failed to fetch email" });
    }
  });

  app.patch("/api/emails/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const email = await storage.updateEmail(id, updates);
      if (!email) {
        return res.status(404).json({ error: "Email not found" });
      }
      res.json(email);
    } catch (error) {
      console.error("Error updating email:", error);
      res.status(500).json({ error: "Failed to update email" });
    }
  });

  app.delete("/api/emails/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteEmail(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting email:", error);
      res.status(500).json({ error: "Failed to delete email" });
    }
  });

  app.post("/api/emails", async (req, res) => {
    try {
      const emailData = req.body;
      const email = await storage.createEmail(emailData);
      res.status(201).json(email);
    } catch (error) {
      console.error("Error creating email:", error);
      res.status(500).json({ error: "Failed to create email" });
    }
  });

  // Handle email action (accept streaming offer, production deal, awards campaign)
  app.post("/api/emails/:id/action", async (req, res) => {
    try {
      const { id } = req.params;
      const email = await storage.getEmail(id);
      
      if (!email) {
        return res.status(404).json({ error: "Email not found" });
      }
      
      if (!email.hasAction) {
        return res.status(400).json({ error: "Email has no action" });
      }
      
      // Check if email is already archived (already acted upon)
      if (email.isArchived) {
        return res.status(400).json({ error: "This offer has already been accepted or expired" });
      }
      
      // Check if email has expired
      if (email.expiresWeek && email.expiresYear) {
        const studio = await storage.getStudio(email.playerGameId);
        if (studio) {
          const currentWeekTotal = studio.currentYear * 52 + studio.currentWeek;
          const expiresWeekTotal = email.expiresYear * 52 + email.expiresWeek;
          if (currentWeekTotal > expiresWeekTotal) {
            // Mark as archived since it's expired
            await storage.updateEmail(id, { isArchived: true });
            return res.status(400).json({ error: "This offer has expired" });
          }
        }
      }
      
      const actionData = email.actionData as Record<string, unknown>;
      
      if (email.type === 'streaming_offer') {
        // Accept streaming offer - create a streaming deal
        const filmId = actionData.filmId as string;
        const streamingServiceId = actionData.streamingServiceId as string;
        const licenseFee = actionData.offerAmount as number;
        
        // Get the studio to add the license fee
        const studio = await storage.getStudio(email.playerGameId);
        if (studio) {
          // Create the streaming deal
          await storage.createStreamingDeal({
            filmId,
            streamingServiceId,
            playerGameId: email.playerGameId,
            licenseFee,
            startWeek: studio.currentWeek,
            startYear: studio.currentYear,
            isActive: true,
          });
          
          // Add the license fee to the studio budget
          await storage.updateStudio(email.playerGameId, {
            budget: studio.budget + licenseFee,
            totalEarnings: studio.totalEarnings + licenseFee,
          });
          
          // Archive the email
          await storage.updateEmail(id, { isArchived: true });
          
          res.json({ 
            success: true, 
            message: `Streaming deal accepted! ${formatMoney(licenseFee)} added to budget.`,
            licenseFee 
          });
        } else {
          res.status(404).json({ error: "Studio not found" });
        }
      } else if (email.type === 'production_deal') {
        // Check if this is a first-look deal (talent pitch)
        const isFirstLookDeal = actionData.isFirstLookDeal as boolean;
        
        if (isFirstLookDeal) {
          // First-look deal - create a new film with the talent attached
          const studio = await storage.getStudio(email.playerGameId);
          if (!studio) {
            return res.status(404).json({ error: "Studio not found" });
          }
          
          const talentId = actionData.talentId as string;
          const talentType = actionData.talentType as string;
          const filmTitle = actionData.filmTitle as string;
          const filmGenre = actionData.filmGenre as string;
          const filmSynopsis = actionData.filmSynopsis as string;
          const suggestedBudget = actionData.suggestedBudget as number;
          const scriptQuality = actionData.scriptQuality as number;
          const devWeeks = actionData.devWeeks as number;
          const preWeeks = actionData.preWeeks as number;
          const prodWeeks = actionData.prodWeeks as number;
          const postWeeks = actionData.postWeeks as number;
          
          // Create the film with the talent already attached
          const newFilm = await storage.createFilm({
            studioId: studio.id,
            title: filmTitle,
            genre: filmGenre,
            synopsis: filmSynopsis,
            phase: 'development',
            productionBudget: suggestedBudget,
            scriptQuality,
            createdAtWeek: studio.currentWeek,
            createdAtYear: studio.currentYear,
            developmentDurationWeeks: devWeeks,
            preProductionDurationWeeks: preWeeks,
            productionDurationWeeks: prodWeeks,
            postProductionDurationWeeks: postWeeks,
            weeksInCurrentPhase: 0,
            // Attach talent based on their type
            ...(talentType === 'writer' ? { writerId: talentId } : {}),
            ...(talentType === 'director' ? { directorId: talentId } : {}),
          });
          
          // Mark talent as busy until development is complete
          let busyUntilWeek = studio.currentWeek + devWeeks;
          let busyUntilYear = studio.currentYear;
          if (busyUntilWeek > 52) {
            busyUntilYear += Math.floor(busyUntilWeek / 52);
            busyUntilWeek = ((busyUntilWeek - 1) % 52) + 1;
          }
          
          await storage.updateTalent(talentId, {
            currentFilmId: newFilm.id,
            busyUntilWeek,
            busyUntilYear,
          });
          
          // Generate roles for the film so player can cast actors
          try {
            await generateFilmRoles(newFilm.id, filmGenre, suggestedBudget);
          } catch (roleError) {
            console.error(`[FIRST-LOOK] Error generating roles for film ${newFilm.id}:`, roleError);
          }
          
          // Archive the email
          await storage.updateEmail(id, { isArchived: true });
          
          res.json({ 
            success: true, 
            message: `First-look deal accepted! "${filmTitle}" is now in development.`,
            filmId: newFilm.id,
            filmTitle,
          });
        } else {
          // Regular production deal or co-production deal
          const dealAmount = actionData.offerAmount as number;
          const dealType = actionData.dealType as string;
          const company = actionData.company as string;
          
          const studio = await storage.getStudio(email.playerGameId);
          if (studio) {
            await storage.updateStudio(email.playerGameId, {
              budget: studio.budget + dealAmount,
              totalEarnings: studio.totalEarnings + dealAmount,
            });
            
            // For co-production deals, create a record to track international rights
            if (dealType === 'co-production' && company) {
              await storage.createCoProductionDeal({
                playerGameId: email.playerGameId,
                partnerName: company,
                investmentAmount: dealAmount,
                internationalRightsPercent: 100, // Partner gets all international rights
                startWeek: studio.currentWeek,
                startYear: studio.currentYear,
                isActive: true,
              });
            }
            
            // Archive the email
            await storage.updateEmail(id, { isArchived: true });
            
            const message = dealType === 'co-production' 
              ? `Co-production deal accepted! ${formatMoney(dealAmount)} added to budget. ${company} will receive international distribution rights on your next film.`
              : `Production deal accepted! ${formatMoney(dealAmount)} added to budget.`;
            
            res.json({ 
              success: true, 
              message,
              dealAmount 
            });
          } else {
            res.status(404).json({ error: "Studio not found" });
          }
        }
      } else if (email.type === 'streaming_renewal') {
        // Accept streaming renewal - extend the deal
        const dealId = actionData.dealId as string;
        const filmId = actionData.filmId as string;
        const streamingServiceId = actionData.streamingServiceId as string;
        const renewalAmount = actionData.renewalAmount as number;
        const renewalYears = (actionData.renewalYears as number) || 2;
        
        const studio = await storage.getStudio(email.playerGameId);
        if (studio) {
          // Get the existing deal to extend it
          const existingDeal = await storage.getStreamingDeal(dealId);
          
          if (existingDeal) {
            // Reactivate and extend the deal with fresh metrics for new term
            await storage.updateStreamingDeal(dealId, {
              isActive: true,
              weeksActive: 0, // Reset weeks counter for new term
              licenseYears: renewalYears,
              licenseFee: renewalAmount, // New renewal fee (not cumulative)
              startWeek: studio.currentWeek, // Update to current week
              startYear: studio.currentYear, // Update to current year
              weeklyViews: [], // Reset views for fresh tracking
              totalViews: 0, // Reset total views for new term
              weeklyRevenue: 0, // Reset weekly revenue
              totalRevenue: 0, // Reset total revenue for new term
            });
          } else {
            // Create a new deal if original was deleted
            await storage.createStreamingDeal({
              filmId,
              streamingServiceId,
              playerGameId: email.playerGameId,
              licenseFee: renewalAmount,
              licenseYears: renewalYears,
              startWeek: studio.currentWeek,
              startYear: studio.currentYear,
              isActive: true,
              weeksActive: 0,
              weeklyViews: [],
              totalViews: 0,
              weeklyRevenue: 0,
              totalRevenue: 0,
            });
          }
          
          // Add the renewal fee to the studio budget
          await storage.updateStudio(email.playerGameId, {
            budget: studio.budget + renewalAmount,
            totalEarnings: studio.totalEarnings + renewalAmount,
          });
          
          // Archive the email
          await storage.updateEmail(id, { isArchived: true });
          
          res.json({ 
            success: true, 
            message: `Streaming deal renewed for ${renewalYears} years! ${formatMoney(renewalAmount)} added to budget.`,
            renewalAmount,
            renewalYears
          });
        } else {
          res.status(404).json({ error: "Studio not found" });
        }
      } else if (email.type === 'awards') {
        // Launch awards campaign - deduct campaign cost
        const campaignCost = actionData.campaignCost as number;
        const filmId = actionData.filmId as string;
        
        const studio = await storage.getStudio(email.playerGameId);
        if (studio) {
          if (studio.budget < campaignCost) {
            return res.status(400).json({ error: "Insufficient budget for awards campaign" });
          }
          
          // Deduct campaign cost
          await storage.updateStudio(email.playerGameId, {
            budget: studio.budget - campaignCost,
          });
          
          // Boost film's awards chances (add to awards array)
          const film = await storage.getFilm(filmId);
          if (film) {
            const newAwards = [...(film.awards || [])];
            if (!newAwards.includes('Awards Campaign')) {
              newAwards.push('Awards Campaign');
              await storage.updateFilm(filmId, { awards: newAwards });
            }
          }
          
          // Archive the email
          await storage.updateEmail(id, { isArchived: true });
          
          res.json({ 
            success: true, 
            message: `Awards campaign launched! ${formatMoney(campaignCost)} spent.`,
            campaignCost 
          });
        } else {
          res.status(404).json({ error: "Studio not found" });
        }
      } else if (email.type === 'slate-financing') {
        // Accept slate financing - add investment to budget and create deal record
        const slateAmount = actionData.offerAmount as number;
        const profitSharePercent = (actionData.profitSharePercent as number) || 25;
        const filmsCount = (actionData.filmsCount as number) || 4;
        const investorName = actionData.company as string;
        
        const studio = await storage.getStudio(email.playerGameId);
        if (studio) {
          // Add the slate financing amount to the studio budget
          await storage.updateStudio(email.playerGameId, {
            budget: studio.budget + slateAmount,
            totalEarnings: studio.totalEarnings + slateAmount,
          });
          
          // Create the slate financing deal record to track profit sharing
          await storage.createSlateFinancingDeal({
            playerGameId: email.playerGameId,
            investorName: investorName,
            investmentAmount: slateAmount,
            profitSharePercent: profitSharePercent,
            filmsRemaining: filmsCount,
            filmsCompleted: 0,
            totalProfitPaid: 0,
            isActive: true,
            startWeek: studio.currentWeek,
            startYear: studio.currentYear,
          });
          
          // Archive the email
          await storage.updateEmail(id, { isArchived: true });
          
          res.json({ 
            success: true, 
            message: `Slate financing accepted! ${formatMoney(slateAmount)} investment added to budget. ${investorName} will receive ${profitSharePercent}% of profits from your next ${filmsCount} films.`,
            slateAmount,
            profitSharePercent,
            filmsCount
          });
        } else {
          res.status(404).json({ error: "Studio not found" });
        }
      } else {
        res.status(400).json({ error: "Unknown email action type" });
      }
    } catch (error) {
      console.error("Error processing email action:", error);
      res.status(500).json({ error: "Failed to process email action" });
    }
  });

  app.post("/api/test-email", async (req, res) => {
    try {
      const { playerGameId } = req.body;
      if (!playerGameId) {
        return res.status(400).json({ error: "playerGameId is required" });
      }

      const studio = await storage.getStudio(playerGameId);
      if (!studio) {
        return res.status(404).json({ error: "Studio not found" });
      }

      const testEmail = await storage.createEmail({
        playerGameId,
        type: 'general',
        subject: '🎬 Test Email - Email System Works!',
        sender: 'System Admin',
        senderTitle: 'Replit',
        body: 'This is a test email to verify your email system is working properly. You can delete this email once confirmed.',
        hasAction: false,
        isRead: false,
        isArchived: false,
        sentWeek: studio.currentWeek,
        sentYear: studio.currentYear,
      });

      res.status(201).json(testEmail);
    } catch (error) {
      console.error("Error creating test email:", error);
      res.status(500).json({ error: "Failed to create test email" });
    }
  });

  // === AWARD SHOWS ROUTES ===
  
  app.get("/api/award-shows", async (req, res) => {
    try {
      // Seed award shows if needed
      await storage.seedAwardShows();
      const shows = await storage.getAllAwardShows();
      res.json(shows);
    } catch (error) {
      console.error("Error fetching award shows:", error);
      res.status(500).json({ error: "Failed to fetch award shows" });
    }
  });
  
  app.get("/api/award-shows/:showId/categories", async (req, res) => {
    try {
      const { showId } = req.params;
      const categories = await storage.getCategoriesByShow(showId);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching award categories:", error);
      res.status(500).json({ error: "Failed to fetch award categories" });
    }
  });
  
  app.get("/api/nominations/:playerGameId", async (req, res) => {
    try {
      const { playerGameId } = req.params;
      const nominations = await storage.getNominationsByPlayer(playerGameId);
      res.json(nominations);
    } catch (error) {
      console.error("Error fetching nominations:", error);
      res.status(500).json({ error: "Failed to fetch nominations" });
    }
  });
  
  app.get("/api/nominations/:playerGameId/:awardShowId/:ceremonyYear", async (req, res) => {
    try {
      const { playerGameId, awardShowId, ceremonyYear } = req.params;
      const nominations = await storage.getNominationsByCeremony(playerGameId, awardShowId, parseInt(ceremonyYear));
      res.json(nominations);
    } catch (error) {
      console.error("Error fetching ceremony nominations:", error);
      res.status(500).json({ error: "Failed to fetch ceremony nominations" });
    }
  });
  
  app.get("/api/ceremonies/:playerGameId", async (req, res) => {
    try {
      const { playerGameId } = req.params;
      const ceremonies = await storage.getCeremoniesByPlayer(playerGameId);
      res.json(ceremonies);
    } catch (error) {
      console.error("Error fetching ceremonies:", error);
      res.status(500).json({ error: "Failed to fetch ceremonies" });
    }
  });
  
  // ==================== TALENT EDITOR ROUTES ====================
  
  // Create new talent
  app.post("/api/talent", async (req, res) => {
    try {
      // Basic validation - name is required
      if (!req.body.name || typeof req.body.name !== 'string' || !req.body.name.trim()) {
        return res.status(400).json({ error: "Name is required" });
      }
      if (!req.body.type || !['actor', 'director', 'writer', 'composer'].includes(req.body.type)) {
        return res.status(400).json({ error: "Type must be 'actor', 'director', 'writer', or 'composer'" });
      }
      
      // Build talent data preserving all client-supplied fields
      const talentData = {
        name: req.body.name.trim(),
        type: req.body.type,
        gender: req.body.gender || 'unknown',
        nationality: req.body.nationality || 'American',
        starRating: typeof req.body.starRating === 'number' ? req.body.starRating : 3,
        askingPrice: typeof req.body.askingPrice === 'number' ? req.body.askingPrice : 5000000,
        boxOfficeAvg: typeof req.body.boxOfficeAvg === 'number' ? req.body.boxOfficeAvg : 100000000,
        awards: typeof req.body.awards === 'number' ? req.body.awards : 0,
        genres: typeof req.body.genres === 'object' && req.body.genres !== null ? req.body.genres : {},
        isActive: typeof req.body.isActive === 'boolean' ? req.body.isActive : true,
        imageUrl: req.body.imageUrl || null,
        birthYear: typeof req.body.birthYear === 'number' ? req.body.birthYear : null,
        popularity: typeof req.body.popularity === 'number' ? req.body.popularity : 50,
      };
      
      // Check if talent with same name already exists
      const existing = await storage.getTalentByName(talentData.name);
      if (existing) {
        return res.status(400).json({ error: "Talent with this name already exists" });
      }
      
      const newTalent = await storage.createTalent(talentData);
      res.status(201).json(newTalent);
    } catch (error) {
      console.error("Error creating talent:", error);
      res.status(500).json({ error: "Failed to create talent" });
    }
  });
  
  // Update talent
  app.patch("/api/talent/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if talent exists
      const existing = await storage.getTalent(id);
      if (!existing) {
        return res.status(404).json({ error: "Talent not found" });
      }
      
      // Build updates only from provided fields
      const updates: Record<string, any> = {};
      
      if (req.body.name !== undefined) {
        if (typeof req.body.name !== 'string' || !req.body.name.trim()) {
          return res.status(400).json({ error: "Name cannot be empty" });
        }
        updates.name = req.body.name.trim();
      }
      if (req.body.type !== undefined) {
        if (!['actor', 'director', 'writer', 'composer'].includes(req.body.type)) {
          return res.status(400).json({ error: "Type must be 'actor', 'director', 'writer', or 'composer'" });
        }
        updates.type = req.body.type;
      }
      if (req.body.gender !== undefined) updates.gender = req.body.gender;
      if (req.body.nationality !== undefined) updates.nationality = req.body.nationality;
      if (req.body.starRating !== undefined) updates.starRating = req.body.starRating;
      if (req.body.askingPrice !== undefined) updates.askingPrice = req.body.askingPrice;
      if (req.body.boxOfficeAvg !== undefined) updates.boxOfficeAvg = req.body.boxOfficeAvg;
      if (req.body.awards !== undefined) updates.awards = req.body.awards;
      if (req.body.isActive !== undefined) updates.isActive = req.body.isActive;
      if (req.body.imageUrl !== undefined) updates.imageUrl = req.body.imageUrl;
      if (req.body.birthYear !== undefined) updates.birthYear = req.body.birthYear;
      if (req.body.popularity !== undefined) updates.popularity = req.body.popularity;
      
      // Convert genres object to individual skill columns
      if (req.body.genres !== undefined && typeof req.body.genres === 'object' && req.body.genres !== null) {
        const genres = req.body.genres;
        if (genres.action !== undefined) updates.skillAction = genres.action;
        if (genres.drama !== undefined) updates.skillDrama = genres.drama;
        if (genres.comedy !== undefined) updates.skillComedy = genres.comedy;
        if (genres.thriller !== undefined) updates.skillThriller = genres.thriller;
        if (genres.horror !== undefined) updates.skillHorror = genres.horror;
        if (genres.scifi !== undefined) updates.skillScifi = genres.scifi;
        if (genres.animation !== undefined) updates.skillAnimation = genres.animation;
        if (genres.romance !== undefined) updates.skillRomance = genres.romance;
        if (genres.fantasy !== undefined) updates.skillFantasy = genres.fantasy;
        if (genres.musicals !== undefined) updates.skillMusicals = genres.musicals;
      }
      
      // If name is being changed, check for duplicates
      if (updates.name && updates.name !== existing.name) {
        const duplicate = await storage.getTalentByName(updates.name);
        if (duplicate) {
          return res.status(400).json({ error: "Talent with this name already exists" });
        }
      }
      
      const updated = await storage.updateTalent(id, updates);
      res.json(updated);
    } catch (error) {
      console.error("Error updating talent:", error);
      res.status(500).json({ error: "Failed to update talent" });
    }
  });
  
  // Randomize talent genre scores (one-time fix for fantasy/musicals skills)
  app.post("/api/talent/randomize-skills", async (req, res) => {
    try {
      const allTalent = await storage.getAllTalent();
      console.log(`[Randomize Skills] Found ${allTalent.length} talent to update`);
      let updated = 0;
      
      for (const t of allTalent) {
        // Generate random skills for fantasy and musicals (30-90 range for variety)
        const skillFantasy = 30 + Math.floor(Math.random() * 61);
        const skillMusicals = 30 + Math.floor(Math.random() * 61);
        
        // Use direct SQL to ensure columns are updated
        await storage.updateTalentSkillsDirect(t.id, skillFantasy, skillMusicals);
        updated++;
      }
      
      res.json({ success: true, message: `Randomized fantasy/musicals skills for ${updated} talent` });
    } catch (error) {
      console.error("Error randomizing talent skills:", error);
      res.status(500).json({ error: "Failed to randomize talent skills" });
    }
  });

  // Delete talent
  app.delete("/api/talent/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if talent exists
      const existing = await storage.getTalent(id);
      if (!existing) {
        return res.status(404).json({ error: "Talent not found" });
      }
      
      // Check if talent is in use
      const inUse = await storage.isTalentInUse(id);
      if (inUse) {
        return res.status(400).json({ 
          error: "Cannot delete talent that is assigned to films",
          message: "This talent is currently assigned to one or more films. Remove them from those films first."
        });
      }
      
      await storage.deleteTalent(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting talent:", error);
      res.status(500).json({ error: "Failed to delete talent" });
    }
  });
  
  // Check if talent is in use
  app.get("/api/talent/:id/in-use", async (req, res) => {
    try {
      const { id } = req.params;
      const inUse = await storage.isTalentInUse(id);
      res.json({ inUse });
    } catch (error) {
      console.error("Error checking talent usage:", error);
      res.status(500).json({ error: "Failed to check talent usage" });
    }
  });

  // Film Roles (casting system)
  app.get("/api/films/:filmId/roles", async (req, res) => {
    try {
      const { filmId } = req.params;
      const roles = await storage.getFilmRolesByFilm(filmId);
      console.log(`[FILM-ROLES] Film ${filmId} has ${roles.length} roles`);
      res.json(roles);
    } catch (error) {
      console.error("Error getting film roles:", error);
      res.status(500).json({ error: "Failed to get film roles" });
    }
  });

  app.post("/api/films/:filmId/roles", async (req, res) => {
    try {
      const { filmId } = req.params;
      const roleData = req.body;
      
      const role = await storage.createFilmRole({
        ...roleData,
        filmId,
      });
      res.json(role);
    } catch (error) {
      console.error("Error creating film role:", error);
      res.status(500).json({ error: "Failed to create film role" });
    }
  });

  app.patch("/api/roles/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const role = await storage.updateFilmRole(id, updates);
      if (!role) {
        return res.status(404).json({ error: "Role not found" });
      }
      res.json(role);
    } catch (error) {
      console.error("Error updating film role:", error);
      res.status(500).json({ error: "Failed to update film role" });
    }
  });

  app.delete("/api/roles/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteFilmRole(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting film role:", error);
      res.status(500).json({ error: "Failed to delete film role" });
    }
  });

  app.post("/api/films/:filmId/sync-roles", async (req, res) => {
    try {
      const { filmId } = req.params;
      const film = await storage.getFilm(filmId);
      if (!film) {
        return res.status(404).json({ error: "Film not found" });
      }

      const roles = await storage.getFilmRolesByFilm(filmId);
      const castIds = film.castIds || [];
      
      let synced = 0;
      for (const castId of castIds) {
        const existingRole = roles.find(r => r.actorId === castId);
        if (!existingRole) {
          const unassignedRole = roles.find(r => !r.actorId && !r.isCast);
          if (unassignedRole) {
            await storage.updateFilmRole(unassignedRole.id, {
              actorId: castId,
              isCast: true,
            });
            synced++;
          }
        }
      }

      res.json({ success: true, synced, message: `Synchronized ${synced} roles` });
    } catch (error) {
      console.error("Error syncing film roles:", error);
      res.status(500).json({ error: "Failed to sync film roles" });
    }
  });

  // Talent availability checking
  app.get("/api/talent/:id/availability", async (req, res) => {
    try {
      const { id } = req.params;
      const { week, year } = req.query;
      
      const talentData = await storage.getTalent(id);
      if (!talentData) {
        return res.status(404).json({ error: "Talent not found" });
      }
      
      // Check if talent is busy
      const currentWeek = parseInt(week as string) || 1;
      const currentYear = parseInt(year as string) || 2025;
      
      let isAvailable = true;
      let busyUntil = null;
      
      if (talentData.busyUntilWeek && talentData.busyUntilYear) {
        if (talentData.busyUntilYear > currentYear || 
            (talentData.busyUntilYear === currentYear && talentData.busyUntilWeek > currentWeek)) {
          isAvailable = false;
          busyUntil = { week: talentData.busyUntilWeek, year: talentData.busyUntilYear };
        }
      }
      
      res.json({
        isAvailable,
        busyUntil,
        currentFilmId: talentData.currentFilmId,
      });
    } catch (error) {
      console.error("Error checking talent availability:", error);
      res.status(500).json({ error: "Failed to check talent availability" });
    }
  });

  // Calculate casting acceptance probability
  app.post("/api/casting/calculate-acceptance", async (req, res) => {
    try {
      const { talentId, filmId, roleImportance, offeredSalary } = req.body;
      
      const talentData = await storage.getTalent(talentId);
      const film = await storage.getFilm(filmId);
      const studio = film ? await storage.getStudio(film.studioId) : null;
      
      if (!talentData || !film || !studio) {
        return res.status(404).json({ error: "Talent, film, or studio not found" });
      }
      
      // Get director fame for willingness calculation
      let directorFame = 50;
      if (film.directorId) {
        const director = await storage.getTalent(film.directorId);
        if (director) {
          directorFame = director.fame || 50;
        }
      }
      
      // Base acceptance probability factors
      // 1. Studio prestige (1-5) - main factor
      const studioPrestige = studio.prestigeLevel || 1;
      const prestigeFactor = 20 + (studioPrestige * 15); // 20-95% base from prestige
      
      // 2. Director fame influence on talent willingness
      const directorFameFactor = (directorFame / 100) * 20; // 0-20% bonus
      
      // 3. Role importance (lead = +15%, supporting = +10%, minor = +5%)
      let roleBonus = 5;
      if (roleImportance === 'lead') roleBonus = 15;
      else if (roleImportance === 'supporting') roleBonus = 10;
      
      // 4. Salary factor (offered vs asking price)
      const askingPrice = talentData.askingPrice || 1000000;
      const salaryRatio = offeredSalary / askingPrice;
      let salaryFactor = 0;
      if (salaryRatio >= 1.5) salaryFactor = 15;
      else if (salaryRatio >= 1.2) salaryFactor = 10;
      else if (salaryRatio >= 1.0) salaryFactor = 5;
      else if (salaryRatio >= 0.8) salaryFactor = 0;
      else salaryFactor = -20; // Lowball offer penalty
      
      // 5. Genre match bonus
      const filmGenre = film.genre?.toLowerCase() || '';
      const talentGenresObj = (talentData.genres as Record<string, number>) || {};
      const genreMatch = Object.keys(talentGenresObj).some(g => g.toLowerCase() === filmGenre && talentGenresObj[g] > 0);
      const genreBonus = genreMatch ? 10 : -5;
      
      // Calculate total probability (capped 5-95%)
      let probability = prestigeFactor + directorFameFactor + roleBonus + salaryFactor + genreBonus;
      
      // Add randomness factor (-5 to +5)
      probability += Math.random() * 10 - 5;
      
      probability = Math.max(5, Math.min(95, probability));
      
      res.json({
        probability: Math.round(probability),
        factors: {
          studioPrestige: Math.round(prestigeFactor),
          directorFame: Math.round(directorFameFactor),
          roleImportance: roleBonus,
          salary: salaryFactor,
          genreMatch: genreBonus,
        }
      });
    } catch (error) {
      console.error("Error calculating acceptance probability:", error);
      res.status(500).json({ error: "Failed to calculate acceptance probability" });
    }
  });

  // Attempt to hire talent for a role
  app.post("/api/casting/hire", async (req, res) => {
    try {
      const { talentId, roleId, filmId, offeredSalary, currentWeek, currentYear, productionDurationWeeks } = req.body;
      
      const talentData = await storage.getTalent(talentId);
      const role = await storage.getFilmRole(roleId);
      const film = await storage.getFilm(filmId);
      const studio = film ? await storage.getStudio(film.studioId) : null;
      
      if (!talentData || !role || !film || !studio) {
        return res.status(404).json({ error: "Required data not found" });
      }
      
      // Check availability
      if (talentData.busyUntilWeek && talentData.busyUntilYear) {
        if (talentData.busyUntilYear > currentYear || 
            (talentData.busyUntilYear === currentYear && talentData.busyUntilWeek > currentWeek)) {
          return res.status(400).json({ 
            success: false, 
            reason: "unavailable",
            message: `${talentData.name} is busy until Week ${talentData.busyUntilWeek}, Year ${talentData.busyUntilYear}`
          });
        }
      }
      
      // Calculate acceptance probability
      const studioPrestige = studio.prestigeLevel || 1;
      let directorFame = 50;
      if (film.directorId) {
        const director = await storage.getTalent(film.directorId);
        if (director) directorFame = director.fame || 50;
      }
      
      const prestigeFactor = 20 + (studioPrestige * 15);
      const directorFameFactor = (directorFame / 100) * 20;
      
      let roleBonus = 5;
      if (role.importance === 'lead') roleBonus = 15;
      else if (role.importance === 'supporting') roleBonus = 10;
      
      const askingPrice = talentData.askingPrice || 1000000;
      const salaryRatio = offeredSalary / askingPrice;
      let salaryFactor = 0;
      if (salaryRatio >= 1.5) salaryFactor = 15;
      else if (salaryRatio >= 1.2) salaryFactor = 10;
      else if (salaryRatio >= 1.0) salaryFactor = 5;
      else if (salaryRatio >= 0.8) salaryFactor = 0;
      else salaryFactor = -20;
      
      const filmGenre = film.genre?.toLowerCase() || '';
      const talentGenres = (talentData.genres || []).map(g => g.toLowerCase());
      const genreBonus = talentGenres.includes(filmGenre) ? 10 : -5;
      
      let probability = prestigeFactor + directorFameFactor + roleBonus + salaryFactor + genreBonus;
      probability += Math.random() * 10 - 5;
      probability = Math.max(5, Math.min(95, probability));
      
      // Roll the dice
      const roll = Math.random() * 100;
      const accepted = roll <= probability;
      
      if (accepted) {
        // Mark talent as busy
        const busyUntilWeek = (currentWeek + (productionDurationWeeks || 20) - 1) % 52 + 1;
        const yearsToAdd = Math.floor((currentWeek + (productionDurationWeeks || 20) - 1) / 52);
        const busyUntilYear = currentYear + yearsToAdd;
        
        await storage.updateTalent(talentId, {
          currentFilmId: filmId,
          busyUntilWeek,
          busyUntilYear,
        });
        
        // First, check if this role is already assigned to a different actor
        const currentRole = await storage.getFilmRole(roleId);
        if (currentRole?.actorId && currentRole.actorId !== talentId) {
          // Remove this role from the previous actor's assignments
          const previousActorId = currentRole.actorId;
          const currentFilm = await storage.getFilm(filmId);
          const currentCastIds = currentFilm?.castIds || [];
          
          // Update the film to remove the previous actor if they have no other roles
          const filmRoles = await storage.getFilmRolesByFilm(filmId);
          const actorHasOtherRoles = filmRoles.some(
            r => r.actorId === previousActorId && r.id !== roleId && r.isCast
          );
          
          let newCastIds = [...currentCastIds];
          if (!actorHasOtherRoles) {
            newCastIds = currentCastIds.filter(id => id !== previousActorId);
          }
          
          await storage.updateFilm(filmId, {
            castIds: newCastIds
          });
        }
        
        // Now assign the new actor to the role
        const updatedRole = await storage.updateFilmRole(roleId, {
          actorId: talentId,
          isCast: true,
        });
        
        // Re-fetch the CURRENT film to get latest talentBudget (in case other actors were hired)
        const currentFilm = await storage.getFilm(filmId);
        // Add talent to film's castIds if not already present
        const currentCastIds = currentFilm?.castIds || [];
        const newCastIds = currentCastIds.includes(talentId) 
          ? currentCastIds 
          : [...currentCastIds, talentId];
          
        const newTalentBudget = (currentFilm?.talentBudget || 0) + offeredSalary;
        
        const updatedFilm = await storage.updateFilm(filmId, {
          castIds: newCastIds,
          talentBudget: newTalentBudget,
        });
        console.error(`HIRE: Film after update - castIds:`, updatedFilm?.castIds, `talentBudget:`, updatedFilm?.talentBudget);
        
        return res.json({
          success: true,
          accepted: true,
          probability: Math.round(probability),
          message: `${talentData.name} has accepted the role of ${role.roleName}!`
        });
      } else {
        return res.json({
          success: true,
          accepted: false,
          probability: Math.round(probability),
          roll: Math.round(roll),
          message: `${talentData.name} has declined the offer.`
        });
      }
    } catch (error) {
      console.error("Error hiring talent:", error);
      res.status(500).json({ error: "Failed to hire talent" });
    }
  });

  // Get available talent for casting (filters by type and availability)
  app.get("/api/casting/available-talent", async (req, res) => {
    try {
      const { type, week, year, genre } = req.query;
      const currentWeek = parseInt(week as string) || 1;
      const currentYear = parseInt(year as string) || 2025;
      
      let allTalent = await storage.getAllTalent();
      
      // Filter by type
      if (type) {
        allTalent = allTalent.filter(t => t.type === type);
      }
      
      // Filter out busy talent
      allTalent = allTalent.filter(t => {
        if (!t.busyUntilWeek || !t.busyUntilYear) return true;
        if (t.busyUntilYear < currentYear) return true;
        if (t.busyUntilYear === currentYear && t.busyUntilWeek <= currentWeek) return true;
        return false;
      });
      
      // Sort by genre match if genre provided
      if (genre) {
        const genreLower = (genre as string).toLowerCase();
        allTalent.sort((a, b) => {
          const aGenres = (a.genres as Record<string, number>) || {};
          const bGenres = (b.genres as Record<string, number>) || {};
          const aMatch = Object.keys(aGenres).some(g => g.toLowerCase() === genreLower && aGenres[g] > 0) ? 1 : 0;
          const bMatch = Object.keys(bGenres).some(g => g.toLowerCase() === genreLower && bGenres[g] > 0) ? 1 : 0;
          if (bMatch !== aMatch) return bMatch - aMatch;
          return (b.starRating || 0) - (a.starRating || 0);
        });
      } else {
        // Sort by star rating
        allTalent.sort((a, b) => (b.starRating || 0) - (a.starRating || 0));
      }
      
      res.json(allTalent);
    } catch (error) {
      console.error("Error getting available talent:", error);
      res.status(500).json({ error: "Failed to get available talent" });
    }
  });

  // Migration endpoint to backfill country breakdown data for existing released films
  app.post("/api/migrate/backfill-country-data", async (req, res) => {
    try {
      const { force } = req.query; // Add ?force=true to recalculate all films
      const allFilms = await storage.getAllFilms();
      const releasedFilms = allFilms.filter(f => f.phase === 'released' && f.totalBoxOffice > 0);
      
      let updated = 0;
      for (const film of releasedFilms) {
        // Check if country data is empty or missing
        const hasCountryData = film.totalBoxOfficeByCountry && 
          typeof film.totalBoxOfficeByCountry === 'object' &&
          Object.keys(film.totalBoxOfficeByCountry as object).length > 0;
        
        if (!hasCountryData || force === 'true') {
          // Generate weekly breakdown for each week (with genre-based distribution)
          const weeklyByCountry: Record<string, number>[] = [];
          for (const weeklyGross of film.weeklyBoxOffice) {
            weeklyByCountry.push(distributeBoxOfficeByCountry(weeklyGross, film.genre));
          }
          
          // Calculate total by summing up all weekly data (ensures consistency)
          const totalByCountry: Record<string, number> = {};
          for (const weekData of weeklyByCountry) {
            for (const [country, amount] of Object.entries(weekData)) {
              totalByCountry[country] = (totalByCountry[country] || 0) + amount;
            }
          }
          
          await storage.updateFilm(film.id, {
            totalBoxOfficeByCountry: totalByCountry,
            weeklyBoxOfficeByCountry: weeklyByCountry,
          });
          updated++;
        }
      }
      
      console.log(`[migration] Backfilled country data for ${updated} films`);
      res.json({ success: true, filmsUpdated: updated });
    } catch (error) {
      console.error("Error backfilling country data:", error);
      res.status(500).json({ error: "Failed to backfill country data" });
    }
  });

  // Reset film to post-production state (for re-scheduling)
  app.post("/api/films/:id/reset-to-postproduction", async (req, res) => {
    try {
      const { id } = req.params;
      const film = await storage.getFilm(id);
      if (!film) {
        return res.status(404).json({ error: "Film not found" });
      }
      
      // Delete any existing territory releases
      const releases = await storage.getFilmReleasesByFilm(id);
      for (const release of releases) {
        await storage.deleteFilmRelease(release.id);
      }
      
      // Reset film to post-production
      await storage.updateFilm(id, {
        phase: 'post-production',
        releaseWeek: null,
        releaseYear: null,
        weeklyBoxOffice: [],
        weeklyBoxOfficeByCountry: [],
        totalBoxOffice: 0,
        totalBoxOfficeByCountry: {},
      });
      
      res.json({ message: "Film reset to post-production", film });
    } catch (error) {
      console.error("Error resetting film:", error);
      res.status(500).json({ error: "Failed to reset film" });
    }
  });

  // Create a sequel for a released film
  app.post("/api/films/:id/create-sequel", async (req, res) => {
    try {
      const { id } = req.params;
      const { title } = req.body;
      
      const originalFilm = await storage.getFilm(id);
      if (!originalFilm) {
        return res.status(404).json({ error: "Original film not found" });
      }
      
      if (originalFilm.phase !== 'released') {
        return res.status(400).json({ error: "Only released films can have sequels" });
      }
      
      // Get current studio game state to use correct week/year
      const studio = await storage.getStudio(originalFilm.studioId);
      const currentWeek = studio?.currentWeek || 1;
      const currentYear = studio?.currentYear || 2025;
      
      // Check if film already has a franchise or create one
      let franchise = await storage.getFilmFranchise(id);
      if (!franchise) {
        franchise = await storage.createFranchise({
          studioId: originalFilm.studioId,
          name: originalFilm.title,
          originalFilmId: id,
          totalFilms: 1,
          totalRevenue: originalFilm.totalBoxOffice,
          createdWeek: currentWeek,
          createdYear: currentYear,
        } as any);
        await storage.updateFilm(id, { franchiseId: franchise.id });
      }
      
      // Create the sequel film
      const sequelFilm = await storage.createFilm({
        studioId: originalFilm.studioId,
        title: title || `${originalFilm.title} 2`,
        genre: originalFilm.genre,
        synopsis: `Sequel to ${originalFilm.title}`,
        phase: 'development',
        franchiseId: franchise.id,
        isSequel: true,
        prequelFilmId: id,
        scriptQuality: Math.floor(originalFilm.scriptQuality + Math.random() * 10 - 5),
        productionBudget: Math.floor(originalFilm.productionBudget * 1.15),
        marketingBudget: Math.floor(originalFilm.marketingBudget * 1.1),
        createdAtWeek: currentWeek,
        createdAtYear: currentYear,
      } as any);
      
      // Copy film roles from original film (without assigning actors)
      const originalRoles = await storage.getFilmRolesByFilm(id);
      console.log(`[SEQUEL] Original film ${id} has ${originalRoles.length} roles`);
      for (const role of originalRoles) {
        const newRole = await storage.createFilmRole({
          filmId: sequelFilm.id,
          roleName: role.roleName,
          characterAge: role.characterAge,
          importance: role.importance,
          characterType: role.characterType,
          genderPreference: role.genderPreference,
          actorId: null,
          isCast: false,
        });
        console.log(`[SEQUEL] Created role "${role.roleName}" for sequel`);
      }
      
      // Verify roles were created
      const verifyRoles = await storage.getFilmRolesByFilm(sequelFilm.id);
      console.log(`[SEQUEL] Sequel film ${sequelFilm.id} now has ${verifyRoles.length} roles`);
      
      // Update franchise stats
      await storage.updateFranchise(franchise.id, {
        totalFilms: (franchise.totalFilms || 1) + 1,
        totalRevenue: (franchise.totalRevenue || 0) + (originalFilm.totalBoxOffice || 0),
      });
      
      res.json({ sequel: sequelFilm, franchise });
    } catch (error) {
      console.error("Error creating sequel:", error);
      res.status(500).json({ error: "Failed to create sequel" });
    }
  });

  app.post("/api/films/:id/set-sequel-franchise", async (req, res) => {
    try {
      const { id } = req.params;
      const { originalFilmId } = req.body;
      
      const sequelFilm = await storage.getFilm(id);
      const originalFilm = await storage.getFilm(originalFilmId);
      
      if (!sequelFilm || !originalFilm) {
        return res.status(404).json({ error: "Film not found" });
      }
      
      const studio = await storage.getStudio(sequelFilm.studioId);
      const currentWeek = studio?.currentWeek || 1;
      const currentYear = studio?.currentYear || 2025;
      
      let franchise = await storage.getFilmFranchise(originalFilmId);
      if (!franchise) {
        franchise = await storage.createFranchise({
          studioId: originalFilm.studioId,
          name: originalFilm.title,
          originalFilmId: originalFilmId,
          totalFilms: 1,
          totalRevenue: originalFilm.totalBoxOffice || 0,
          createdWeek: currentWeek,
          createdYear: currentYear,
        } as any);
        await storage.updateFilm(originalFilmId, { franchiseId: franchise.id });
      }
      
      await storage.updateFilm(id, {
        franchiseId: franchise.id,
        isSequel: true,
        prequelFilmId: originalFilmId,
      });
      
      await storage.updateFranchise(franchise.id, {
        totalFilms: (franchise.totalFilms || 1) + 1,
      });
      
      res.json({ success: true, franchise });
    } catch (error) {
      console.error("Error setting sequel franchise:", error);
      res.status(500).json({ error: "Failed to set franchise" });
    }
  });

  // Get franchise details
  app.get("/api/franchises/:franchiseId", async (req, res) => {
    try {
      const { franchiseId } = req.params;
      const franchise = await storage.getFranchise(franchiseId);
      if (!franchise) {
        return res.status(404).json({ error: "Franchise not found" });
      }
      
      const filmsByStudio = await storage.getFilmsByStudio(franchise.studioId);
      const franchiseFilms = filmsByStudio.filter(f => f.franchiseId === franchiseId);
      
      res.json({ franchise, films: franchiseFilms });
    } catch (error) {
      console.error("Error fetching franchise:", error);
      res.status(500).json({ error: "Failed to fetch franchise" });
    }
  });

  return httpServer;
}
