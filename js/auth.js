/* ============================================
   DV PICKLEBALL — Authentication
   Email/password auth via Firebase
   ============================================ */

window.DV = window.DV || {};

DV.Auth = (function() {

  var currentUser = null;
  var authListeners = [];

  /**
   * Initialize auth state listener
   */
  function init() {
    DV.auth.onAuthStateChanged(function(user) {
      currentUser = user;
      notifyListeners(user);
      updateUI(user);
    });
  }

  /**
   * Sign in with email & password
   */
  function signIn(email, password) {
    return DV.auth.signInWithEmailAndPassword(email, password);
  }

  /**
   * Sign out
   */
  function signOut() {
    return DV.auth.signOut();
  }

  /**
   * Check if a user is currently logged in
   */
  function isLoggedIn() {
    return currentUser !== null;
  }

  /**
   * Get current user
   */
  function getUser() {
    return currentUser;
  }

  /**
   * Register a callback for auth state changes
   */
  function onAuthChange(callback) {
    authListeners.push(callback);
  }

  function notifyListeners(user) {
    authListeners.forEach(function(cb) {
      try { cb(user); } catch(e) { console.error('Auth listener error:', e); }
    });
  }

  /**
   * Update UI elements based on auth state
   */
  function updateUI(user) {
    var loginBtn = document.getElementById('login-btn');
    var userMenu = document.getElementById('user-menu');
    var userEmail = document.getElementById('user-email');
    var authOnlyEls = document.querySelectorAll('.auth-only');

    if (user) {
      // Logged in
      if (loginBtn) loginBtn.classList.add('hidden');
      if (userMenu) userMenu.classList.remove('hidden');
      if (userEmail) userEmail.textContent = user.email;

      authOnlyEls.forEach(function(el) {
        el.classList.remove('hidden');
      });
    } else {
      // Logged out
      if (loginBtn) loginBtn.classList.remove('hidden');
      if (userMenu) userMenu.classList.add('hidden');
      if (userEmail) userEmail.textContent = '';

      authOnlyEls.forEach(function(el) {
        el.classList.add('hidden');
      });
    }
  }

  // Public API
  return {
    init: init,
    signIn: signIn,
    signOut: signOut,
    isLoggedIn: isLoggedIn,
    getUser: getUser,
    onAuthChange: onAuthChange
  };

})();
