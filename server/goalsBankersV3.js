// Goals Bankers V3 — deterministic match-shape + market-separation engine.
export const ENGINE_ID = "goals-bankers-v3";
export const ENGINE_LABEL = "Goals Bankers V3";
const MARKETS = ["FAV_WIN", "FAV_2PLUS", "OVER_2.5", "GG"];
export const MARKET_LABEL = {
    FAV_WIN: "Favourite win",
    FAV_2PLUS: "Favourite 2+",
    "OVER_2.5": "Over 2.5",
    GG: "GG",
    SKIP: "Skip",
};
export const SHAPE_LABEL = {
    FAV_DOMINATION: "Favourite domination",
    HIGH_EVENT_BOTH_SIDES: "High-event both sides",
    BTTS_SHAPE: "Both teams contribute",
    CONTROLLED_FAVORITE: "Controlled favourite",
    CONFLICT_ZONE: "Conflict zone",
};
const finite = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
const n = (v) => (finite(v) ? Number(v) : null);
function skipResult(reasonCode, reason, extra = {}) {
    const scores = extra.scores ?? { FAV_WIN: null, FAV_2PLUS: null, "OVER_2.5": null, GG: null };
    const debug = {
        ...emptyDebug(),
        ...(extra.debug || {}),
        final_pick: "SKIP",
        provisional_pick: extra.provisionalPick ?? "SKIP",
        reason,
    };
    return {
        engine: ENGINE_ID,
        eligible: extra.eligible ?? false,
        matchType: extra.matchType ?? null,
        resultProfile: extra.resultProfile ?? null,
        favoriteGoalProfile: extra.favoriteGoalProfile ?? null,
        opponentGoalProfile: extra.opponentGoalProfile ?? null,
        matchShape: extra.matchShape ?? null,
        eligibleMarkets: extra.eligibleMarkets ?? [],
        scores,
        contradictions: extra.contradictions ?? [],
        topMarket: extra.topMarket ?? null,
        runnerUp: extra.runnerUp ?? null,
        separation: extra.separation ?? null,
        borderline: extra.borderline ?? false,
        provisionalPick: extra.provisionalPick ?? "SKIP",
        veto: extra.veto ?? null,
        finalPick: "SKIP",
        reasonCode,
        reason,
        userWhy: publicWhy("SKIP", reasonCode),
        debug,
    };
}
export function publicWhy(pick, reasonCode, ctx) {
    if (pick === "SKIP") {
        if (reasonCode === "LOW_MARKET_SEPARATION") {
            const a = ctx?.topMarket ? MARKET_LABEL[ctx.topMarket] : "the top market";
            const b = ctx?.runnerUp ? MARKET_LABEL[ctx.runnerUp] : "the runner-up";
            const sep = ctx?.separation;
            return `Skip is the V3 result. ${a} and ${b} are too close${sep != null ? ` (separation ${sep})` : ""}. Competing markets must separate by more than 5 points before a banker is published.`;
        }
        if (reasonCode === "STREAK_GATE") {
            return "Skip is the V3 result. 2-in-a-row Yes is outside 1.10–1.50, so the fixture never enters the market router.";
        }
        if (reasonCode === "INSUFFICIENT_MARKET_DATA") {
            return "Skip is the V3 result. A required price is missing, and the engine never invents odds.";
        }
        if (reasonCode === "CONFLICT_NO_CONFIRMATION" || reasonCode === "BELOW_FLOOR") {
            return "Skip is the V3 result. No eligible market cleared the confirmation floor, so there is no banker.";
        }
        if (reasonCode.startsWith("VETO_")) {
            return "Skip is the V3 result. A veto killed the provisional pick — a weak confirmation is not published as a banker.";
        }
        return "The market signals disagree and no single selection has a strong enough advantage over the alternatives.";
    }
    const thesis = pick === "FAV_WIN"
        ? "The favourite has a clear result advantage while the opponent's scoring expectation is relatively weak. Winning the match is better supported than requiring the favourite to score multiple goals."
        : pick === "FAV_2PLUS"
            ? "The strongest signal is the favourite's scoring expectation. They are strongly supported to score at least twice even if the final result becomes less predictable."
            : pick === "OVER_2.5"
                ? "The match has several strong routes to three or more goals. The favourite can produce a large share of the total, while the overall goal market also supports a high-scoring game."
                : "Both teams have credible individual scoring signals. The opponent is strongly supported to contribute a goal, making both teams scoring the cleaner market.";
    const shape = ctx?.matchShape ? ` Match shape: ${SHAPE_LABEL[ctx.matchShape]}.` : "";
    const beat = ctx
        ? MARKETS.filter((m) => m !== pick)
            .map((m) => {
            const s = ctx.scores[m];
            if (s === null)
                return `${MARKET_LABEL[m]} was structurally ineligible.`;
            if (m === ctx.runnerUp && ctx.separation != null) {
                return `${MARKET_LABEL[m]} scored ${s} — ${ctx.separation} behind.`;
            }
            return `${MARKET_LABEL[m]} scored ${s}.`;
        })
            .join(" ")
        : "";
    return `${MARKET_LABEL[pick]} is the V3 banker.${shape} ${thesis}${beat ? ` ${beat}` : ""}`;
}
export function classifyMatchType(fav, opp) {
    if (fav <= 1.4 && opp >= 5)
        return "MISMATCH";
    if (fav <= 1.55 && opp >= 3.8)
        return "STRONG";
    if (fav <= 1.8)
        return "LEAN";
    return "BALANCED";
}
export function classifyResultProfile(fav, draw, opp) {
    if (fav <= 1.35 && draw >= 4.5 && opp >= 5.5)
        return "EXTREME_SEPARATION";
    if (fav <= 1.5 && draw >= 4 && opp >= 4.5)
        return "CLEAR_SEPARATION";
    if (draw <= 3.6)
        return "DRAW_RESISTANCE";
    return "NORMAL";
}
export function classifyFavGoalProfile(tt) {
    if (tt <= 1.85)
        return "EXTREME";
    if (tt <= 2)
        return "VERY_HIGH";
    if (tt <= 2.15)
        return "HIGH";
    if (tt <= 2.35)
        return "MODERATE";
    return "LOW";
}
export function classifyOppGoalProfile(tt) {
    if (tt <= 1.5)
        return "VERY_LIVE";
    if (tt <= 1.58)
        return "LIVE";
    if (tt <= 1.66)
        return "CONFLICT";
    if (tt <= 1.8)
        return "COLD";
    return "VERY_COLD";
}
function oppState(profile) {
    if (profile === "VERY_LIVE" || profile === "LIVE")
        return "OPP_LIVE";
    if (profile === "CONFLICT")
        return "OPP_CONFLICT";
    return "OPP_COLD";
}
export function classifyMatchShape(favState, oppProfile) {
    if (oppProfile === "CONFLICT")
        return "CONFLICT_ZONE";
    const os = oppState(oppProfile);
    if (favState === "HOT" && os === "OPP_COLD")
        return "FAV_DOMINATION";
    if (favState === "HOT" && os === "OPP_LIVE")
        return "HIGH_EVENT_BOTH_SIDES";
    if (favState === "MODERATE" && os === "OPP_LIVE")
        return "BTTS_SHAPE";
    if (favState === "MODERATE" && os === "OPP_COLD")
        return "CONTROLLED_FAVORITE";
    return "CONFLICT_ZONE";
}
function scoreFavWin(o, result, opp) {
    let s = 0;
    const f = o.fav_odds;
    if (f <= 1.25)
        s += 30;
    else if (f <= 1.32)
        s += 26;
    else if (f <= 1.4)
        s += 22;
    else if (f <= 1.48)
        s += 16;
    else if (f <= 1.55)
        s += 10;
    if (result === "EXTREME_SEPARATION")
        s += 20;
    else if (result === "CLEAR_SEPARATION")
        s += 14;
    else if (result === "NORMAL")
        s += 5;
    else
        s -= 12;
    if (opp === "VERY_COLD")
        s += 15;
    else if (opp === "COLD")
        s += 10;
    else if (opp === "CONFLICT")
        s += 0;
    else if (opp === "LIVE")
        s -= 8;
    else
        s -= 15;
    const t = o.fav_2plus;
    if (t >= 1.55)
        s += 12;
    else if (t >= 1.49)
        s += 7;
    else if (t >= 1.39)
        s += 0;
    else
        s -= 10;
    const tt = o.fav_tt_over25;
    if (tt > 2.35)
        s += 8;
    else if (tt >= 2.16)
        s += 4;
    else if (tt >= 2.01)
        s += 0;
    else
        s -= 5;
    return s;
}
function scoreFav2Plus(o, shape) {
    let s = 0;
    const p = o.fav_2plus;
    if (p <= 1.3)
        s += 35;
    else if (p <= 1.38)
        s += 30;
    else if (p <= 1.42)
        s += 24;
    else if (p <= 1.48)
        s += 17;
    else if (p <= 1.54)
        s += 8;
    else
        s -= 25;
    const tt = o.fav_tt_over25;
    if (tt <= 1.85)
        s += 22;
    else if (tt <= 2)
        s += 18;
    else if (tt <= 2.15)
        s += 12;
    else if (tt <= 2.35)
        s += 4;
    else
        s -= 8;
    if (shape === "FAV_DOMINATION")
        s += 15;
    else if (shape === "HIGH_EVENT_BOTH_SIDES")
        s += 12;
    else if (shape === "BTTS_SHAPE")
        s += 3;
    else if (shape === "CONTROLLED_FAVORITE")
        s += 3;
    const f = o.fav_odds;
    if (f <= 1.32)
        s += 8;
    else if (f <= 1.4)
        s += 5;
    else if (f <= 1.55)
        s += 2;
    return s;
}
function scoreOver(o, opp, shape) {
    let s = 0;
    const p = o.over25;
    if (p <= 1.42)
        s += 32;
    else if (p <= 1.5)
        s += 28;
    else if (p <= 1.58)
        s += 23;
    else if (p <= 1.65)
        s += 16;
    else if (p <= 1.75)
        s += 7;
    else if (p <= 1.79)
        s += 2;
    else
        s -= 30;
    const tt = o.fav_tt_over25;
    if (tt <= 1.85)
        s += 20;
    else if (tt <= 2)
        s += 16;
    else if (tt <= 2.15)
        s += 11;
    else if (tt <= 2.35)
        s += 4;
    if (opp === "VERY_LIVE")
        s += 12;
    else if (opp === "LIVE")
        s += 9;
    else if (opp === "CONFLICT")
        s += 4;
    else if (opp === "VERY_COLD")
        s -= 4;
    if (shape === "HIGH_EVENT_BOTH_SIDES")
        s += 18;
    else if (shape === "FAV_DOMINATION")
        s += 10;
    else if (shape === "BTTS_SHAPE")
        s += 8;
    else if (shape === "CONTROLLED_FAVORITE")
        s -= 3;
    return s;
}
function scoreGg(o, fav, shape) {
    let s = 0;
    const p = o.btts_yes;
    if (p <= 1.5)
        s += 32;
    else if (p <= 1.58)
        s += 28;
    else if (p <= 1.65)
        s += 23;
    else if (p <= 1.7)
        s += 17;
    else if (p <= 1.75)
        s += 9;
    else if (p <= 1.8)
        s += 3;
    else
        s -= 20;
    const tt = o.opp_tt_over05;
    if (tt <= 1.5)
        s += 25;
    else if (tt <= 1.58)
        s += 20;
    else if (tt <= 1.66)
        s += 7;
    else if (tt <= 1.8)
        s -= 12;
    else
        s -= 25;
    if (fav === "EXTREME" || fav === "VERY_HIGH")
        s += 8;
    else if (fav === "HIGH")
        s += 6;
    else if (fav === "MODERATE")
        s += 2;
    else
        s -= 8;
    if (shape === "BTTS_SHAPE")
        s += 20;
    else if (shape === "HIGH_EVENT_BOTH_SIDES")
        s += 15;
    else if (shape === "FAV_DOMINATION")
        s -= 18;
    else if (shape === "CONTROLLED_FAVORITE")
        s -= 25;
    return s;
}
function baseEligible(shape, result, fav2, over, oppTt) {
    const set = new Set();
    if (shape === "FAV_DOMINATION") {
        set.add("FAV_WIN");
        set.add("FAV_2PLUS");
        set.add("OVER_2.5");
        if (oppTt <= 1.58)
            set.add("GG");
    }
    else if (shape === "HIGH_EVENT_BOTH_SIDES") {
        set.add("OVER_2.5");
        set.add("FAV_2PLUS");
        set.add("GG");
        if (result === "EXTREME_SEPARATION")
            set.add("FAV_WIN");
    }
    else if (shape === "BTTS_SHAPE") {
        set.add("GG");
        set.add("OVER_2.5");
        if (fav2 <= 1.35)
            set.add("FAV_2PLUS");
    }
    else if (shape === "CONTROLLED_FAVORITE") {
        set.add("FAV_WIN");
        if (fav2 <= 1.38)
            set.add("FAV_2PLUS");
        if (over <= 1.52)
            set.add("OVER_2.5");
    }
    else {
        MARKETS.forEach((m) => set.add(m));
    }
    return set;
}
function applyHardBans(eligible, o, matchType, shape) {
    if (o.fav_odds > 1.55)
        eligible.delete("FAV_WIN");
    if (o.fav_2plus >= 1.55)
        eligible.delete("FAV_2PLUS");
    if (o.over25 >= 1.8)
        eligible.delete("OVER_2.5");
    if (matchType === "BALANCED_GOALS") {
        eligible.delete("FAV_WIN");
        eligible.delete("FAV_2PLUS");
    }
    if (shape === "CONTROLLED_FAVORITE" && o.opp_tt_over05 >= 1.7)
        eligible.delete("GG");
    if (shape === "FAV_DOMINATION" && o.opp_tt_over05 >= 1.7)
        eligible.delete("GG");
    if (o.opp_odds >= 5.5 && o.opp_tt_over05 >= 1.7)
        eligible.delete("GG");
    if (matchType === "MISMATCH" && o.opp_tt_over05 >= 1.7)
        eligible.delete("GG");
}
const TIE_PRIORITY = {
    FAV_DOMINATION: ["FAV_2PLUS", "FAV_WIN", "OVER_2.5", "GG"],
    HIGH_EVENT_BOTH_SIDES: ["OVER_2.5", "FAV_2PLUS", "GG", "FAV_WIN"],
    BTTS_SHAPE: ["GG", "OVER_2.5", "FAV_2PLUS", "FAV_WIN"],
    CONTROLLED_FAVORITE: ["FAV_WIN", "FAV_2PLUS", "OVER_2.5", "GG"],
    CONFLICT_ZONE: ["FAV_WIN", "FAV_2PLUS", "OVER_2.5", "GG"],
};
function reasonForPick(pick, shape, code) {
    if (pick === "SKIP") {
        if (code === "LOW_MARKET_SEPARATION") {
            return "Signals do not satisfy the minimum confirmation rules.";
        }
        if (code === "INSUFFICIENT_MARKET_DATA")
            return "INSUFFICIENT_MARKET_DATA";
        if (code === "STREAK_GATE")
            return "2-in-a-row is outside 1.10–1.50.";
        return "Signals do not satisfy the minimum confirmation rules.";
    }
    if (pick === "FAV_2PLUS") {
        return "Favorite is strongly priced for high team scoring. Favorite 2+ is inside the preferred threshold.";
    }
    if (pick === "FAV_WIN") {
        return "The favorite has a major result advantage while opponent scoring expectation is weak.";
    }
    if (pick === "OVER_2.5") {
        return "The favorite can generate most of the total and Over 2.5 is the cleaner goals route.";
    }
    if (pick === "GG") {
        return "The favorite is not heavily expected to score three by itself, but both teams have strong individual scoring signals.";
    }
    return shape || code;
}
export function evaluateTwoInARowMarket(raw, opts = {}) {
    const streak = n(raw.streak_yes);
    const odds = {
        fav_odds: n(raw.fav_odds),
        draw_odds: n(raw.draw_odds),
        opp_odds: n(raw.opp_odds),
        fav_2plus: n(raw.fav_2plus),
        fav_tt_over25: n(raw.fav_tt_over25),
        opp_tt_over05: n(raw.opp_tt_over05),
        over25: n(raw.over25),
        btts_yes: n(raw.btts_yes),
        streak_yes: streak,
    };
    const baseDebug = {
        fixture_id: opts.fixtureId ?? null,
        ...odds,
    };
    if (streak === null) {
        return skipResult("INSUFFICIENT_MARKET_DATA", "INSUFFICIENT_MARKET_DATA", {
            debug: { ...emptyDebug(), ...baseDebug, gate_status: "FAIL" },
        });
    }
    if (streak < 1.1 || streak > 1.5) {
        return skipResult("STREAK_GATE", "2-in-a-row is outside 1.10–1.50.", {
            eligible: false,
            debug: { ...emptyDebug(), ...baseDebug, gate_status: "FAIL" },
        });
    }
    const required = [
        odds.fav_odds,
        odds.draw_odds,
        odds.opp_odds,
        odds.fav_2plus,
        odds.fav_tt_over25,
        odds.opp_tt_over05,
        odds.over25,
        odds.btts_yes,
    ];
    if (required.some((v) => v === null)) {
        return skipResult("INSUFFICIENT_MARKET_DATA", "INSUFFICIENT_MARKET_DATA", {
            eligible: true,
            debug: { ...emptyDebug(), ...baseDebug, gate_status: "PASS" },
        });
    }
    const fav = odds.fav_odds;
    const draw = odds.draw_odds;
    const opp = odds.opp_odds;
    const fav2 = odds.fav_2plus;
    const favTt = odds.fav_tt_over25;
    const oppTt = odds.opp_tt_over05;
    const over = odds.over25;
    const btts = odds.btts_yes;
    let matchType = classifyMatchType(fav, opp);
    const resultProfile = classifyResultProfile(fav, draw, opp);
    if (matchType !== "MISMATCH" && btts <= 1.7 && over <= 1.65) {
        matchType = "BALANCED_GOALS";
    }
    const favoriteGoalProfile = classifyFavGoalProfile(favTt);
    const opponentGoalProfile = classifyOppGoalProfile(oppTt);
    const favState = favTt <= 2.15 ? "HOT" : "MODERATE";
    const matchShape = classifyMatchShape(favState, opponentGoalProfile);
    const eligible = baseEligible(matchShape, resultProfile, fav2, over, oppTt);
    applyHardBans(eligible, { fav_odds: fav, fav_2plus: fav2, over25: over, opp_odds: opp, opp_tt_over05: oppTt }, matchType, matchShape);
    const scores = {
        FAV_WIN: eligible.has("FAV_WIN")
            ? scoreFavWin({ fav_odds: fav, fav_2plus: fav2, fav_tt_over25: favTt }, resultProfile, opponentGoalProfile)
            : null,
        FAV_2PLUS: eligible.has("FAV_2PLUS")
            ? scoreFav2Plus({ fav_2plus: fav2, fav_tt_over25: favTt, fav_odds: fav }, matchShape)
            : null,
        "OVER_2.5": eligible.has("OVER_2.5")
            ? scoreOver({ over25: over, fav_tt_over25: favTt }, opponentGoalProfile, matchShape)
            : null,
        GG: eligible.has("GG")
            ? scoreGg({ btts_yes: btts, opp_tt_over05: oppTt }, favoriteGoalProfile, matchShape)
            : null,
    };
    const contradictions = [];
    if (fav <= 1.35 && fav2 >= 1.55 && favTt > 2.35) {
        contradictions.push("RESULT_STRONG_GOALS_WEAK");
        if (scores.FAV_WIN !== null)
            scores.FAV_WIN += 15;
        if (scores.FAV_2PLUS !== null)
            scores.FAV_2PLUS -= 15;
        if (scores["OVER_2.5"] !== null)
            scores["OVER_2.5"] -= 10;
    }
    if (fav >= 1.41 && fav2 <= 1.35 && favTt <= 2) {
        contradictions.push("GOALS_STRONGER_THAN_RESULT");
        if (scores.FAV_2PLUS !== null)
            scores.FAV_2PLUS += 12;
        if (scores["OVER_2.5"] !== null)
            scores["OVER_2.5"] += 8;
        if (scores.FAV_WIN !== null)
            scores.FAV_WIN -= 12;
    }
    if (opp >= 5.5 && oppTt <= 1.58) {
        contradictions.push("WEAK_RESULT_LIVE_GOAL_THREAT");
        if (scores.GG !== null)
            scores.GG += 8;
        if (scores.FAV_WIN !== null)
            scores.FAV_WIN -= 5;
    }
    if (fav <= 1.35 && opp >= 5.5 && oppTt >= 1.7) {
        contradictions.push("ONE_SIDED_SCORE_EXPECTATION");
        eligible.delete("GG");
        scores.GG = null;
        if (scores.FAV_WIN !== null)
            scores.FAV_WIN += 8;
        if (scores.FAV_2PLUS !== null)
            scores.FAV_2PLUS += 5;
    }
    if (btts <= 1.65 && over >= 1.7) {
        contradictions.push("BTTS_OVER_TOTAL");
        if (scores.GG !== null)
            scores.GG += 10;
        if (scores["OVER_2.5"] !== null)
            scores["OVER_2.5"] -= 8;
    }
    if (over <= 1.55 && btts >= 1.8) {
        contradictions.push("FAVORITE_CAN_SUPPLY_TOTAL");
        if (scores["OVER_2.5"] !== null)
            scores["OVER_2.5"] += 12;
        if (scores.GG !== null)
            scores.GG -= 12;
    }
    if (matchShape === "CONFLICT_ZONE") {
        if (favTt <= 2 && over <= 1.55 && scores["OVER_2.5"] !== null)
            scores["OVER_2.5"] += 20;
        if (btts <= 1.58 && over >= 1.68 && scores.GG !== null)
            scores.GG += 20;
        if (matchType === "MISMATCH" && fav2 <= 1.38 && scores.FAV_2PLUS !== null)
            scores.FAV_2PLUS += 18;
        if (resultProfile === "EXTREME_SEPARATION" &&
            fav <= 1.3 &&
            btts >= 1.75 &&
            scores.FAV_WIN !== null) {
            scores.FAV_WIN += 18;
        }
    }
    if (fav <= 1.35 && fav2 >= 1.55) {
        eligible.delete("FAV_2PLUS");
        scores.FAV_2PLUS = null;
        if (scores.FAV_WIN !== null)
            scores.FAV_WIN += 8;
    }
    if (fav2 <= 1.38 && favTt <= 2.15 && scores.FAV_2PLUS !== null)
        scores.FAV_2PLUS += 12;
    if (fav <= 1.4 && over >= 1.75 && oppTt >= 1.67) {
        if (scores.FAV_WIN !== null)
            scores.FAV_WIN += 8;
        if (scores["OVER_2.5"] !== null)
            scores["OVER_2.5"] -= 4;
    }
    if (over <= 1.52 && favTt <= 2.15 && scores["OVER_2.5"] !== null)
        scores["OVER_2.5"] += 10;
    if (btts <= 1.6 && oppTt <= 1.55 && favTt > 2.15 && scores.GG !== null)
        scores.GG += 10;
    if (favTt <= 2 && over <= 1.55 && oppTt <= 1.58) {
        if (!(btts <= 1.5 && over >= 1.6)) {
            if (scores["OVER_2.5"] !== null)
                scores["OVER_2.5"] += 8;
        }
    }
    applyHardBans(eligible, { fav_odds: fav, fav_2plus: fav2, over25: over, opp_odds: opp, opp_tt_over05: oppTt }, matchType, matchShape);
    for (const m of MARKETS) {
        if (!eligible.has(m))
            scores[m] = null;
    }
    const floor = matchShape === "CONFLICT_ZONE" ? 70 : 65;
    const survivors = MARKETS.filter((m) => scores[m] !== null && scores[m] >= floor);
    const ranked = survivors
        .map((m) => ({ m, s: scores[m] }))
        .sort((a, b) => {
        if (b.s !== a.s)
            return b.s - a.s;
        return TIE_PRIORITY[matchShape].indexOf(a.m) - TIE_PRIORITY[matchShape].indexOf(b.m);
    });
    const common = {
        eligible: true,
        matchType,
        resultProfile,
        favoriteGoalProfile,
        opponentGoalProfile,
        matchShape,
        eligibleMarkets: MARKETS.filter((m) => eligible.has(m)),
        scores,
        contradictions,
    };
    if (matchShape === "CONFLICT_ZONE" && ranked.length === 0) {
        return finish("SKIP", "SKIP", null, {
            ...common,
            reasonCode: "CONFLICT_NO_CONFIRMATION",
            reason: "Signals do not satisfy the minimum confirmation rules.",
            odds,
            fixtureId: opts.fixtureId,
        });
    }
    if (ranked.length === 0) {
        return finish("SKIP", "SKIP", null, {
            ...common,
            reasonCode: "BELOW_FLOOR",
            reason: "Signals do not satisfy the minimum confirmation rules.",
            odds,
            fixtureId: opts.fixtureId,
        });
    }
    if (ranked.length >= 2 && ranked[0].s === ranked[1].s && matchShape === "CONFLICT_ZONE") {
        return finish("SKIP", "SKIP", null, {
            ...common,
            topMarket: ranked[0].m,
            runnerUp: ranked[1].m,
            separation: 0,
            reasonCode: "LOW_MARKET_SEPARATION",
            reason: "LOW_MARKET_SEPARATION",
            odds,
            fixtureId: opts.fixtureId,
        });
    }
    const top = ranked[0];
    const second = ranked[1] ?? null;
    const separation = second ? top.s - second.s : top.s;
    if (second && separation <= 5) {
        return finish("SKIP", "SKIP", null, {
            ...common,
            topMarket: top.m,
            runnerUp: second.m,
            separation,
            reasonCode: "LOW_MARKET_SEPARATION",
            reason: "LOW_MARKET_SEPARATION",
            odds,
            fixtureId: opts.fixtureId,
        });
    }
    const borderline = Boolean(second && separation >= 6 && separation <= 9);
    let provisional = top.m;
    let veto = null;
    let final = provisional;
    if (provisional === "FAV_WIN" && fav > 1.55) {
        veto = "V1";
        final = "SKIP";
    }
    else if (provisional === "FAV_2PLUS" && fav2 >= 1.55) {
        veto = "V2";
        final = "SKIP";
    }
    else if (provisional === "OVER_2.5" && over >= 1.8) {
        veto = "V3";
        final = "SKIP";
    }
    else if (provisional === "GG" && oppTt >= 1.8) {
        veto = "V4";
        final = "SKIP";
    }
    else if (provisional === "FAV_WIN" && resultProfile === "DRAW_RESISTANCE" && fav > 1.4) {
        veto = "V5";
        final = "SKIP";
    }
    else if (provisional === "GG" && opp >= 5.5 && oppTt >= 1.7) {
        veto = "V6";
        final = "SKIP";
    }
    else if (provisional === "GG" && matchShape === "FAV_DOMINATION" && oppTt >= 1.67) {
        veto = "V7";
        final = "SKIP";
    }
    else if (provisional === "FAV_WIN" &&
        matchShape === "HIGH_EVENT_BOTH_SIDES" &&
        resultProfile !== "EXTREME_SEPARATION") {
        veto = "V8";
        final = "SKIP";
    }
    const reasonCode = final === "SKIP" && veto
        ? `VETO_${veto}`
        : final === "FAV_2PLUS"
            ? "FAVORITE_SCORING_DOMINANCE"
            : final === "FAV_WIN"
                ? "RESULT_DOMINANCE"
                : final === "OVER_2.5"
                    ? "HIGH_EVENT_OVER"
                    : final === "GG"
                        ? "BTTS_SHAPE_GG"
                        : "SKIP";
    return finish(provisional, final, veto, {
        ...common,
        topMarket: top.m,
        runnerUp: second?.m ?? null,
        separation,
        borderline,
        reasonCode,
        reason: reasonForPick(final, matchShape, reasonCode),
        odds,
        fixtureId: opts.fixtureId,
    });
}
function emptyDebug() {
    return {
        fixture_id: null,
        streak_yes: null,
        gate_status: "FAIL",
        fav_odds: null,
        draw_odds: null,
        opp_odds: null,
        match_type: null,
        result_profile: null,
        fav_2plus: null,
        fav_tt_over25: null,
        fav_goal_profile: null,
        opp_tt_over05: null,
        opp_goal_profile: null,
        over25: null,
        btts_yes: null,
        match_shape: null,
        eligible_markets: [],
        scores: { FAV_WIN: null, FAV_2PLUS: null, "OVER_2.5": null, GG: null },
        contradictions: [],
        top_market: null,
        top_score: null,
        runner_up: null,
        runner_up_score: null,
        separation: null,
        borderline: false,
        provisional_pick: "SKIP",
        veto: null,
        final_pick: "SKIP",
        reason: "",
    };
}
function finish(provisional, final, veto, ctx) {
    const debug = {
        fixture_id: ctx.fixtureId ?? null,
        streak_yes: ctx.odds.streak_yes,
        gate_status: "PASS",
        fav_odds: ctx.odds.fav_odds,
        draw_odds: ctx.odds.draw_odds,
        opp_odds: ctx.odds.opp_odds,
        match_type: ctx.matchType,
        result_profile: ctx.resultProfile,
        fav_2plus: ctx.odds.fav_2plus,
        fav_tt_over25: ctx.odds.fav_tt_over25,
        fav_goal_profile: ctx.favoriteGoalProfile,
        opp_tt_over05: ctx.odds.opp_tt_over05,
        opp_goal_profile: ctx.opponentGoalProfile,
        over25: ctx.odds.over25,
        btts_yes: ctx.odds.btts_yes,
        match_shape: ctx.matchShape,
        eligible_markets: ctx.eligibleMarkets,
        scores: ctx.scores,
        contradictions: ctx.contradictions,
        top_market: ctx.topMarket ?? null,
        top_score: ctx.topMarket ? ctx.scores[ctx.topMarket] : null,
        runner_up: ctx.runnerUp ?? null,
        runner_up_score: ctx.runnerUp ? ctx.scores[ctx.runnerUp] : null,
        separation: ctx.separation ?? null,
        borderline: ctx.borderline ?? false,
        provisional_pick: provisional,
        veto,
        final_pick: final,
        reason: ctx.reason,
    };
    return {
        engine: ENGINE_ID,
        eligible: ctx.eligible,
        matchType: ctx.matchType,
        resultProfile: ctx.resultProfile,
        favoriteGoalProfile: ctx.favoriteGoalProfile,
        opponentGoalProfile: ctx.opponentGoalProfile,
        matchShape: ctx.matchShape,
        eligibleMarkets: ctx.eligibleMarkets,
        scores: ctx.scores,
        contradictions: ctx.contradictions,
        topMarket: ctx.topMarket ?? null,
        runnerUp: ctx.runnerUp ?? null,
        separation: ctx.separation ?? null,
        borderline: ctx.borderline ?? false,
        provisionalPick: provisional,
        veto,
        finalPick: final,
        reasonCode: ctx.reasonCode,
        reason: ctx.reason,
        userWhy: publicWhy(final, ctx.reasonCode, {
            matchShape: ctx.matchShape,
            scores: ctx.scores,
            topMarket: ctx.topMarket ?? null,
            runnerUp: ctx.runnerUp ?? null,
            separation: ctx.separation ?? null,
        }),
        debug,
    };
}
export function publishedOdds(pick, o) {
    if (pick === "FAV_WIN")
        return n(o.fav_odds);
    if (pick === "FAV_2PLUS")
        return n(o.fav_2plus);
    if (pick === "OVER_2.5")
        return n(o.over25);
    if (pick === "GG")
        return n(o.btts_yes);
    return null;
}
export function buildAcca(legs) {
    const ranked = [...legs]
        .filter((l) => l.finalPick !== "SKIP")
        .sort((a, b) => {
        if (b.score !== a.score)
            return b.score - a.score;
        if (b.separation !== a.separation)
            return b.separation - a.separation;
        if (a.contradictions !== b.contradictions)
            return a.contradictions - b.contradictions;
        return Number(a.borderline) - Number(b.borderline);
    });
    const out = [];
    for (const leg of ranked) {
        if (out.length >= 3)
            break;
        if (out.some((x) => x.fixtureId === leg.fixtureId))
            continue;
        if (leg.finalPick === "FAV_WIN" && out.some((x) => x.finalPick === "FAV_WIN"))
            continue;
        if (leg.borderline && out.some((x) => x.borderline))
            continue;
        if (out.length === 2) {
            const next = [...out, leg];
            if (!next.some((x) => x.finalPick === "OVER_2.5" || x.finalPick === "GG"))
                continue;
        }
        out.push(leg);
    }
    return out;
}
