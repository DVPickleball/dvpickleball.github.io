/* ============================================
   DV PICKLEBALL — Player Statistics
   Win rates, head-to-head, partner analysis
   ============================================ */

window.DV = window.DV || {};

DV.Stats = (function() {

  /**
   * Get comprehensive stats for a player
   */
  function getPlayerStats(playerId) {
    var matches = DV.Matches.getByPlayer(playerId);
    var player = DV.Rankings.getPlayer(playerId);

    var stats = {
      elo: player.elo || DV.DEFAULT_ELO,
      wins: player.wins || 0,
      losses: player.losses || 0,
      matchesPlayed: player.matchesPlayed || 0,
      winRate: DV.Rankings.getWinRate(player),
      rank: DV.Rankings.getPlayerRank(playerId),
      currentStreak: getCurrentStreak(playerId, matches),
      bestStreak: getBestStreak(playerId, matches),
      avgEloChange: getAvgEloChange(playerId, matches),
      h2h: getHeadToHead(playerId, matches),
      partners: getPartnerStats(playerId, matches),
      recentMatches: matches.slice(0, 10)
    };

    return stats;
  }

  /**
   * Get current win/loss streak
   */
  function getCurrentStreak(playerId, matches) {
    if (!matches || matches.length === 0) return { type: 'none', count: 0 };

    var firstMatch = matches[0];
    var isWin = didWin(playerId, firstMatch);
    var streakType = isWin ? 'W' : 'L';
    var count = 1;

    for (var i = 1; i < matches.length; i++) {
      var won = didWin(playerId, matches[i]);
      if ((won && streakType === 'W') || (!won && streakType === 'L')) {
        count++;
      } else {
        break;
      }
    }

    return { type: streakType, count: count };
  }

  /**
   * Get best win streak ever
   */
  function getBestStreak(playerId, matches) {
    if (!matches || matches.length === 0) return 0;

    var best = 0;
    var current = 0;

    // Process matches oldest first
    var sorted = matches.slice().reverse();
    sorted.forEach(function(m) {
      if (didWin(playerId, m)) {
        current++;
        if (current > best) best = current;
      } else {
        current = 0;
      }
    });

    return best;
  }

  /**
   * Get average ELO change per match
   */
  function getAvgEloChange(playerId, matches) {
    if (!matches || matches.length === 0) return 0;

    var total = 0;
    var count = 0;
    matches.forEach(function(m) {
      if (m.eloChanges && m.eloChanges[playerId] !== undefined) {
        total += m.eloChanges[playerId];
        count++;
      }
    });

    return count > 0 ? Math.round(total / count) : 0;
  }

  /**
   * Get head-to-head record against each player
   */
  function getHeadToHead(playerId, matches) {
    var h2h = {};

    matches.forEach(function(m) {
      var isOnTeam1 = m.team1.indexOf(playerId) >= 0;
      var opponents = isOnTeam1 ? m.team2 : m.team1;
      var won = didWin(playerId, m);

      opponents.forEach(function(oppId) {
        if (!h2h[oppId]) {
          h2h[oppId] = { wins: 0, losses: 0 };
        }
        if (won) {
          h2h[oppId].wins++;
        } else {
          h2h[oppId].losses++;
        }
      });
    });

    return h2h;
  }

  /**
   * Get partner stats (for doubles)
   */
  function getPartnerStats(playerId, matches) {
    var partners = {};

    matches.forEach(function(m) {
      if (m.type !== 'doubles') return;

      var isOnTeam1 = m.team1.indexOf(playerId) >= 0;
      var team = isOnTeam1 ? m.team1 : m.team2;
      var won = didWin(playerId, m);

      team.forEach(function(pid) {
        if (pid === playerId) return;
        if (!partners[pid]) {
          partners[pid] = { wins: 0, losses: 0 };
        }
        if (won) {
          partners[pid].wins++;
        } else {
          partners[pid].losses++;
        }
      });
    });

    return partners;
  }

  /**
   * Check if a player won a match
   */
  function didWin(playerId, match) {
    if (match.winner === 'team1') {
      return match.team1.indexOf(playerId) >= 0;
    } else {
      return match.team2.indexOf(playerId) >= 0;
    }
  }

  /**
   * Get longest win streak across all players (for dashboard)
   */
  function getLongestStreak() {
    var best = { playerId: null, count: 0 };

    DV.PLAYERS.forEach(function(p) {
      var matches = DV.Matches.getByPlayer(p.id);
      var streak = getBestStreak(p.id, matches);
      if (streak > best.count) {
        best = { playerId: p.id, count: streak };
      }
    });

    return best;
  }

  /**
   * Get total matches played across all players
   */
  function getTotalMatches() {
    return DV.Matches.getAll().length;
  }

  // Public API
  return {
    getPlayerStats: getPlayerStats,
    getCurrentStreak: getCurrentStreak,
    getBestStreak: getBestStreak,
    getHeadToHead: getHeadToHead,
    getPartnerStats: getPartnerStats,
    didWin: didWin,
    getLongestStreak: getLongestStreak,
    getTotalMatches: getTotalMatches
  };

})();
