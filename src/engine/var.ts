import type { RawIncident } from '../domain';

export interface DisplayIncident {
  id: string;
  kind: 'goal' | 'var' | 'card' | 'sub' | 'other';
  label: string;
  minute: number | null;
  isHome: boolean | null;
  countsAsGoal: boolean;
}

export interface VarAssessment {
  incidents: DisplayIncident[];
  score: { home: number; away: number };
  varPending: boolean;
  usedFeedScore: boolean;
}

/**
 * A VAR check is shown as VAR and is not a goal.
 * The goal is added, and only then is it safe to notify, once the check is awarded.
 * A disallowed check never changes the score.
 */
export function assessVar(
  incidents: RawIncident[],
  feed: { home: number; away: number } | null,
): VarAssessment {
  const display: DisplayIncident[] = [];
  let home = 0;
  let away = 0;
  let varPending = false;
  let countedGoals = 0;
  const countedKeys = new Set<string>();

  const addGoal = (incident: RawIncident) => {
    const key = `${incident.minute ?? 'x'}:${incident.isHome === true ? 'h' : incident.isHome === false ? 'a' : 'u'}`;
    if (countedKeys.has(key)) return;
    countedKeys.add(key);
    countedGoals += 1;
    if (incident.isHome === true) home += 1;
    else if (incident.isHome === false) away += 1;
  };

  for (const incident of incidents) {
    if (incident.type === 'goal') {
      const pending = incident.varState === 'pending' || incident.confirmed === false;
      if (pending) {
        varPending = true;
        display.push({
          id: incident.id,
          kind: 'var',
          label: 'VAR',
          minute: incident.minute,
          isHome: incident.isHome,
          countsAsGoal: false,
        });
      } else {
        addGoal(incident);
        display.push({
          id: incident.id,
          kind: 'goal',
          label: incident.player ? `Goal · ${incident.player}` : 'Goal',
          minute: incident.minute,
          isHome: incident.isHome,
          countsAsGoal: true,
        });
      }
      continue;
    }
    if (incident.type === 'var') {
      if (incident.varState === 'disallowed') {
        display.push({
          id: incident.id,
          kind: 'var',
          label: 'VAR disallowed',
          minute: incident.minute,
          isHome: incident.isHome,
          countsAsGoal: false,
        });
      } else if (incident.varState === 'awarded') {
        addGoal(incident);
        display.push({
          id: incident.id,
          kind: 'goal',
          label: 'Goal confirmed',
          minute: incident.minute,
          isHome: incident.isHome,
          countsAsGoal: true,
        });
      } else {
        varPending = true;
        display.push({
          id: incident.id,
          kind: 'var',
          label: 'VAR',
          minute: incident.minute,
          isHome: incident.isHome,
          countsAsGoal: false,
        });
      }
      continue;
    }
    if (incident.type === 'card') {
      display.push({
        id: incident.id,
        kind: 'card',
        label: `${incident.card === 'red' ? 'Red' : 'Yellow'}${incident.player ? ` · ${incident.player}` : ''}`,
        minute: incident.minute,
        isHome: incident.isHome,
        countsAsGoal: false,
      });
      continue;
    }
    if (incident.type === 'substitution') {
      display.push({
        id: incident.id,
        kind: 'sub',
        label: incident.player ? `Sub · ${incident.player}` : 'Substitution',
        minute: incident.minute,
        isHome: incident.isHome,
        countsAsGoal: false,
      });
      continue;
    }
    if (incident.text) {
      display.push({
        id: incident.id,
        kind: 'other',
        label: incident.text,
        minute: incident.minute,
        isHome: incident.isHome,
        countsAsGoal: false,
      });
    }
  }

  if (incidents.length === 0 && feed) {
    return { incidents: display, score: feed, varPending: false, usedFeedScore: true };
  }
  if (!varPending && feed && countedGoals === 0 && feed.home + feed.away > 0) {
    return { incidents: display, score: feed, varPending: false, usedFeedScore: true };
  }
  return { incidents: display, score: { home, away }, varPending, usedFeedScore: false };
}
