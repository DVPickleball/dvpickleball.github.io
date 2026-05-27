/* ============================================
   DV PICKLEBALL — ELO Rating Engine
   Standard ELO with K=32 for fast convergence
   ============================================ */

window.DV = window.DV || {};

DV.Elo = (function() {

  var K_FACTOR = 32;

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
  function newRating(currentRating, expected, actual) {
    return Math.round(currentRating + K_FACTOR * (actual - expected));
  }

  /**
   * Calculate ELO changes for a match
   *
   * For doubles: team ELO = average of both players
   * Each player gains/loses individually based on team performance
   *
   * @param {Object} match - Match data
   * @param {string[]} match.team1 - Array of player IDs for team 1
   * @param {string[]} match.team2 - Array of player IDs for team 2
   * @param {string} match.winner - 'team1' or 'team2'
   * @param {Object} playerElos - Map of playerId -> current ELO
   * @returns {Object} Map of playerId -> ELO change (+ or -)
   */
  function calculateMatchElo(match, playerElos) {
    var changes = {};

    // Calculate team average ELOs
    var team1Elo = averageElo(match.team1, playerElos);
    var team2Elo = averageElo(match.team2, playerElos);

    // Expected scores
    var expectedTeam1 = expectedScore(team1Elo, team2Elo);
    var expectedTeam2 = expectedScore(team2Elo, team1Elo);

    // Actual scores
    var actualTeam1 = match.winner === 'team1' ? 1 : 0;
    var actualTeam2 = match.winner === 'team2' ? 1 : 0;

    // Calculate individual changes
    match.team1.forEach(function(playerId) {
      var currentElo = playerElos[playerId] || DV.DEFAULT_ELO;
      var newElo = newRating(currentElo, expectedTeam1, actualTeam1);
      changes[playerId] = newElo - currentElo;
    });

    match.team2.forEach(function(playerId) {
      var currentElo = playerElos[playerId] || DV.DEFAULT_ELO;
      var newElo = newRating(currentElo, expectedTeam2, actualTeam2);
      changes[playerId] = newElo - currentElo;
    });

    return changes;
  }

  /**
   * Get average ELO for a team
   */
  function averageElo(team, playerElos) {
    if (!team || team.length === 0) return DV.DEFAULT_ELO;
    var total = 0;
    team.forEach(function(id) {
      total += (playerElos[id] || DV.DEFAULT_ELO);
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
    var elos = {};
    DV.PLAYERS.forEach(function(p) {
      elos[p.id] = DV.DEFAULT_ELO;
    });

    matches.forEach(function(match) {
      var changes = calculateMatchElo(match, elos);
      Object.keys(changes).forEach(function(pid) {
        elos[pid] = (elos[pid] || DV.DEFAULT_ELO) + changes[pid];
      });
    });

    return elos;
  }

  // Public API
  return {
    expectedScore: expectedScore,
    newRating: newRating,
    calculateMatchElo: calculateMatchElo,
    recalculateAll: recalculateAll,
    K_FACTOR: K_FACTOR
  };

})();
