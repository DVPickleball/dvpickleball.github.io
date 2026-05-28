/* ============================================
   DV PICKLEBALL — Rankings Module
   ELO Rankings + Unofficial Committee Rankings
   ============================================ */

window.DV = window.DV || {};

DV.Rankings = (function() {

  var playersCache = [];
  var unofficialCache = null;
  var playerListeners = [];
  var unsubPlayers = null;
  var unsubUnofficial = null;
  var activeRankingType = 'doubles'; // 'doubles' or 'singles'

  function setRankingType(type) {
    if (activeRankingType !== type) {
      activeRankingType = type;
      sortPlayersCache();
      notifyListeners(playersCache);
    }
  }

  function getRankingType() {
    return activeRankingType;
  }

  function sortPlayersCache() {
    playersCache.sort(function(a, b) {
      var eloA = activeRankingType === 'singles' 
        ? (a.eloSingles !== undefined ? a.eloSingles : DV.DEFAULT_ELO) 
        : (a.eloDoubles !== undefined ? a.eloDoubles : (a.elo !== undefined ? a.elo : DV.DEFAULT_ELO));
      var eloB = activeRankingType === 'singles' 
        ? (b.eloSingles !== undefined ? b.eloSingles : DV.DEFAULT_ELO) 
        : (b.eloDoubles !== undefined ? b.eloDoubles : (b.elo !== undefined ? b.elo : DV.DEFAULT_ELO));
      return eloB - eloA;
    });
  }

  /**
   * Initialize real-time listeners
   */
  function init() {
    // Listen to player documents for ELO rankings
    unsubPlayers = DV.db.collection('players')
      .onSnapshot(function(snapshot) {
        playersCache = [];
        snapshot.forEach(function(doc) {
          var data = doc.data();
          data.id = doc.id;
          playersCache.push(data);

          // Auto-register Firestore players not in the hardcoded roster
          if (data.name) {
            DV.addPlayer(doc.id, data.name);
          }
        });

        // Add any players who haven't played yet
        DV.PLAYERS.forEach(function(p) {
          var exists = playersCache.some(function(pc) { return pc.id === p.id; });
          if (!exists) {
            playersCache.push({
              id: p.id,
              name: p.name,
              eloDoubles: DV.DEFAULT_ELO,
              eloSingles: DV.DEFAULT_ELO,
              winsDoubles: 0, lossesDoubles: 0, matchesPlayedDoubles: 0,
              winsSingles: 0, lossesSingles: 0, matchesPlayedSingles: 0,
              wins: 0, losses: 0, matchesPlayed: 0
            });
          }
        });

        // Sort by selected ELO descending
        sortPlayersCache();

        notifyListeners(playersCache);
      }, function(err) {
        console.error('Players listener error:', err);
      });

    // Listen to unofficial rankings
    unsubUnofficial = DV.db.collection('rankings').doc('unofficial')
      .onSnapshot(function(doc) {
        if (doc.exists) {
          unofficialCache = doc.data();
        } else {
          // Initialize with default ordering
          unofficialCache = getDefaultUnofficial();
        }
        // Notify UI to re-render
        notifyListeners(playersCache);
      }, function(err) {
        console.error('Unofficial rankings listener error:', err);
      });
  }

  /**
   * Get default unofficial rankings
   */
  function getDefaultUnofficial() {
    return {
      rankings: DV.PLAYERS.map(function(p, i) {
        return { playerId: p.id, rank: i + 1, comment: '' };
      }),
      updatedAt: null,
      updatedBy: null
    };
  }

  /**
   * Get ELO-sorted player list
   */
  function getEloRankings() {
    return playersCache.slice();
  }

  /**
   * Get unofficial rankings
   */
  function getUnofficialRankings() {
    return unofficialCache || getDefaultUnofficial();
  }

  /**
   * Save unofficial rankings to Firestore
   */
  function saveUnofficialRankings(rankings) {
    return DV.db.collection('rankings').doc('unofficial').set({
      rankings: rankings,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: DV.Auth.getUser() ? DV.Auth.getUser().email : 'unknown'
    });
  }

  /**
   * Get a specific player's data
   */
  function getPlayer(playerId) {
    return playersCache.find(function(p) { return p.id === playerId; }) || {
      id: playerId,
      name: DV.getPlayerName(playerId),
      elo: DV.DEFAULT_ELO,
      wins: 0,
      losses: 0,
      matchesPlayed: 0
    };
  }

  /**
   * Get player's current rank
   */
  function getPlayerRank(playerId) {
    var idx = playersCache.findIndex(function(p) { return p.id === playerId; });
    return idx >= 0 ? idx + 1 : '—';
  }

  /**
   * Get win rate for a player
   */
  function getWinRate(player) {
    var wins = activeRankingType === 'singles' ? (player.winsSingles || 0) : (player.winsDoubles || 0);
    var losses = activeRankingType === 'singles' ? (player.lossesSingles || 0) : (player.lossesDoubles || 0);
    var total = wins + losses;
    if (total === 0) return 0;
    return Math.round((wins / total) * 100);
  }

  /**
   * Get trend indicator for a player (based on last match ELO change)
   */
  function getTrend(playerId) {
    // Filter matches by activeRankingType to only consider trends for the active type
    var matches = DV.Matches.getByPlayer(playerId).filter(function(m) { return m.type === activeRankingType; });
    if (matches.length === 0) return { direction: 'new', change: 0 };

    var lastMatch = matches[0]; // already sorted desc
    var change = lastMatch.eloChanges ? (lastMatch.eloChanges[playerId] || 0) : 0;

    if (change > 0) return { direction: 'up', change: change };
    if (change < 0) return { direction: 'down', change: change };
    return { direction: 'same', change: 0 };
  }

  /**
   * Get the top N players (for dashboard)
   */
  function getTop(n) {
    return playersCache.slice(0, n || 5);
  }

  /**
   * Get total number of active players
   */
  function getActivePlayerCount() {
    return playersCache.filter(function(p) { return (p.matchesPlayed || 0) > 0; }).length;
  }

  /**
   * Get the highest ELO
   */
  function getTopElo() {
    if (playersCache.length === 0) return DV.DEFAULT_ELO;
    var topP = playersCache[0];
    return activeRankingType === 'singles' 
      ? (topP.eloSingles !== undefined ? topP.eloSingles : DV.DEFAULT_ELO) 
      : (topP.eloDoubles !== undefined ? topP.eloDoubles : (topP.elo !== undefined ? topP.elo : DV.DEFAULT_ELO));
  }

  /**
   * Register a callback for ranking updates
   */
  function onUpdate(callback) {
    playerListeners.push(callback);
  }

  function notifyListeners(players) {
    playerListeners.forEach(function(cb) {
      try { cb(players); } catch(e) { console.error('Rankings listener error:', e); }
    });
  }

  // Public API
  return {
    init: init,
    getEloRankings: getEloRankings,
    getUnofficialRankings: getUnofficialRankings,
    saveUnofficialRankings: saveUnofficialRankings,
    getPlayer: getPlayer,
    getPlayerRank: getPlayerRank,
    getWinRate: getWinRate,
    getTrend: getTrend,
    getTop: getTop,
    getActivePlayerCount: getActivePlayerCount,
    getTopElo: getTopElo,
    onUpdate: onUpdate,
    setRankingType: setRankingType,
    getRankingType: getRankingType
  };

})();
