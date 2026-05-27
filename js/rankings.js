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
        });

        // Add any players who haven't played yet
        DV.PLAYERS.forEach(function(p) {
          var exists = playersCache.some(function(pc) { return pc.id === p.id; });
          if (!exists) {
            playersCache.push({
              id: p.id,
              name: p.name,
              elo: DV.DEFAULT_ELO,
              wins: 0,
              losses: 0,
              matchesPlayed: 0
            });
          }
        });

        // Sort by ELO descending
        playersCache.sort(function(a, b) { return (b.elo || DV.DEFAULT_ELO) - (a.elo || DV.DEFAULT_ELO); });

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
    var total = (player.wins || 0) + (player.losses || 0);
    if (total === 0) return 0;
    return Math.round(((player.wins || 0) / total) * 100);
  }

  /**
   * Get trend indicator for a player (based on last match ELO change)
   */
  function getTrend(playerId) {
    var matches = DV.Matches.getByPlayer(playerId);
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
    return playersCache[0].elo || DV.DEFAULT_ELO;
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
    onUpdate: onUpdate
  };

})();
