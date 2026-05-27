/* ============================================
   DV PICKLEBALL — Firebase Configuration
   ============================================ */

window.DV = window.DV || {};

// ============================================================
// ⚠️  REPLACE THIS CONFIG WITH YOUR FIREBASE PROJECT CONFIG
//     Go to Firebase Console > Project Settings > Your Apps
//     Copy the firebaseConfig object and paste it below.
// ============================================================
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Export references
DV.auth = firebase.auth();
DV.db = firebase.firestore();

// Enable offline persistence (matches load even with no internet)
DV.db.enablePersistence({ synchronizeTabs: true }).catch(function(err) {
  if (err.code === 'failed-precondition') {
    console.warn('Firestore persistence unavailable (multiple tabs open)');
  } else if (err.code === 'unimplemented') {
    console.warn('Firestore persistence not supported in this browser');
  }
});

// Player roster (source of truth for names)
DV.PLAYERS = [
  { id: 'avi',     name: 'Avi' },
  { id: 'tien',    name: 'Tien' },
  { id: 'hanchae', name: 'Hanchae' },
  { id: 'steven',  name: 'Steven' },
  { id: 'jason',   name: 'Jason' },
  { id: 'kris',    name: 'Kris' },
  { id: 'murat',   name: 'Murat' },
  { id: 'joey',    name: 'Joey' },
  { id: 'eric',    name: 'Eric' },
  { id: 'grant',   name: 'Grant' }
];

// Quick lookup by ID
DV.PLAYER_MAP = {};
DV.PLAYERS.forEach(function(p) {
  DV.PLAYER_MAP[p.id] = p;
});

// Avatar color palette (consistent per player)
DV.AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6'
];

DV.getAvatarColor = function(playerId) {
  var idx = DV.PLAYERS.findIndex(function(p) { return p.id === playerId; });
  return DV.AVATAR_COLORS[idx >= 0 ? idx : 0];
};

DV.getInitials = function(name) {
  return name.charAt(0).toUpperCase();
};

DV.getPlayerName = function(playerId) {
  var p = DV.PLAYER_MAP[playerId];
  return p ? p.name : playerId;
};

// Default ELO
DV.DEFAULT_ELO = 1200;

console.log('🏓 DV Pickleball — Firebase initialized');
