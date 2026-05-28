/* ============================================
   DV PICKLEBALL — ELO Rating Engine
   Standard ELO with K=32 for fast convergence
   ============================================ */

window.DV = window.DV || {};

DV.Elo = (function() {

  /**
   * Determine dynamic K-Factor based on player stats
   */
  function getKFactor(matchesPlayed, elo) {
    if (matchesPlayed < 20) return 50;
    if (matchesPlayed >= 50 && elo >= 1800) return 16;
    return 24;
  }

  /**
   * Calculate point differential multiplier based on match scores
   */
  function getMarginMultiplier(scores) {
    if (!scores || scores.length === 0) return 1;
    
    var t1Points = 0;
    var t2Points = 0;
    
    scores.forEach(function(game) {
      t1Points += (game.team1 || 0);
      t2Points += (game.team2 || 0);
    });
    
    var diff = Math.abs(t1Points - t2Points);
    var multiplier = 1 + (0.05 * diff);
    
    // Cap at 1.5x
    return Math.min(1.5, multiplier);
  }

  /**
   * Calculate expected score (probability of winning)
   * @param {number} ratingA - Player/Team A rating
   * @param {number} ratingB - Player/Team B rating
   * @returns {number} Expected score between 0 and 1
   */
  function expectedScore(ratingA, ratingB) {
    return 1.0 / (1.0 + Math.pow(10, (ratingB - ratingA) / 400));
  }

  /**
   * Calculate new ELO after a match
   * @param {number} currentRating
   * @param {number} expectedScore
   * @param {number} actualScore - 1 for win, 0 for loss
   * @returns {number} New rating (rounded)
   */
  function newRating(currentRating, expected, actual, kFactor, marginMultiplier) {
    kFactor = kFactor || 24;
    marginMultiplier = marginMultiplier || 1;
    return Math.round(currentRating + (kFactor * marginMultiplier * (actual - expected)));
  }

  /**
   * Calculate ELO changes for a match
   *
   * @param {Object} match - Match data
   * @param {Object} playerStats - Map of playerId -> { elo, matchesPlayed }
   * @returns {Object} Map of playerId -> ELO change (+ or -)
   */
  function calculateMatchElo(match, playerStats) {
    var changes = {};

    // Calculate team average ELOs
    var team1Elo = averageElo(match.team1, playerStats);
    var team2Elo = averageElo(match.team2, playerStats);

    // Expected scores
    var expectedTeam1 = expectedScore(team1Elo, team2Elo);
    var expectedTeam2 = expectedScore(team2Elo, team1Elo);

    // Actual scores
    var actualTeam1 = match.winner === 'team1' ? 1 : 0;
    var actualTeam2 = match.winner === 'team2' ? 1 : 0;
    
    // Margin Multiplier
    var marginMultiplier = getMarginMultiplier(match.scores);

    // Calculate individual changes
    match.team1.forEach(function(playerId) {
      var stats = playerStats[playerId] || {};
      var currentElo = stats.elo !== undefined ? stats.elo : DV.DEFAULT_ELO;
      var matchesPlayed = stats.matchesPlayed || 0;
      var kFactor = getKFactor(matchesPlayed, currentElo);
      
      var newElo = newRating(currentElo, expectedTeam1, actualTeam1, kFactor, marginMultiplier);
      changes[playerId] = newElo - currentElo;
    });

    match.team2.forEach(function(playerId) {
      var stats = playerStats[playerId] || {};
      var currentElo = stats.elo !== undefined ? stats.elo : DV.DEFAULT_ELO;
      var matchesPlayed = stats.matchesPlayed || 0;
      var kFactor = getKFactor(matchesPlayed, currentElo);

      var newElo = newRating(currentElo, expectedTeam2, actualTeam2, kFactor, marginMultiplier);
      changes[playerId] = newElo - currentElo;
    });

    return changes;
  }

  /**
   * Get average ELO for a team
   */
  function averageElo(team, playerStats) {
    if (!team || team.length === 0) return DV.DEFAULT_ELO;
    var total = 0;
    team.forEach(function(id) {
      var stats = playerStats[id] || {};
      total += (stats.elo !== undefined ? stats.elo : DV.DEFAULT_ELO);
    });
    return total / team.length;
  }

  /**
   * Recalculate all player ELOs from scratch given all matches
   * (used for verification/reset)
   * @param {Array} matches - All matches sorted by date ascending
   * @returns {Object} Map of playerId -> final ELO
   */
  function recalculateAll(matches) {
    var stats = {};
    DV.PLAYERS.forEach(function(p) {
      stats[p.id] = { elo: DV.DEFAULT_ELO, matchesPlayed: 0 };
    });

    matches.forEach(function(match) {
      var changes = calculateMatchElo(match, stats);
      Object.keys(changes).forEach(function(pid) {
        if (!stats[pid]) stats[pid] = { elo: DV.DEFAULT_ELO, matchesPlayed: 0 };
        stats[pid].elo += changes[pid];
        stats[pid].matchesPlayed += 1;
      });
    });

    return stats;
  }

  // Public API
  return {
    expectedScore: expectedScore,
    newRating: newRating,
    calculateMatchElo: calculateMatchElo,
    recalculateAll: recalculateAll,
    getKFactor: getKFactor,
    getMarginMultiplier: getMarginMultiplier
  };

})();
