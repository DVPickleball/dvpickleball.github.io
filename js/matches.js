/* ============================================
   DV PICKLEBALL — Match Operations
   CRUD operations for match data in Firestore
   ============================================ */

window.DV = window.DV || {};

DV.Matches = (function() {

  var matchesCache = [];
  var matchListeners = [];
  var unsubscribe = null;

  /**
   * Initialize real-time listener for matches
   */
  function init() {
    unsubscribe = DV.db.collection('matches')
      .orderBy('createdAt', 'desc')
      .onSnapshot(function(snapshot) {
        matchesCache = [];
        snapshot.forEach(function(doc) {
          var data = doc.data();
          data.id = doc.id;
          matchesCache.push(data);
        });
        notifyListeners(matchesCache);
      }, function(err) {
        console.error('Matches listener error:', err);
      });
  }

  /**
   * Log a new match
   * @param {Object} matchData
   * @param {string} matchData.type - 'doubles' or 'singles'
   * @param {string[]} matchData.team1 - Player IDs
   * @param {string[]} matchData.team2 - Player IDs
   * @param {Array} matchData.scores - [{team1: num, team2: num}, ...]
   * @param {string} matchData.winner - 'team1' or 'team2'
   */
  function logMatch(matchData) {
    // Get current player ELOs
    return getPlayerElos().then(function(playerElos) {
      // Extract ELO values for calculation
      var simpleElos = {};
      Object.keys(playerElos).forEach(function(pid) {
        simpleElos[pid] = playerElos[pid].elo;
      });

      // Calculate ELO changes
      var eloChanges = DV.Elo.calculateMatchElo(matchData, simpleElos);

      var match = {
        type: matchData.type,
        team1: matchData.team1,
        team2: matchData.team2,
        scores: matchData.scores,
        winner: matchData.winner,
        eloChanges: eloChanges,
        loggedBy: DV.Auth.getUser() ? DV.Auth.getUser().email : 'unknown',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      // Batch write: match + player ELO updates
      var batch = DV.db.batch();

      // Add match document
      var matchRef = DV.db.collection('matches').doc();
      batch.set(matchRef, match);

      // Update player ELOs and records
      var allPlayers = matchData.team1.concat(matchData.team2);
      allPlayers.forEach(function(playerId) {
        var playerRef = DV.db.collection('players').doc(playerId);
        var isWinner = matchData.winner === 'team1'
          ? matchData.team1.indexOf(playerId) >= 0
          : matchData.team2.indexOf(playerId) >= 0;

        var currentStats = playerElos[playerId] || { elo: DV.DEFAULT_ELO, wins: 0, losses: 0, matchesPlayed: 0 };
        var newElo = currentStats.elo + (eloChanges[playerId] || 0);
        var newWins = currentStats.wins + (isWinner ? 1 : 0);
        var newLosses = currentStats.losses + (isWinner ? 0 : 1);
        var newMatchesPlayed = currentStats.matchesPlayed + 1;

        batch.set(playerRef, {
          name: DV.getPlayerName(playerId),
          elo: newElo,
          wins: newWins,
          losses: newLosses,
          matchesPlayed: newMatchesPlayed,
          lastMatch: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      });

      return batch.commit().then(function() {
        return { match: match, eloChanges: eloChanges };
      });
    });
  }

  /**
   * Get current ELOs and records for all players
   */
  function getPlayerElos() {
    return DV.db.collection('players').get().then(function(snapshot) {
      var elos = {};
      DV.PLAYERS.forEach(function(p) {
        elos[p.id] = {
          elo: DV.DEFAULT_ELO,
          wins: 0,
          losses: 0,
          matchesPlayed: 0
        };
      });
      snapshot.forEach(function(doc) {
        var data = doc.data();
        elos[doc.id] = {
          elo: data.elo !== undefined ? data.elo : DV.DEFAULT_ELO,
          wins: data.wins !== undefined ? data.wins : 0,
          losses: data.losses !== undefined ? data.losses : 0,
          matchesPlayed: data.matchesPlayed !== undefined ? data.matchesPlayed : 0
        };
      });
      return elos;
    });
  }

  /**
   * Get all matches (from cache)
   */
  function getAll() {
    return matchesCache;
  }

  /**
   * Get matches for a specific player
   */
  function getByPlayer(playerId) {
    return matchesCache.filter(function(m) {
      return m.team1.indexOf(playerId) >= 0 || m.team2.indexOf(playerId) >= 0;
    });
  }

  /**
   * Get recent matches (limited)
   */
  function getRecent(limit) {
    return matchesCache.slice(0, limit || 5);
  }

  /**
   * Delete a match and revert its ELO and stats changes
   */
  function deleteMatch(matchId) {
    var matchRef = DV.db.collection('matches').doc(matchId);
    return matchRef.get().then(function(doc) {
      if (!doc.exists) {
        throw new Error('Match does not exist');
      }
      var matchData = doc.data();
      var eloChanges = matchData.eloChanges || {};
      var allPlayers = matchData.team1.concat(matchData.team2);

      return getPlayerElos().then(function(playerElos) {
        var batch = DV.db.batch();

        // Delete the match document
        batch.delete(matchRef);

        // Revert player ELOs and stats
        allPlayers.forEach(function(playerId) {
          var playerRef = DV.db.collection('players').doc(playerId);
          var isWinner = matchData.winner === 'team1'
            ? matchData.team1.indexOf(playerId) >= 0
            : matchData.team2.indexOf(playerId) >= 0;

          var currentStats = playerElos[playerId] || { elo: DV.DEFAULT_ELO, wins: 0, losses: 0, matchesPlayed: 0 };
          var newElo = currentStats.elo - (eloChanges[playerId] || 0);
          var newWins = Math.max(0, currentStats.wins - (isWinner ? 1 : 0));
          var newLosses = Math.max(0, currentStats.losses - (isWinner ? 0 : 1));
          var newMatchesPlayed = Math.max(0, currentStats.matchesPlayed - 1);

          batch.set(playerRef, {
            elo: newElo,
            wins: newWins,
            losses: newLosses,
            matchesPlayed: newMatchesPlayed
          }, { merge: true });
        });

        return batch.commit();
      });
    });
  }

  /**
   * Recalculate all ratings and update database
   */
  function recalculateRatings() {
    return DV.db.collection('matches')
      .orderBy('createdAt', 'asc')
      .get()
      .then(function(snapshot) {
        var matches = [];
        snapshot.forEach(function(doc) {
          var data = doc.data();
          data.id = doc.id;
          matches.push(data);
        });

        var playersData = {};
        DV.PLAYERS.forEach(function(p) {
          playersData[p.id] = {
            elo: DV.DEFAULT_ELO,
            wins: 0,
            losses: 0,
            matchesPlayed: 0
          };
        });

        var batch = DV.db.batch();

        matches.forEach(function(match) {
          var currentElos = {};
          Object.keys(playersData).forEach(function(pid) {
            currentElos[pid] = playersData[pid].elo;
          });

          var newChanges = DV.Elo.calculateMatchElo(match, currentElos);

          var matchRef = DV.db.collection('matches').doc(match.id);
          batch.update(matchRef, { eloChanges: newChanges });

          var allPlayers = match.team1.concat(match.team2);
          allPlayers.forEach(function(playerId) {
            var isWinner = match.winner === 'team1'
              ? match.team1.indexOf(playerId) >= 0
              : match.team2.indexOf(playerId) >= 0;

            if (!playersData[playerId]) {
              playersData[playerId] = { elo: DV.DEFAULT_ELO, wins: 0, losses: 0, matchesPlayed: 0 };
            }

            playersData[playerId].elo += (newChanges[playerId] || 0);
            playersData[playerId].wins += (isWinner ? 1 : 0);
            playersData[playerId].losses += (isWinner ? 0 : 1);
            playersData[playerId].matchesPlayed += 1;
          });
        });

        Object.keys(playersData).forEach(function(playerId) {
          var playerRef = DV.db.collection('players').doc(playerId);
          batch.set(playerRef, {
            name: DV.getPlayerName(playerId),
            elo: playersData[playerId].elo,
            wins: playersData[playerId].wins,
            losses: playersData[playerId].losses,
            matchesPlayed: playersData[playerId].matchesPlayed
          }, { merge: true });
        });

        return batch.commit();
      });
  }

  /**
   * Register callback for match updates
   */
  function onUpdate(callback) {
    matchListeners.push(callback);
  }

  function notifyListeners(matches) {
    matchListeners.forEach(function(cb) {
      try { cb(matches); } catch(e) { console.error('Match listener error:', e); }
    });
  }

  /**
   * Format match scores for display
   */
  function formatScores(scores) {
    if (!scores || scores.length === 0) return '—';
    return scores.map(function(s) {
      return s.team1 + '–' + s.team2;
    }).join(', ');
  }

  /**
   * Format match date
   */
  function formatDate(timestamp) {
    if (!timestamp) return '—';
    var date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    var now = new Date();
    var diff = now - date;
    var days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return days + 'd ago';

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  /**
   * Format team names for display
   */
  function formatTeam(team) {
    return team.map(function(id) {
      return DV.getPlayerName(id);
    }).join(' & ');
  }

  // Public API
  return {
    init: init,
    logMatch: logMatch,
    getAll: getAll,
    getByPlayer: getByPlayer,
    getRecent: getRecent,
    deleteMatch: deleteMatch,
    recalculateRatings: recalculateRatings,
    onUpdate: onUpdate,
    formatScores: formatScores,
    formatDate: formatDate,
    formatTeam: formatTeam,
    getPlayerElos: getPlayerElos
  };

})();
