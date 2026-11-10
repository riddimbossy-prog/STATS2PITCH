import type { MarketId } from '../domain';
import { MARKET_LABEL } from './markets';

export interface SimilaritySubject {
  id: string;
  matchId: string;
  market: MarketId;
  confidence: number;
  teamRate: number;
  formRate: number;
}

/**
 * Same market, then closeness of confidence, trend rate and form rate.
 * A different market scores 0. This is a heuristic, not a learned model.
 */
export function similarityScore(anchor: SimilaritySubject, candidate: SimilaritySubject): number {
  if (anchor.market !== candidate.market) return 0;
  const confidence = 1 - Math.min(1, Math.abs(anchor.confidence - candidate.confidence) / 0.2);
  const trend = 1 - Math.min(1, Math.abs(anchor.teamRate - candidate.teamRate) / 0.2);
  const form = 1 - Math.min(1, Math.abs(anchor.formRate - candidate.formRate) / 0.25);
  return confidence * 0.4 + trend * 0.35 + form * 0.25;
}

export interface Suggestion {
  pickId: string;
  score: number;
  because: string;
}

export function suggestSimilar(anchors: SimilaritySubject[], pool: SimilaritySubject[], limit = 8): Suggestion[] {
  if (anchors.length === 0) return [];
  const own = new Set(anchors.map((anchor) => anchor.id));
  const suggestions: Suggestion[] = [];
  for (const candidate of pool) {
    if (own.has(candidate.id)) continue;
    let best = 0;
    let market: MarketId | null = null;
    for (const anchor of anchors) {
      if (anchor.matchId === candidate.matchId && anchor.market === candidate.market) continue;
      const score = similarityScore(anchor, candidate);
      if (score > best) {
        best = score;
        market = anchor.market;
      }
    }
    if (best >= 0.72 && market) {
      suggestions.push({
        pickId: candidate.id,
        score: best,
        because: `Close to a ${MARKET_LABEL[market]} pick you tracked`,
      });
    }
  }
  suggestions.sort((a, b) => b.score - a.score || a.pickId.localeCompare(b.pickId));
  return suggestions.slice(0, limit);
}
