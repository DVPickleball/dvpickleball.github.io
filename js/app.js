/* ============================================
   DV PICKLEBALL — Main Application Controller
   Routing, UI orchestration, event handlers
   ============================================ */

window.DV = window.DV || {};

DV.App = (function() {

  var currentPage = 'dashboard';
  var currentMatchType = 'doubles';
  var selectedWinner = null;

  /* ---- Initialization ---- */

  function init() {
    // Init modules
    DV.Auth.init();
    DV.Matches.init();
    DV.Rankings.init();

    // Set up event listeners
    setupNavigation();
    setupLoginModal();
    setupMatchForm();
    setupTabs();
    setupMobileMenu();
    setupUnofficialEdit();

    // Listen for data updates
    DV.Matches.onUpdate(function() {
      renderDashboard();
      renderMatchHistory();
      renderPlayers();
    });

    DV.Rankings.onUpdate(function() {
      renderDashboard();
      renderEloRankings();
      renderUnofficialRankings();
      renderPlayers();
    });

    // Handle initial route
    handleRoute();
    window.addEventListener('hashchange', handleRoute);

    // Nav scroll effect
    window.addEventListener('scroll', function() {
      var nav = document.getElementById('main-nav');
      if (window.scrollY > 10) {
        nav.classList.add('scrolled');
      } else {
        nav.classList.remove('scrolled');
      }
    });

    // Dismiss loading screen
    setTimeout(function() {
      var ls = document.getElementById('loading-screen');
      if (ls) {
        ls.classList.add('fade-out');
        setTimeout(function() { ls.style.display = 'none'; }, 600);
      }
    }, 1800);

    // Populate player selects
    populatePlayerSelects();
  }


  /* ---- Routing ---- */

  function handleRoute() {
    var hash = window.location.hash.replace('#', '') || 'dashboard';
    navigateTo(hash);
  }

  function navigateTo(page) {
    currentPage = page;

    // Hide all pages, show target
    document.querySelectorAll('.page').forEach(function(el) {
      el.classList.remove('active');
    });
    var target = document.getElementById('page-' + page);
    if (target) {
      target.classList.add('active');
    }

    // Update nav links
    document.querySelectorAll('.nav-link').forEach(function(el) {
      el.classList.remove('active');
      if (el.getAttribute('data-page') === page) {
        el.classList.add('active');
      }
    });

    // Close mobile menu
    var navLinks = document.getElementById('nav-links');
    if (navLinks) navLinks.classList.remove('open');

    // Scroll to top
    window.scrollTo(0, 0);
  }


  /* ---- Navigation ---- */

  function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(function(link) {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        var page = this.getAttribute('data-page');
        window.location.hash = page;
      });
    });
  }

  function setupMobileMenu() {
    var btn = document.getElementById('mobile-menu-btn');
    var links = document.getElementById('nav-links');
    if (btn && links) {
      btn.addEventListener('click', function() {
        links.classList.toggle('open');
      });
    }
  }


  /* ---- Login Modal ---- */

  function setupLoginModal() {
    var loginBtn = document.getElementById('login-btn');
    var modal = document.getElementById('login-modal');
    var closeBtn = document.getElementById('close-login-modal');
    var overlay = modal ? modal.querySelector('.modal-overlay') : null;
    var form = document.getElementById('login-form');
    var logoutBtn = document.getElementById('logout-btn');

    if (loginBtn) {
      loginBtn.addEventListener('click', function() {
        modal.classList.remove('hidden');
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        modal.classList.add('hidden');
      });
    }

    if (overlay) {
      overlay.addEventListener('click', function() {
        modal.classList.add('hidden');
      });
    }

    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        var email = document.getElementById('login-email').value;
        var password = document.getElementById('login-password').value;
        var errorEl = document.getElementById('login-error');

        DV.Auth.signIn(email, password)
          .then(function() {
            modal.classList.add('hidden');
            form.reset();
            if (errorEl) errorEl.classList.add('hidden');
            showToast('Welcome back! 🏓', 'success');
          })
          .catch(function(err) {
            if (errorEl) {
              errorEl.textContent = getAuthErrorMessage(err.code);
              errorEl.classList.remove('hidden');
            }
          });
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', function() {
        DV.Auth.signOut().then(function() {
          showToast('Signed out', 'info');
        });
      });
    }
  }

  function getAuthErrorMessage(code) {
    switch (code) {
      case 'auth/invalid-email': return 'Invalid email address.';
      case 'auth/user-not-found': return 'No account found with this email.';
      case 'auth/wrong-password': return 'Incorrect password.';
      case 'auth/invalid-credential': return 'Invalid email or password.';
      case 'auth/too-many-requests': return 'Too many attempts. Try again later.';
      default: return 'Sign in failed. Please try again.';
    }
  }


  /* ---- Tabs ---- */

  function setupTabs() {
    document.querySelectorAll('.tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        var tabName = this.getAttribute('data-tab');
        var parent = this.closest('.section-header') || this.parentElement;

        // Update tab buttons
        parent.querySelectorAll('.tab').forEach(function(t) {
          t.classList.remove('active');
        });
        this.classList.add('active');

        // Update tab content
        var container = this.closest('.page') || document.body;
        container.querySelectorAll('.tab-content').forEach(function(tc) {
          tc.classList.remove('active');
        });
        var content = document.getElementById('tab-' + tabName);
        if (content) content.classList.add('active');
      });
    });
  }


  /* ---- Match Form ---- */

  function setupMatchForm() {
    var logBtn = document.getElementById('log-match-btn');
    var closeBtn = document.getElementById('close-match-form');
    var form = document.getElementById('match-form');
    var formContainer = document.getElementById('log-match-form');

    // Toggle form visibility
    if (logBtn) {
      logBtn.addEventListener('click', function() {
        formContainer.classList.toggle('hidden');
        if (!formContainer.classList.contains('hidden')) {
          formContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        formContainer.classList.add('hidden');
      });
    }

    // Match type toggles
    document.querySelectorAll('[data-type]').forEach(function(toggle) {
      toggle.addEventListener('click', function() {
        currentMatchType = this.getAttribute('data-type');
        document.querySelectorAll('[data-type]').forEach(function(t) {
          t.classList.remove('active');
        });
        this.classList.add('active');

        // Show/hide partner selects
        document.querySelectorAll('.doubles-only').forEach(function(el) {
          if (currentMatchType === 'singles') {
            el.classList.add('hidden');
          } else {
            el.classList.remove('hidden');
          }
        });
      });
    });

    // Winner toggles
    document.querySelectorAll('.winner-toggle').forEach(function(toggle) {
      toggle.addEventListener('click', function() {
        selectedWinner = this.getAttribute('data-winner');
        document.querySelectorAll('.winner-toggle').forEach(function(t) {
          t.classList.remove('active');
        });
        this.classList.add('active');
      });
    });

    // Form submission
    if (form) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        submitMatch();
      });
    }
  }

  function populatePlayerSelects() {
    var selects = ['t1p1', 't1p2', 't2p1', 't2p2', 'match-filter-player'];
    selects.forEach(function(id) {
      var select = document.getElementById(id);
      if (!select) return;

      // Keep the first option (placeholder)
      var firstOption = select.options[0];
      select.innerHTML = '';
      select.appendChild(firstOption);

      DV.PLAYERS.forEach(function(p) {
        var opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        select.appendChild(opt);
      });
    });
  }

  function submitMatch() {
    // Validate
    var t1p1 = document.getElementById('t1p1').value;
    var t2p1 = document.getElementById('t2p1').value;

    if (!t1p1 || !t2p1) {
      showToast('Please select players for both teams.', 'error');
      return;
    }

    var team1 = [t1p1];
    var team2 = [t2p1];

    if (currentMatchType === 'doubles') {
      var t1p2 = document.getElementById('t1p2').value;
      var t2p2 = document.getElementById('t2p2').value;
      if (!t1p2 || !t2p2) {
        showToast('Please select both players for each team.', 'error');
        return;
      }
      team1.push(t1p2);
      team2.push(t2p2);
    }

    // Check for duplicate players
    var allPlayers = team1.concat(team2);
    var unique = new Set(allPlayers);
    if (unique.size !== allPlayers.length) {
      showToast('A player can\'t be on both teams!', 'error');
      return;
    }

    if (!selectedWinner) {
      showToast('Please select a winner.', 'error');
      return;
    }

    // Collect scores
    var scores = [];
    var g1t1 = document.getElementById('g1t1').value;
    var g1t2 = document.getElementById('g1t2').value;
    if (g1t1 !== '' && g1t2 !== '') {
      scores.push({ team1: parseInt(g1t1), team2: parseInt(g1t2) });
    }

    var g2t1 = document.getElementById('g2t1').value;
    var g2t2 = document.getElementById('g2t2').value;
    if (g2t1 !== '' && g2t2 !== '') {
      scores.push({ team1: parseInt(g2t1), team2: parseInt(g2t2) });
    }

    var g3t1 = document.getElementById('g3t1').value;
    var g3t2 = document.getElementById('g3t2').value;
    if (g3t1 !== '' && g3t2 !== '') {
      scores.push({ team1: parseInt(g3t1), team2: parseInt(g3t2) });
    }

    var matchData = {
      type: currentMatchType,
      team1: team1,
      team2: team2,
      scores: scores,
      winner: selectedWinner
    };

    // Disable submit button
    var submitBtn = document.getElementById('submit-match-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
    }

    DV.Matches.logMatch(matchData)
      .then(function(result) {
        showToast('Match logged! ELO updated. 🎉', 'success');

        // Reset form
        document.getElementById('match-form').reset();
        selectedWinner = null;
        document.querySelectorAll('.winner-toggle').forEach(function(t) {
          t.classList.remove('active');
        });
        document.getElementById('log-match-form').classList.add('hidden');
      })
      .catch(function(err) {
        console.error('Failed to log match:', err);
        showToast('Failed to log match. ' + err.message, 'error');
      })
      .finally(function() {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Match';
        }
      });
  }


  /* ---- Unofficial Rankings Edit ---- */

  function setupUnofficialEdit() {
    var editBtn = document.getElementById('edit-unofficial-btn');
    var saveBtn = document.getElementById('save-unofficial-btn');
    var cancelBtn = document.getElementById('cancel-unofficial-btn');

    if (editBtn) {
      editBtn.addEventListener('click', function() {
        var listEl = document.getElementById('unofficial-rankings-list');
        var editEl = document.getElementById('unofficial-edit');
        if (listEl) listEl.classList.add('hidden');
        if (editEl) editEl.classList.remove('hidden');
        editBtn.classList.add('hidden');
        renderUnofficialEditList();
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', function() {
        var listEl = document.getElementById('unofficial-rankings-list');
        var editEl = document.getElementById('unofficial-edit');
        if (listEl) listEl.classList.remove('hidden');
        if (editEl) editEl.classList.add('hidden');
        if (editBtn) editBtn.classList.remove('hidden');
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', function() {
        saveUnofficialFromEdit();
      });
    }
  }

  var editOrder = [];

  function renderUnofficialEditList() {
    var container = document.getElementById('unofficial-edit-list');
    if (!container) return;

    var current = DV.Rankings.getUnofficialRankings();
    editOrder = current.rankings.map(function(r) { return r.playerId; });

    renderEditItems(container);
  }

  function renderEditItems(container) {
    container.innerHTML = '';
    editOrder.forEach(function(playerId, index) {
      var item = document.createElement('div');
      item.className = 'sortable-item';
      item.setAttribute('data-id', playerId);
      item.innerHTML =
        '<span class="drag-handle">☰</span>' +
        '<span class="unofficial-rank" style="color:var(--accent)">' + (index + 1) + '</span>' +
        '<span class="unofficial-name">' + DV.getPlayerName(playerId) + '</span>' +
        '<div class="move-btns">' +
          '<button class="move-btn move-up" data-idx="' + index + '">▲</button>' +
          '<button class="move-btn move-down" data-idx="' + index + '">▼</button>' +
        '</div>';
      container.appendChild(item);
    });

    // Arrow button listeners
    container.querySelectorAll('.move-up').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(this.getAttribute('data-idx'));
        if (idx > 0) {
          var temp = editOrder[idx];
          editOrder[idx] = editOrder[idx - 1];
          editOrder[idx - 1] = temp;
          renderEditItems(container);
        }
      });
    });

    container.querySelectorAll('.move-down').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(this.getAttribute('data-idx'));
        if (idx < editOrder.length - 1) {
          var temp = editOrder[idx];
          editOrder[idx] = editOrder[idx + 1];
          editOrder[idx + 1] = temp;
          renderEditItems(container);
        }
      });
    });
  }

  function saveUnofficialFromEdit() {
    var rankings = editOrder.map(function(playerId, index) {
      return { playerId: playerId, rank: index + 1, comment: '' };
    });

    DV.Rankings.saveUnofficialRankings(rankings)
      .then(function() {
        showToast('Rankings saved! 🏆', 'success');
        var listEl = document.getElementById('unofficial-rankings-list');
        var editEl = document.getElementById('unofficial-edit');
        var editBtn = document.getElementById('edit-unofficial-btn');
        if (listEl) listEl.classList.remove('hidden');
        if (editEl) editEl.classList.add('hidden');
        if (editBtn) editBtn.classList.remove('hidden');
      })
      .catch(function(err) {
        showToast('Failed to save rankings. ' + err.message, 'error');
      });
  }


  /* ---- Render: Dashboard ---- */

  function renderDashboard() {
    // Stats bar
    var totalMatches = DV.Stats.getTotalMatches();
    setText('stat-matches', totalMatches);
    setText('stat-players', DV.PLAYERS.length);
    setText('stat-top-elo', DV.Rankings.getTopElo());

    var streak = DV.Stats.getLongestStreak();
    if (streak.count > 0) {
      setText('stat-streak', streak.count + 'W ' + DV.getPlayerName(streak.playerId));
    } else {
      setText('stat-streak', '—');
    }

    // Recent matches
    renderRecentMatches();

    // Top rankings preview
    renderTopRankings();
  }

  function renderRecentMatches() {
    var container = document.getElementById('recent-matches-list');
    if (!container) return;

    var matches = DV.Matches.getRecent(5);

    if (matches.length === 0) {
      container.innerHTML =
        '<div class="empty-state">' +
          '<span class="empty-icon">🏓</span>' +
          '<p>No matches yet. Time to play!</p>' +
        '</div>';
      return;
    }

    container.innerHTML = '';
    matches.forEach(function(match, i) {
      container.appendChild(createMatchItem(match, i));
    });
  }

  function renderTopRankings() {
    var container = document.getElementById('top-rankings-list');
    if (!container) return;

    var top = DV.Rankings.getTop(5);

    if (top.length === 0 || (top.length > 0 && top[0].matchesPlayed === 0 && DV.Matches.getAll().length === 0)) {
      container.innerHTML =
        '<div class="empty-state">' +
          '<span class="empty-icon">🏆</span>' +
          '<p>Rankings appear after matches.</p>' +
        '</div>';
      return;
    }

    container.innerHTML = '';
    top.forEach(function(player, i) {
      var item = document.createElement('div');
      item.className = 'rank-preview-item animate-in stagger-' + (i + 1);
      var posColor = i === 0 ? 'var(--gold)' : i === 1 ? 'var(--silver)' : i === 2 ? 'var(--bronze)' : 'var(--text-muted)';
      item.innerHTML =
        '<span class="rank-preview-pos" style="color:' + posColor + '">' + (i + 1) + '</span>' +
        '<div class="player-avatar" style="background:' + DV.getAvatarColor(player.id) + ';color:#fff">' +
          DV.getInitials(player.name || DV.getPlayerName(player.id)) +
        '</div>' +
        '<span class="rank-preview-name">' + (player.name || DV.getPlayerName(player.id)) + '</span>' +
        '<span class="rank-preview-elo">' + (player.elo || DV.DEFAULT_ELO) + '</span>';
      container.appendChild(item);
    });
  }


  /* ---- Render: ELO Rankings ---- */

  function renderEloRankings() {
    var tbody = document.getElementById('elo-table-body');
    if (!tbody) return;

    var players = DV.Rankings.getEloRankings();

    tbody.innerHTML = '';
    players.forEach(function(player, i) {
      var rank = i + 1;
      var trend = DV.Rankings.getTrend(player.id);
      var winRate = DV.Rankings.getWinRate(player);
      var wins = player.wins || 0;
      var losses = player.losses || 0;

      var rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-other';
      var trendHTML = '';
      if (trend.direction === 'up') {
        trendHTML = '<span class="trend-up">▲ <span class="elo-change positive">+' + trend.change + '</span></span>';
      } else if (trend.direction === 'down') {
        trendHTML = '<span class="trend-down">▼ <span class="elo-change negative">' + trend.change + '</span></span>';
      } else if (trend.direction === 'new') {
        trendHTML = '<span class="text-muted" style="font-size:0.75rem">NEW</span>';
      } else {
        trendHTML = '<span class="trend-same">—</span>';
      }

      var tr = document.createElement('tr');
      tr.className = 'animate-in stagger-' + Math.min(rank, 10);
      tr.style.cursor = 'pointer';
      tr.setAttribute('data-player', player.id);
      tr.addEventListener('click', function() {
        showPlayerDetail(player.id);
        window.location.hash = 'players';
      });

      tr.innerHTML =
        '<td class="th-rank"><span class="rank-badge ' + rankClass + '">' + rank + '</span></td>' +
        '<td>' +
          '<div class="player-name-cell">' +
            '<div class="player-avatar" style="background:' + DV.getAvatarColor(player.id) + ';color:#fff">' +
              DV.getInitials(player.name || DV.getPlayerName(player.id)) +
            '</div>' +
            '<span>' + (player.name || DV.getPlayerName(player.id)) + '</span>' +
          '</div>' +
        '</td>' +
        '<td><span class="elo-value">' + (player.elo || DV.DEFAULT_ELO) + '</span></td>' +
        '<td>' + wins + '–' + losses + '</td>' +
        '<td><span class="win-rate">' + winRate + '%</span></td>' +
        '<td class="th-trend">' + trendHTML + '</td>';

      tbody.appendChild(tr);
    });
  }


  /* ---- Render: Unofficial Rankings ---- */

  function renderUnofficialRankings() {
    var container = document.getElementById('unofficial-rankings-list');
    if (!container) return;

    var data = DV.Rankings.getUnofficialRankings();
    var rankings = data.rankings || [];

    container.innerHTML = '';
    rankings.forEach(function(r, i) {
      var item = document.createElement('div');
      item.className = 'unofficial-item animate-in stagger-' + Math.min(i + 1, 10);
      var posColor = i === 0 ? 'var(--gold)' : i === 1 ? 'var(--silver)' : i === 2 ? 'var(--bronze)' : 'var(--text-muted)';
      item.innerHTML =
        '<span class="unofficial-rank" style="color:' + posColor + '">' + (r.rank || i + 1) + '</span>' +
        '<div class="player-avatar" style="background:' + DV.getAvatarColor(r.playerId) + ';color:#fff">' +
          DV.getInitials(DV.getPlayerName(r.playerId)) +
        '</div>' +
        '<span class="unofficial-name">' + DV.getPlayerName(r.playerId) + '</span>' +
        (r.comment ? '<span class="unofficial-comment">' + r.comment + '</span>' : '');
      container.appendChild(item);
    });

    if (data.updatedAt) {
      var dateStr = data.updatedAt.toDate ? data.updatedAt.toDate().toLocaleDateString() : '';
      var byStr = data.updatedBy || '';
      var footer = document.createElement('div');
      footer.className = 'text-muted';
      footer.style.marginTop = 'var(--space-md)';
      footer.style.fontSize = '0.75rem';
      footer.textContent = 'Last updated: ' + dateStr + (byStr ? ' by ' + byStr : '');
      container.appendChild(footer);
    }
  }


  /* ---- Render: Match History ---- */

  function renderMatchHistory() {
    var container = document.getElementById('match-history-list');
    if (!container) return;

    var filterPlayer = document.getElementById('match-filter-player');
    var playerId = filterPlayer ? filterPlayer.value : '';

    var matches = playerId ? DV.Matches.getByPlayer(playerId) : DV.Matches.getAll();

    if (matches.length === 0) {
      container.innerHTML =
        '<div class="empty-state">' +
          '<span class="empty-icon">📋</span>' +
          '<p>No matches recorded yet.</p>' +
        '</div>';
      return;
    }

    container.innerHTML = '';
    matches.forEach(function(match, i) {
      container.appendChild(createMatchItem(match, i));
    });

    // Setup filter listener (once)
    if (filterPlayer && !filterPlayer._listening) {
      filterPlayer._listening = true;
      filterPlayer.addEventListener('change', renderMatchHistory);
    }
  }

  function createMatchItem(match, index) {
    var item = document.createElement('div');
    item.className = 'match-item animate-in stagger-' + Math.min(index + 1, 10);

    var team1Names = DV.Matches.formatTeam(match.team1);
    var team2Names = DV.Matches.formatTeam(match.team2);
    var scoreStr = DV.Matches.formatScores(match.scores);
    var dateStr = DV.Matches.formatDate(match.createdAt);

    var team1Class = match.winner === 'team1' ? 'match-team winner' : 'match-team';
    var team2Class = match.winner === 'team2' ? 'match-team winner' : 'match-team';

    // ELO changes
    var eloHTML = '';
    if (match.eloChanges) {
      var allPlayers = match.team1.concat(match.team2);
      eloHTML = '<div class="match-elo-changes">';
      allPlayers.forEach(function(pid) {
        var change = match.eloChanges[pid] || 0;
        var cls = change > 0 ? 'positive' : change < 0 ? 'negative' : '';
        var sign = change > 0 ? '+' : '';
        eloHTML += '<span class="elo-change ' + cls + '">' + DV.getPlayerName(pid) + ' ' + sign + change + '</span>';
      });
      eloHTML += '</div>';
    }

    item.innerHTML =
      '<span class="match-date">' + dateStr + '</span>' +
      '<span class="match-type-badge">' + (match.type || 'doubles') + '</span>' +
      '<div class="match-teams">' +
        '<span class="' + team1Class + '">' + team1Names + '</span>' +
        '<span class="match-vs">vs</span>' +
        '<span class="' + team2Class + '">' + team2Names + '</span>' +
      '</div>' +
      '<span class="match-score">' + scoreStr + '</span>' +
      eloHTML;

    // Delete button (auth-only)
    var isAuth = DV.Auth.isLoggedIn();
    var deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-match-btn auth-only' + (isAuth ? '' : ' hidden');
    deleteBtn.title = 'Delete Match';
    deleteBtn.innerHTML = '×';
    deleteBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (confirm('Are you sure you want to delete this match? This will revert the ELO ratings and stats for all players in this match.')) {
        deleteBtn.disabled = true;
        deleteBtn.textContent = '...';
        DV.Matches.deleteMatch(match.id)
          .then(function() {
            showToast('Match deleted and ELOs reverted. 🗑️', 'info');
          })
          .catch(function(err) {
            console.error('Error deleting match:', err);
            showToast('Error deleting match: ' + err.message, 'error');
            deleteBtn.disabled = false;
            deleteBtn.innerHTML = '×';
          });
      }
    });
    item.appendChild(deleteBtn);

    return item;
  }


  /* ---- Render: Players ---- */

  function renderPlayers() {
    var container = document.getElementById('players-grid');
    if (!container) return;

    container.innerHTML = '';
    var players = DV.Rankings.getEloRankings();

    players.forEach(function(player, i) {
      var card = document.createElement('div');
      card.className = 'player-card animate-in stagger-' + Math.min(i + 1, 10);
      card.setAttribute('data-player', player.id);

      var wins = player.wins || 0;
      var losses = player.losses || 0;
      var elo = player.elo || DV.DEFAULT_ELO;

      card.innerHTML =
        '<div class="player-avatar-lg" style="background:' + DV.getAvatarColor(player.id) + ';color:#fff">' +
          DV.getInitials(player.name || DV.getPlayerName(player.id)) +
        '</div>' +
        '<div class="player-card-name">' + (player.name || DV.getPlayerName(player.id)) + '</div>' +
        '<div class="player-card-elo">' + elo + '</div>' +
        '<div class="player-card-record">' + wins + 'W – ' + losses + 'L</div>';

      card.addEventListener('click', function() {
        showPlayerDetail(player.id);
      });

      container.appendChild(card);
    });
  }


  /* ---- Player Detail ---- */

  function showPlayerDetail(playerId) {
    var panel = document.getElementById('player-detail');
    if (!panel) return;

    var stats = DV.Stats.getPlayerStats(playerId);
    var player = DV.Rankings.getPlayer(playerId);

    // Avatar
    var avatar = document.getElementById('detail-avatar');
    if (avatar) {
      avatar.style.background = DV.getAvatarColor(playerId);
      avatar.style.color = '#fff';
      avatar.textContent = DV.getInitials(player.name || DV.getPlayerName(playerId));
    }

    // Name & badges
    setText('detail-name', player.name || DV.getPlayerName(playerId));
    setText('detail-elo', stats.elo + ' ELO');
    setText('detail-rank', '#' + stats.rank);

    // Stats tiles
    var statsContainer = document.getElementById('detail-stats');
    if (statsContainer) {
      statsContainer.innerHTML = '';
      var tiles = [
        { value: stats.elo, label: 'ELO Rating' },
        { value: stats.wins + '–' + stats.losses, label: 'Record' },
        { value: stats.winRate + '%', label: 'Win Rate' },
        { value: stats.matchesPlayed, label: 'Matches' },
        { value: stats.currentStreak.count > 0 ? stats.currentStreak.count + stats.currentStreak.type : '—', label: 'Current Streak' },
        { value: stats.bestStreak > 0 ? stats.bestStreak + 'W' : '—', label: 'Best Streak' }
      ];

      tiles.forEach(function(tile) {
        var el = document.createElement('div');
        el.className = 'detail-stat-tile';
        el.innerHTML =
          '<span class="detail-stat-value">' + tile.value + '</span>' +
          '<span class="detail-stat-label">' + tile.label + '</span>';
        statsContainer.appendChild(el);
      });
    }

    // Recent matches
    var matchesContainer = document.getElementById('detail-matches');
    if (matchesContainer) {
      matchesContainer.innerHTML = '';
      if (stats.recentMatches.length === 0) {
        matchesContainer.innerHTML = '<p class="text-muted" style="padding:var(--space-md)">No matches yet.</p>';
      } else {
        stats.recentMatches.forEach(function(match, i) {
          matchesContainer.appendChild(createMatchItem(match, i));
        });
      }
    }

    // Head-to-head
    var h2hContainer = document.getElementById('detail-h2h');
    if (h2hContainer) {
      h2hContainer.innerHTML = '';
      var h2h = stats.h2h;
      var h2hKeys = Object.keys(h2h);

      if (h2hKeys.length === 0) {
        h2hContainer.innerHTML = '<p class="text-muted">No head-to-head data yet.</p>';
      } else {
        h2hKeys.forEach(function(oppId) {
          var record = h2h[oppId];
          var item = document.createElement('div');
          item.className = 'h2h-item';
          item.innerHTML =
            '<span class="h2h-name">' + DV.getPlayerName(oppId) + '</span>' +
            '<span class="h2h-record">' + record.wins + 'W – ' + record.losses + 'L</span>';
          h2hContainer.appendChild(item);
        });
      }
    }

    // Show panel
    panel.classList.remove('hidden');
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Close button
    var closeBtn = document.getElementById('close-player-detail');
    if (closeBtn) {
      closeBtn.onclick = function() {
        panel.classList.add('hidden');
      };
    }
  }


  /* ---- Toast Notifications ---- */

  function showToast(message, type) {
    var container = document.getElementById('toast-container');
    if (!container) return;

    var toast = document.createElement('div');
    toast.className = 'toast toast-' + (type || 'info');
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(function() {
      toast.classList.add('toast-out');
      setTimeout(function() {
        toast.remove();
      }, 300);
    }, 3500);
  }


  /* ---- Utilities ---- */

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  // Public API
  return {
    init: init,
    showToast: showToast,
    navigateTo: navigateTo
  };

})();


/* ---- Boot ---- */
document.addEventListener('DOMContentLoaded', function() {
  DV.App.init();
});
