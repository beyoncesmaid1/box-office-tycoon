export {
  DEFAULT_SIMULATION_CONFIG,
  SIMULATION_GENRES,
  resolveGenre,
  type DistributionTargets,
  type CampaignBalanceConfig,
  type ExhibitionBalanceConfig,
  type GenreBalance,
  type QualityBalanceConfig,
  type BoxOfficeBalanceConfig,
  type SimulationBalanceConfig,
  type SimulationGenre,
} from "./balance-config";
export { simulateFilmQuality } from "./quality";
export { simulateBoxOffice } from "./box-office";
export {
  allocateTerritoryAudienceMarket,
  type TerritoryAudienceAllocation,
  type TerritoryAudienceCandidate,
  type TerritoryAudienceMarketResult,
} from "./audience-market";
export {
  calculateCompetitionPressure,
  type CompetitionRival,
  type CompetitionTarget,
} from "./competition";
export {
  chooseAIReleaseDate,
  type AIReleaseDateInput,
  type ScheduledFilmLike,
  type ScheduledPremiumBookingLike,
} from "./release-calendar";
export {
  CAMPAIGN_ACTIONS,
  advanceCampaignWeek,
  applyCampaignAction,
  createInitialCampaignState,
  isCampaignActionAvailable,
} from "./campaign";
export {
  allocatePremiumFormat,
  calculateTerritoryTheaterCount,
  calculateTerritoryRegularCapacityAdmissions,
  calculatePremiumSuitability,
  estimatePremiumFormatDemand,
  simulateTerritoryWeek,
} from "./exhibition";
export type { TheaterAllocationInput } from "./exhibition";
export {
  chance,
  correlatedNormals,
  createSeededRng,
  normal,
  systemRng,
  uniform,
  type RandomSource,
  type Seed,
} from "./rng";
export type {
  BoxOfficeInput,
  BoxOfficeResult,
  CampaignActionInput,
  CampaignActionKind,
  CampaignActionProfile,
  CampaignActionResult,
  DepartmentBudgets,
  FilmQualityInput,
  FilmQualityResult,
  PremiumAccessLevel,
  PremiumAllocation,
  PremiumAllocationCandidate,
  PremiumBookingLike,
  PremiumFormat,
  PremiumSuitabilityInput,
  PremiumSuitabilityResult,
  QualityComponentBreakdown,
  TalentLike,
  TerritoryCampaignState,
  TerritoryWeekInput,
  TerritoryWeekResult,
} from "./types";
