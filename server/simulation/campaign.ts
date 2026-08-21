import { normal, systemRng, type RandomSource } from "./rng";
import { DEFAULT_SIMULATION_CONFIG } from "./balance-config";
import type {
  CampaignActionInput,
  CampaignActionKind,
  CampaignActionProfile,
  CampaignActionResult,
  TerritoryCampaignState,
} from "./types";

const clamp = (value: number, minimum = 0, maximum = 100): number =>
  Math.max(minimum, Math.min(maximum, value));
const BALANCE = DEFAULT_SIMULATION_CONFIG.campaign;

export const CAMPAIGN_ACTIONS: Record<CampaignActionKind, CampaignActionProfile> = {
  teaser: {
    kind: "teaser",
    name: "Teaser / Trailer Launch",
    minimumWeeksFromRelease: 6,
    maximumWeeksFromRelease: 16,
    awarenessEffect: 0.82,
    interestEffect: 0.42,
    expectationEffect: 0.38,
    buzzEffect: 0.3,
    responseVolatility: 0.18,
  },
  "targeted-media": {
    kind: "targeted-media",
    name: "Targeted Media Campaign",
    minimumWeeksFromRelease: 1,
    maximumWeeksFromRelease: 10,
    awarenessEffect: 0.58,
    interestEffect: 0.88,
    expectationEffect: 0.32,
    buzzEffect: 0.12,
    responseVolatility: 0.1,
  },
  "broad-awareness": {
    kind: "broad-awareness",
    name: "Broad Awareness Campaign",
    minimumWeeksFromRelease: 2,
    maximumWeeksFromRelease: 10,
    awarenessEffect: 0.94,
    interestEffect: 0.62,
    expectationEffect: 0.5,
    buzzEffect: 0.08,
    responseVolatility: 0.08,
  },
  publicity: {
    kind: "publicity",
    name: "Premiere & Press Tour",
    minimumWeeksFromRelease: 1,
    maximumWeeksFromRelease: 6,
    awarenessEffect: 0.34,
    interestEffect: 0.38,
    expectationEffect: 0.28,
    buzzEffect: 0.92,
    responseVolatility: 0.24,
  },
  "opening-blitz": {
    kind: "opening-blitz",
    name: "Opening-Week Blitz",
    minimumWeeksFromRelease: 0,
    maximumWeeksFromRelease: 2,
    awarenessEffect: 0.46,
    interestEffect: 1,
    expectationEffect: 0.82,
    buzzEffect: 0.1,
    responseVolatility: 0.06,
  },
  "post-release": {
    kind: "post-release",
    name: "Post-Release Expansion",
    minimumWeeksFromRelease: -8,
    maximumWeeksFromRelease: -1,
    awarenessEffect: 0.52,
    interestEffect: 0.76,
    expectationEffect: 0.08,
    buzzEffect: 0.58,
    responseVolatility: 0.14,
  },
};

export function createInitialCampaignState(
  organicAwareness = 8,
  launchInterest = 10,
  expectation = 52,
): TerritoryCampaignState {
  return {
    awareness: clamp(organicAwareness),
    interest: clamp(launchInterest),
    expectation: clamp(expectation),
    buzz: 0,
    paidReach: 0,
  };
}

export function isCampaignActionAvailable(
  action: CampaignActionKind,
  weeksFromRelease: number,
): boolean {
  const profile = CAMPAIGN_ACTIONS[action];
  return weeksFromRelease >= profile.minimumWeeksFromRelease &&
    weeksFromRelease <= profile.maximumWeeksFromRelease;
}

/**
 * All paid campaign actions use the same reach curve. Named actions only choose
 * how new reach is converted into awareness, intent, expectations, and buzz.
 */
export function applyCampaignAction(
  input: CampaignActionInput,
  rng: RandomSource = systemRng,
): CampaignActionResult {
  const profile = CAMPAIGN_ACTIONS[input.action];
  const marketScale = Math.max(0.025, input.territoryMarketShare / 0.35);
  const halfSaturation = BALANCE.domesticReachHalfSaturation *
    Math.pow(marketScale, 0.82);
  const timingFit = isCampaignActionAvailable(input.action, input.weeksFromRelease)
    ? 1
    : 0.35;
  const responseNoise = normal(rng) * profile.responseVolatility;
  const response = clamp(
    input.creativeStrength / 100 + responseNoise,
    0.25,
    1.35,
  );
  const effectiveSpend = Math.max(0, input.spend) *
    clamp(input.territoryFit, 0, 1.35) *
    clamp(input.targetingFit, 0, 1.35) *
    timingFit *
    response;
  const paidReach = clamp(input.state.paidReach, 0, 1);
  const reachGain = (1 - paidReach) *
    (1 - Math.exp(-effectiveSpend / Math.max(1, halfSaturation)));

  const lift = (current: number, effect: number, ceiling = 100): number =>
    clamp(current + (ceiling - current) * reachGain * effect);
  const buzzDelta = reachGain * profile.buzzEffect * (response - 0.42) * 52;

  return {
    state: {
      awareness: lift(input.state.awareness, profile.awarenessEffect),
      interest: lift(input.state.interest, profile.interestEffect),
      expectation: lift(input.state.expectation, profile.expectationEffect),
      buzz: clamp(input.state.buzz + buzzDelta, -100, 100),
      paidReach: clamp(paidReach + reachGain, 0, 1),
    },
    reachGain,
    effectiveSpend,
    response,
  };
}

export function advanceCampaignWeek(
  state: TerritoryCampaignState,
  options: {
    isReleased: boolean;
    /** Intrinsic audience experience on the canonical 0-100 scale. */
    audienceExperience?: number;
    openingExpectation?: number;
    criticScore?: number;
    earnedMediaShock?: number;
  },
): TerritoryCampaignState {
  const audienceExperience = clamp(options.audienceExperience ?? 50);
  const expectation = clamp(options.openingExpectation ?? state.expectation);
  const womDelta = options.isReleased ? audienceExperience - expectation : 0;
  const earnedStrength = options.isReleased
    ? clamp((womDelta - 4) / 24, 0, 1) * clamp(state.interest / 100, 0.15, 1)
    : 0;
  const criticEarnedStrength = options.isReleased
    ? clamp((clamp(options.criticScore ?? 50) - 72) / 28, 0, 1) *
      clamp(state.awareness / 100, 0.15, 1)
    : 0;
  const earnedShock = clamp(options.earnedMediaShock ?? 0, -1, 1);
  const organicReach = clamp(
    earnedStrength * 0.12 + criticEarnedStrength * 0.012 + earnedShock * 0.025,
    0,
    BALANCE.maximumOrganicReachPerWeek,
  );

  return {
    awareness: clamp(
      state.awareness * (options.isReleased ? 0.997 : BALANCE.prereleaseAwarenessDecay) +
      (100 - state.awareness) * organicReach,
    ),
    interest: clamp(
      state.interest * (options.isReleased
        ? BALANCE.postreleaseInterestDecay
        : BALANCE.prereleaseInterestDecay) +
      (100 - state.interest) * organicReach * 0.78,
    ),
    expectation: clamp(state.expectation),
    buzz: clamp(
      state.buzz * BALANCE.postreleaseBuzzDecay +
      womDelta * earnedStrength * 0.32 +
      criticEarnedStrength * 1.5 +
      earnedShock * 4,
      -100,
      100,
    ),
    paidReach: clamp(state.paidReach, 0, 1),
  };
}

