/* ============================================
   DV PICKLEBALL — Match Operations
   CRUD operations for match data in Firestore
   ============================================ */

window.DV = window.DV || {};

DV.Matches = (function() {

  var matchesCache = [];
  var matchListeners = [];
  var unsubscribe = null;

  function getEmptyPlayerStats() {
    return {
      eloDoubles: DV.DEFAULT_ELO, eloSingles: DV.DEFAULT_ELO,
      winsDoubles: 0, lossesDoubles: 0, matchesPlayedDoubles: 0,
      winsSingles: 0, lossesSingles: 0, matchesPlayedSingles: 0,
      wins: 0, losses: 0, matchesPlayed: 0
    };
  }

  function getStatsForMatchType(playerData, matchType) {
    var isSingles = matchType === 'singles';
    return {
      elo: isSingles ? (playerData.eloSingles !== undefined ? playerData.eloSingles : DV.DEFAULT_ELO) : (playerData.eloDoubles !== undefined ? playerData.eloDoubles : DV.DEFAULT_ELO),
      matchesPlayed: isSingles ? (playerData.matchesPlayedSingles || 0) : (playerData.matchesPlayedDoubles || 0)
    };
  }

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
      var matchStats = {};
      Object.keys(playerElos).forEach(function(pid) {
        matchStats[pid] = getStatsForMatchType(playerElos[pid], matchData.type);
      });

      // Calculate ELO changes
      var eloChanges = DV.Elo.calculateMatchElo(matchData, matchStats);

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

        var currentStats = playerElos[playerId] || getEmptyPlayerStats();
        var change = eloChanges[playerId] || 0;
        
        var updateObj = { lastMatch: firebase.firestore.FieldValue.serverTimestamp() };
        if (matchData.type === 'singles') {
           updateObj.eloSingles = (currentStats.eloSingles !== undefined ? currentStats.eloSingles : DV.DEFAULT_ELO) + change;
           updateObj.winsSingles = (currentStats.winsSingles || 0) + (isWinner ? 1 : 0);
           updateObj.lossesSingles = (currentStats.lossesSingles || 0) + (isWinner ? 0 : 1);
           updateObj.matchesPlayedSingles = (currentStats.matchesPlayedSingles || 0) + 1;
        } else {
           updateObj.eloDoubles = (currentStats.eloDoubles !== undefined ? currentStats.eloDoubles : DV.DEFAULT_ELO) + change;
           updateObj.winsDoubles = (currentStats.winsDoubles || 0) + (isWinner ? 1 : 0);
           updateObj.lossesDoubles = (currentStats.lossesDoubles || 0) + (isWinner ? 0 : 1);
           updateObj.matchesPlayedDoubles = (currentStats.matchesPlayedDoubles || 0) + 1;
        }

        updateObj.wins = (currentStats.wins || 0) + (isWinner ? 1 : 0);
        updateObj.losses = (currentStats.losses || 0) + (isWinner ? 0 : 1);
        updateObj.matchesPlayed = (currentStats.matchesPlayed || 0) + 1;
        
        // Also write name if missing
        updateObj.name = DV.getPlayerName(playerId);

        batch.set(playerRef, updateObj, { merge: true });
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
        elos[p.id] = getEmptyPlayerStats();
      });
      snapshot.forEach(function(doc) {
        var data = doc.data();
        elos[doc.id] = {
          eloDoubles: data.eloDoubles !== undefined ? data.eloDoubles : (data.elo !== undefined ? data.elo : DV.DEFAULT_ELO),
          eloSingles: data.eloSingles !== undefined ? data.eloSingles : DV.DEFAULT_ELO,
          winsDoubles: data.winsDoubles || 0,
          lossesDoubles: data.lossesDoubles || 0,
          matchesPlayedDoubles: data.matchesPlayedDoubles || 0,
          winsSingles: data.winsSingles || 0,
          lossesSingles: data.lossesSingles || 0,
          matchesPlayedSingles: data.matchesPlayedSingles || 0,
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

          var currentStats = playerElos[playerId] || getEmptyPlayerStats();
          var change = eloChanges[playerId] || 0;

          var updateObj = {};
          if (matchData.type === 'singles') {
             updateObj.eloSingles = (currentStats.eloSingles !== undefined ? currentStats.eloSingles : DV.DEFAULT_ELO) - change;
             updateObj.winsSingles = Math.max(0, (currentStats.winsSingles || 0) - (isWinner ? 1 : 0));
             updateObj.lossesSingles = Math.max(0, (currentStats.lossesSingles || 0) - (isWinner ? 0 : 1));
             updateObj.matchesPlayedSingles = Math.max(0, (currentStats.matchesPlayedSingles || 0) - 1);
          } else {
             updateObj.eloDoubles = (currentStats.eloDoubles !== undefined ? currentStats.eloDoubles : DV.DEFAULT_ELO) - change;
             updateObj.winsDoubles = Math.max(0, (currentStats.winsDoubles || 0) - (isWinner ? 1 : 0));
             updateObj.lossesDoubles = Math.max(0, (currentStats.lossesDoubles || 0) - (isWinner ? 0 : 1));
             updateObj.matchesPlayedDoubles = Math.max(0, (currentStats.matchesPlayedDoubles || 0) - 1);
          }
          
          updateObj.wins = Math.max(0, (currentStats.wins || 0) - (isWinner ? 1 : 0));
          updateObj.losses = Math.max(0, (currentStats.losses || 0) - (isWinner ? 0 : 1));
          updateObj.matchesPlayed = Math.max(0, (currentStats.matchesPlayed || 0) - 1);

          batch.set(playerRef, updateObj, { merge: true });
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
          playersData[p.id] = getEmptyPlayerStats();
        });

        var batch = DV.db.batch();

        matches.forEach(function(match) {
          var matchStats = {};
          Object.keys(playersData).forEach(function(pid) {
            matchStats[pid] = getStatsForMatchType(playersData[pid], match.type);
          });

          var newChanges = DV.Elo.calculateMatchElo(match, matchStats);

          var matchRef = DV.db.collection('matches').doc(match.id);
          batch.update(matchRef, { eloChanges: newChanges });

          var allPlayers = match.team1.concat(match.team2);
          allPlayers.forEach(function(playerId) {
            var isWinner = match.winner === 'team1'
              ? match.team1.indexOf(playerId) >= 0
              : match.team2.indexOf(playerId) >= 0;

            if (!playersData[playerId]) {
              playersData[playerId] = getEmptyPlayerStats();
            }

            var change = newChanges[playerId] || 0;
            if (match.type === 'singles') {
               playersData[playerId].eloSingles += change;
               playersData[playerId].winsSingles += (isWinner ? 1 : 0);
               playersData[playerId].lossesSingles += (isWinner ? 0 : 1);
               playersData[playerId].matchesPlayedSingles += 1;
            } else {
               playersData[playerId].eloDoubles += change;
               playersData[playerId].winsDoubles += (isWinner ? 1 : 0);
               playersData[playerId].lossesDoubles += (isWinner ? 0 : 1);
               playersData[playerId].matchesPlayedDoubles += 1;
            }
            
            playersData[playerId].wins += (isWinner ? 1 : 0);
            playersData[playerId].losses += (isWinner ? 0 : 1);
            playersData[playerId].matchesPlayed += 1;
          });
        });

        Object.keys(playersData).forEach(function(playerId) {
          var playerRef = DV.db.collection('players').doc(playerId);
          var pd = playersData[playerId];
          batch.set(playerRef, {
            name: DV.getPlayerName(playerId),
            eloDoubles: pd.eloDoubles,
            eloSingles: pd.eloSingles,
            winsDoubles: pd.winsDoubles,
            lossesDoubles: pd.lossesDoubles,
            matchesPlayedDoubles: pd.matchesPlayedDoubles,
            winsSingles: pd.winsSingles,
            lossesSingles: pd.lossesSingles,
            matchesPlayedSingles: pd.matchesPlayedSingles,
            wins: pd.wins,
            losses: pd.losses,
            matchesPlayed: pd.matchesPlayed
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
