/* ==========================================
   RefEarn – script.js
   Real Backend API Integration
   API Base: http://localhost:5500/api
   ========================================== */

const API = 'http://localhost:5500/api';

// ===== STATE =====
let currentPage = 'dashboard';
let txFilter    = 'all';
let authToken   = localStorage.getItem('ref_token') || null;
let currentUser = JSON.parse(localStorage.getItem('ref_user') || 'null');

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  
  // ── Handle RupantorPay return ──────────────────────────────────────────
  const paymentStatus = urlParams.get('payment');
  const txId = urlParams.get('transaction_id');
  
  if (paymentStatus === 'success' && txId && authToken) {
    if (document.getElementById('loader')) document.getElementById('loader').classList.remove('hidden');
    try {
      const verifyRes = await apiFetch('/deposit/verify', {
        method: 'POST',
        body: JSON.stringify({ transaction_id: txId })
      });
      showToast(verifyRes.message || 'Payment verified! Balance added.', 'success');
    } catch (err) {
      if (!err.message.includes('already verified')) {
        showToast(err.message || 'Payment verification failed', 'error');
      }
    }
    window.history.replaceState({}, document.title, window.location.pathname);
    if (document.getElementById('loader')) document.getElementById('loader').classList.add('hidden');
  } else if (paymentStatus === 'cancel') {
    showToast('Payment was cancelled', 'error');
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // ── Normal Init ────────────────────────────────────────────────────────
  if (authToken && currentUser) {
    showApp();
    loadDashboardData();
  }
  
  // Pre-fill referral code from URL ?ref=XXXX
  const refCode = urlParams.get('ref');
  if (refCode) {
    const refInput = document.getElementById('signup-ref');
    if (refInput) refInput.value = refCode;
  }
});

// ===== HELPERS =====
const apiFetch = async (endpoint, options = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(`${API}${endpoint}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
};

const fmtMoney = (n) => '৳' + (n || 0).toLocaleString();
const fmtDate  = (ts) => {
  if (!ts) return '';
  const d = ts._seconds ? new Date(ts._seconds * 1000) : new Date(ts);
  return d.toLocaleDateString('en-GB');
};

// ===== AUTH TABS =====
function switchAuthTab(tab) {
  const loginForm  = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const tabLogin   = document.getElementById('tab-login');
  const tabSignup  = document.getElementById('tab-signup');
  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    tabLogin.classList.add('tab-active');
    tabLogin.classList.remove('text-gray-400');
    tabSignup.classList.remove('tab-active');
    tabSignup.classList.add('text-gray-400');
  } else {
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
    tabSignup.classList.add('tab-active');
    tabSignup.classList.remove('text-gray-400');
    tabLogin.classList.remove('tab-active');
    tabLogin.classList.add('text-gray-400');
  }
}

// ===== LOGIN =====
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const pwd   = document.getElementById('login-password').value;
  if (!email || !pwd) { showToast('Please fill all fields', 'error'); return; }
  showLoader();
  try {
    const res = await apiFetch('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: pwd }),
    });
    authToken   = res.data.idToken;
    currentUser = res.data;
    localStorage.setItem('ref_token', authToken);
    localStorage.setItem('ref_user', JSON.stringify(currentUser));
    hideLoader();
    showApp();
    await loadDashboardData();
    showToast(`Welcome back, ${currentUser.name}! 👋`, 'success');
  } catch (err) {
    hideLoader();
    showToast(err.message, 'error');
  }
}

// ===== SIGNUP =====
async function handleSignup(e) {
  e.preventDefault();
  const name    = document.getElementById('signup-name')?.value.trim();
  const email   = document.getElementById('signup-email').value.trim();
  const pwd     = document.getElementById('signup-password').value;
  const confirm = document.getElementById('signup-confirm').value;
  const refCode = document.getElementById('signup-ref')?.value.trim();

  if (pwd !== confirm) { showToast('Passwords do not match', 'error'); return; }
  showLoader();
  try {
    await apiFetch('/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password: pwd, referralCode: refCode || undefined }),
    });
    hideLoader();
    showToast('Account created! Please login. 🎉', 'success');
    switchAuthTab('login');
    document.getElementById('login-email').value = email;
  } catch (err) {
    hideLoader();
    showToast(err.message, 'error');
  }
}

// ===== NAVIGATION =====
function navigate(page) {
  currentPage = page;
  
  // Hide all pages
  document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
  
  // Show target page
  const target = document.getElementById(`page-${page}`);
  if (target) target.classList.remove('hidden');
  
  // Update titles
  const titles = {
    dashboard: ['Dashboard', 'Welcome back 👋'],
    plans: ['Plans', 'Upgrade your earnings'],
    refer: ['Refer & Earn', 'Grow your network'],
    wallet: ['Wallet', 'Manage your funds'],
    profile: ['Profile', 'Your account details'],
    deposit: ['Deposit', 'Add funds to wallet'],
    withdraw: ['Withdraw', 'Cash out your earnings'],
    spin: ['Spin to Earn', 'Try your luck! 🎡']
  };
  
  const [t, s] = titles[page] || ['App', ''];
  document.getElementById('page-title').textContent = t;
  document.getElementById('page-subtitle').textContent = s;

  // Update nav UI (Desktop + Mobile Bottom)
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active-nav'));
  document.querySelectorAll('.mob-nav-item').forEach(el => el.classList.remove('active-mob-nav'));
  
  const navBtn = document.getElementById(`nav-${page}`);
  const mobBtn = document.getElementById(`mob-nav-${page}`);
  if (navBtn) navBtn.classList.add('active-nav');
  if (mobBtn) mobBtn.classList.add('active-mob-nav');

  // Scroll to top
  window.scrollTo(0, 0);
}

// ===== SIDEBAR TOGGLE =====
function toggleSidebar() {
  const sidebar = document.getElementById('mobile-sidebar');
  const overlay = document.getElementById('mobile-sidebar-overlay');
  
  if (sidebar.classList.contains('open')) {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
    setTimeout(() => overlay.classList.add('hidden'), 300);
    document.body.classList.remove('drawer-open');
  } else {
    overlay.classList.remove('hidden');
    // Force reflow
    void overlay.offsetWidth;
    sidebar.classList.add('open');
    overlay.classList.add('show');
    document.body.classList.add('drawer-open');
  }
}

// ===== SHOW APP =====
function showApp() {
  document.getElementById('auth-section').classList.add('hidden');
  document.getElementById('app-section').classList.remove('hidden');
  navigate('dashboard');
}

// ===== LOGOUT =====
function handleLogout() {
  openModal('Confirm Logout', 'Are you sure you want to logout?', () => {
    authToken   = null;
    currentUser = null;
    localStorage.removeItem('ref_token');
    localStorage.removeItem('ref_user');
    document.getElementById('app-section').classList.add('hidden');
    document.getElementById('auth-section').classList.remove('hidden');
    showToast('Logged out successfully', 'info');
  });
}

// ===== LOAD DASHBOARD DATA =====
async function loadDashboardData() {
  try {
    const [walletRes, txRes, refRes] = await Promise.all([
      apiFetch('/wallet'),
      apiFetch('/transactions'),
      apiFetch('/user/referrals'),
    ]);

    const wallet = walletRes.data;
    const txList = txRes.data || [];
    const refData = refRes.data;

    // Update user data
    currentUser.balance      = wallet.balance;
    currentUser.totalEarnings = wallet.totalEarnings;
    currentUser.plan         = wallet.plan;
    currentUser.availableSpins = wallet.availableSpins || 0;
    localStorage.setItem('ref_user', JSON.stringify(currentUser));

    // Counters
    animateValue('balance-counter', 0, wallet.balance, 1500, '৳', true);
    animateValue('stat-earn',       0, wallet.totalEarnings, 1500, '৳', true);
    animateValue('stat-refs',       0, refData.totalReferrals || 0, 1000, '', false);
    
    // Spin Count Display
    const spinDisp = document.getElementById('spin-count-display');
    if (spinDisp) spinDisp.textContent = currentUser.availableSpins;

    // ── Refer page stats ─────────────────────────────────────────────────────
    const flatTree = [];
    const flatten = (nodes, lvl) => {
      nodes.forEach(n => {
        flatTree.push({ ...n, level: lvl });
        if (n.children?.length) flatten(n.children, lvl + 1);
      });
    };
    flatten(refData.tree || [], 1);
    const totalRefs  = flatTree.length;
    const activeRefs = flatTree.filter(r => r.plan > 0).length;

    animateValue('stat-active', 0, activeRefs, 1000, '', false);

    const refTotalEl    = document.getElementById('ref-total');
    const refActiveEl   = document.getElementById('ref-active');
    const refEarningsEl = document.getElementById('ref-earnings');
    if (refTotalEl)    refTotalEl.textContent    = totalRefs;
    if (refActiveEl)   refActiveEl.textContent   = activeRefs;
    if (refEarningsEl) refEarningsEl.textContent = fmtMoney(wallet.totalEarnings);

    // ── Update Level Progress UI ─────────────────────────────────────────────
    const starterCard = document.getElementById('starter-plan-card');
    const upgradeCard = document.getElementById('level-upgrade-card');
    
    if (starterCard && upgradeCard) {
      if (currentUser.plan === 0) {
        starterCard.style.display = 'block';
        upgradeCard.style.display = 'none';
      } else {
        starterCard.style.display = 'none';
        upgradeCard.style.display = 'block';
        
        const currentLevel = currentUser.level || 1;
        document.getElementById('lvl-badge').textContent = `Level ${currentLevel}`;
        
        const LEVELS = {
          1: { fee: 1500, maxRefs: 5 },
          2: { fee: 3000, maxRefs: 15 },
          3: { fee: 5000, maxRefs: 30 },
          4: { fee: 10000, maxRefs: 50 },
          5: { fee: 0, maxRefs: 999999 } // max level
        };
        
        const lvlData = LEVELS[currentLevel] || LEVELS[5];
        document.getElementById('current-refs-count').textContent = activeRefs;
        
        if (currentLevel >= 5) {
          document.getElementById('upgrade-title').textContent = 'MAX LEVEL REACHED';
          document.getElementById('max-refs-count').textContent = '∞';
          document.getElementById('refs-progress-bar').style.width = '100%';
          document.getElementById('upgrade-status-badge').textContent = 'All Targets Cleared';
          document.getElementById('upgrade-status-badge').className = 'text-xs bg-green-900/60 text-green-300 px-3 py-1 rounded-full';
          document.getElementById('upgrade-fee-section').classList.add('hidden');
          document.getElementById('btn-upgrade-level').classList.add('hidden');
          document.getElementById('upgrade-warning-text').classList.add('hidden');
          document.getElementById('upgrade-benefits').classList.add('hidden');
        } else {
          document.getElementById('upgrade-title').textContent = `Reach Level ${currentLevel + 1}`;
          document.getElementById('upgrade-fee').textContent = `৳${lvlData.fee.toLocaleString()}`;
          document.getElementById('upgrade-desc').textContent = `Fee to unlock Level ${currentLevel + 1}`;
          document.getElementById('max-refs-count').textContent = lvlData.maxRefs;
          
          let pct = Math.min((activeRefs / lvlData.maxRefs) * 100, 100);
          document.getElementById('refs-progress-bar').style.width = `${pct}%`;
          
          const warningEl = document.getElementById('upgrade-warning-text');
          const maxedOut = activeRefs >= lvlData.maxRefs;
          
          if (maxedOut) {
            warningEl.classList.remove('hidden');
            document.getElementById('upgrade-status-badge').textContent = 'Target Reached';
            document.getElementById('upgrade-status-badge').className = 'text-xs bg-green-900/60 text-green-300 px-3 py-1 rounded-full';
            document.getElementById('upgrade-fee-section').classList.remove('hidden');
            document.getElementById('btn-upgrade-level').classList.remove('hidden');
            document.getElementById('upgrade-benefits').classList.add('hidden');
          } else {
            warningEl.classList.add('hidden');
            document.getElementById('upgrade-status-badge').textContent = 'In Progress';
            document.getElementById('upgrade-status-badge').className = 'text-xs bg-blue-900/60 text-blue-300 px-3 py-1 rounded-full';
            document.getElementById('upgrade-fee-section').classList.add('hidden');
            document.getElementById('btn-upgrade-level').classList.add('hidden');
            document.getElementById('upgrade-benefits').classList.remove('hidden');
            
            // Render specific benefits
            const bList = document.getElementById('benefits-list');
            if (currentLevel === 1 && bList) {
              bList.innerHTML = `
                <li class="flex items-center gap-2"><span class="text-blue-400">✓</span> Unlock Lifetime Withdrawals</li>
                <li class="flex items-center gap-2"><span class="text-blue-400">✓</span> Unlock Level 2 Target (15 Refs)</li>`;
            } else if (bList) {
              bList.innerHTML = `
                <li class="flex items-center gap-2"><span class="text-blue-400">✓</span> Unlock Level ${currentLevel+1} Targets</li>
                <li class="flex items-center gap-2"><span class="text-blue-400">✓</span> Keep Earnings Active</li>`;
            }
          }
        }
      }
    }

    // ── Load Referrer Profile ────────────────────────────────────────────────
    const referrerBox = document.getElementById('referrer-details');
    const dashRefInfo = document.getElementById('dashboard-referrer-info');
    
    if (currentUser.referredBy) {
      try {
        const refProfileRes = await apiFetch(`/user/referrer/${currentUser.referredBy}`);
        const p = refProfileRes.data;
        if (referrerBox) {
          referrerBox.innerHTML = `
            <div class="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-green-400 flex items-center justify-center text-xl font-bold flex-shrink-0 text-white">${p.name.charAt(0)}</div>
            <div>
              <p class="font-bold text-white">${p.name}</p>
              <p class="text-xs text-gray-400">ID: ${p.referralCode} · Joined: ${fmtDate(p.createdAt)}</p>
            </div>
          `;
        }
        if (dashRefInfo) {
          dashRefInfo.innerHTML = `Referred by <span class="text-purple-400 font-semibold">${p.name}</span> (ID: ${p.referralCode})`;
        }
      } catch (e) {
        if (referrerBox) referrerBox.innerHTML = `<p class="text-gray-400 text-sm">Referrer info not available.</p>`;
        if (dashRefInfo) dashRefInfo.textContent = `Keep growing your referral network`;
      }
    } else {
      if (referrerBox) referrerBox.innerHTML = `<p class="text-gray-400 text-sm">You joined directly without a referral code.</p>`;
      if (dashRefInfo) dashRefInfo.textContent = `Joined directly without referral`;
    }

    // ── Unlock/Lock Referrals & Withdrawals ──────────────────────────────────
    if (currentUser.plan > 0) {
      document.getElementById('no-plan-alert')?.classList.add('hidden');
      document.getElementById('referral-content')?.classList.remove('hidden');
    } else {
      document.getElementById('no-plan-alert')?.classList.remove('hidden');
      document.getElementById('referral-content')?.classList.add('hidden');
    }

    if ((currentUser.level || 0) < 2) {
      document.getElementById('withdraw-locked-alert')?.classList.remove('hidden');
      document.getElementById('withdraw-form-container')?.classList.add('hidden');
    } else {
      document.getElementById('withdraw-locked-alert')?.classList.add('hidden');
      document.getElementById('withdraw-form-container')?.classList.remove('hidden');
    }

    // Update profile header & form
    // Safe-populating inputs without losing user cursor if they are typing
    const profNameEl = document.getElementById('prof-name');
    const profEmailEl = document.getElementById('prof-email');
    if (profNameEl && !profNameEl.value) profNameEl.value = currentUser.name;
    if (profEmailEl && !profEmailEl.value) profEmailEl.value = currentUser.email;
    const statEarnProf = document.getElementById('stat-earn-profile');
    if (statEarnProf) statEarnProf.textContent = fmtMoney(wallet.totalEarnings);

    document.querySelectorAll('.user-name').forEach(el => el.textContent = currentUser.name);
    document.querySelectorAll('.user-email').forEach(el => el.textContent = currentUser.email);
    document.querySelectorAll('.user-plan').forEach(el => el.textContent = currentUser.plan > 0 ? `Level ${currentUser.level || 1} Active` : 'No Plan');
    document.querySelectorAll('.user-ref-code').forEach(el => el.textContent = currentUser.referralCode);
    document.querySelectorAll('.user-balance').forEach(el => el.textContent = fmtMoney(wallet.balance));

    // Referral link
    const refLinkEl = document.getElementById('ref-link');
    if (refLinkEl) refLinkEl.value = `${window.location.origin}${window.location.pathname}?ref=${currentUser.referralCode}`;

    // Activity List (last 5 transactions)
    renderActivityList(txList.slice(0, 5));
    renderTransactions(txList);
    renderReferrals(refData.tree || []);

  } catch (err) {
    console.error('[loadDashboardData]', err);
    if (err.message.includes('blocked')) {
      handleLogout();
      showToast('Your account has been blocked.', 'error');
    }
  }
}

// ===== NAVIGATION =====
function navigate(page) {
  document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active-nav'));
  const activeNav = document.getElementById('nav-' + page);
  if (activeNav) activeNav.classList.add('active-nav');

  document.querySelectorAll('.mob-nav-item').forEach(n => n.classList.remove('active-mob-nav'));
  const mobileMap = { deposit: 'wallet', withdraw: 'wallet' };
  const mobKey    = mobileMap[page] || page;
  const activeMob = document.getElementById('mob-' + mobKey);
  if (activeMob) activeMob.classList.add('active-mob-nav');

  const titles = {
    dashboard: ['NextGen Earn', 'Welcome back 👋'],
    plans:     ['Plans',     'Choose your investment plan'],
    refer:     ['Refer',     'Grow your network'],
    wallet:    ['Wallet',    'Manage your funds'],
    deposit:   ['Deposit',   'Add funds to your wallet'],
    withdraw:  ['Withdraw',  'Withdraw your earnings'],
    profile:   ['Profile',   'Account settings'],
  };
  const t = titles[page] || ['Dashboard', ''];
  document.getElementById('page-title').textContent    = t[0];
  document.getElementById('page-subtitle').textContent = t[1];
  currentPage = page;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Load page-specific data
  if (page === 'wallet')   loadWalletPage();
  if (page === 'deposit')  loadDepositHistory();
  if (page === 'withdraw') loadWithdrawHistory();
}

// ===== WALLET PAGE =====
async function loadWalletPage() {
  try {
    const [walletRes, txRes] = await Promise.all([
      apiFetch('/wallet'),
      apiFetch('/transactions'),
    ]);
    document.querySelectorAll('.user-balance').forEach(el => el.textContent = fmtMoney(walletRes.data.balance));
    renderTransactions(txRes.data || []);
  } catch (err) { console.error(err); }
}

// ===== RENDER ACTIVITY LIST =====
function renderActivityList(txList) {
  const el = document.getElementById('activity-list');
  if (!el) return;
  if (!txList.length) { el.innerHTML = '<p class="text-center text-gray-500 text-sm py-4">No recent activity.</p>'; return; }
  el.innerHTML = txList.map(tx => {
    const positive = tx.amount > 0;
    const icon  = tx.type === 'commission' ? '💰' : tx.type === 'deposit' ? '📥' : tx.type === 'plan_purchase' ? '🛒' : '📤';
    const color = positive ? 'text-green-400' : 'text-red-400';
    const statusColor = tx.status === 'approved' ? 'text-green-500' : tx.status === 'rejected' ? 'text-red-500' : 'text-yellow-500';
    const desc  = tx.type === 'commission' ? `Level ${tx.meta?.level || ''} Commission` : tx.type === 'deposit' ? `${tx.meta?.method || 'Deposit'} Deposit` : tx.type === 'plan_purchase' ? `Bought ${tx.meta?.plan || ''} Plan` : `Withdrawal`;
    return `
      <div class="activity-item">
        <div class="w-9 h-9 rounded-xl bg-gray-700/60 flex items-center justify-center text-base flex-shrink-0">${icon}</div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate">${desc}</p>
          <p class="text-xs text-gray-500">${fmtDate(tx.createdAt)} · <span class="${statusColor}">${tx.status}</span></p>
        </div>
        <p class="text-sm font-bold ${color} flex-shrink-0">${positive ? '+' : '-'}${fmtMoney(Math.abs(tx.amount))}</p>
      </div>`;
  }).join('');
}

// ===== UPGRADE LEVEL =====
async function upgradeLevel() {
  const btn = document.getElementById('btn-upgrade-level');
  if (!btn) return;
  const originalHtml = btn.innerHTML;
  btn.innerHTML = '<span class="animate-spin inline-block mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>Processing...';
  btn.disabled = true;

  try {
    const res = await apiFetch('/plan/upgrade', { method: 'POST' });
    if (res && res.success) {
      showToast(res.message, 'success');
      currentUser.level = res.data.level;
      localStorage.setItem('ref_user', JSON.stringify(currentUser));
      await loadDashboardData();
    }
  } catch (err) {
    showToast(err.message || 'Upgrade failed', 'error');
  } finally {
    btn.innerHTML = originalHtml;
    btn.disabled = false;
  }
}

// ===== RENDER TRANSACTIONS =====
function renderTransactions(txList) {
  const el = document.getElementById('tx-list');
  if (!el) return;
  const filtered = txFilter === 'all' ? txList : txList.filter(t => t.type === txFilter);
  const badge = {
    approved: 'bg-green-900/50 text-green-400 border-green-700/30',
    pending:  'bg-yellow-900/50 text-yellow-400 border-yellow-700/30',
    rejected: 'bg-red-900/50 text-red-400 border-red-700/30',
  };
  el.innerHTML = filtered.map(tx => {
    const positive = tx.amount > 0;
    const icon  = tx.type === 'commission' ? '💰' : tx.type === 'deposit' ? '📥' : tx.type === 'plan_purchase' ? '🛒' : '📤';
    const color = positive ? 'text-green-400' : 'text-red-400';
    const desc  = tx.type === 'commission' ? `Level ${tx.meta?.level || ''} Commission` : tx.type === 'deposit' ? `Deposit via ${tx.meta?.method || ''}` : tx.type === 'plan_purchase' ? `Bought ${tx.meta?.plan || ''} Plan` : `Withdrawal via ${tx.meta?.method || ''}`;
    return `
      <div class="tx-item">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <div class="w-10 h-10 rounded-xl bg-gray-700/60 flex items-center justify-center text-lg flex-shrink-0">${icon}</div>
          <div class="min-w-0">
            <p class="text-sm font-medium truncate">${desc}</p>
            <p class="text-xs text-gray-500 mt-0.5">${fmtDate(tx.createdAt)}</p>
          </div>
        </div>
        <div class="text-right flex-shrink-0 ml-3">
          <p class="text-sm font-bold ${color}">${positive ? '+' : '-'}${fmtMoney(Math.abs(tx.amount))}</p>
          <span class="text-xs border px-2 py-0.5 rounded-full mt-1 inline-block ${badge[tx.status] || badge.pending}">${tx.status}</span>
        </div>
      </div>`;
  }).join('') || '<p class="text-center text-gray-500 text-sm py-4">No transactions found.</p>';

  // Save for filter use
  window._txListCache = txList;
}

function filterTx(type) {
  txFilter = type;
  ['all','deposit','withdraw','commission'].forEach(t => {
    const btn = document.getElementById('filter-' + t);
    if (!btn) return;
    if (t === type) { btn.classList.add('tab-active'); btn.classList.remove('text-gray-400'); }
    else            { btn.classList.remove('tab-active'); btn.classList.add('text-gray-400'); }
  });
  renderTransactions(window._txListCache || []);
}

// ===== RENDER REFERRALS =====
function renderReferrals(tree, container = 'referral-list', level = 1) {
  const el = document.getElementById(container);
  if (!el || !tree.length) {
    if (el) el.innerHTML = '<p class="text-center text-gray-500 text-sm py-4">No referrals yet.</p>';
    return;
  }
  const levelColor = ['text-purple-400','text-blue-400','text-green-400','text-yellow-400','text-pink-400'];
  const statusCls  = 'bg-green-900/50 text-green-400 border-green-700/30';
  // Flatten tree into a list
  const flatList = [];
  const flatten = (nodes, lvl) => {
    nodes.forEach(n => {
      flatList.push({ ...n, level: lvl });
      if (n.children?.length) flatten(n.children, lvl + 1);
    });
  };
  flatten(tree, 1);
  el.innerHTML = flatList.map(r => `
    <div class="ref-item">
      <div class="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center text-sm font-bold flex-shrink-0">
        ${r.name?.charAt(0) || '?'}
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium truncate">${r.name}</p>
        <p class="text-xs text-gray-500">${fmtDate(r.createdAt)}</p>
      </div>
      <div class="text-right flex-shrink-0 flex flex-col items-end gap-1">
        <span class="text-xs font-semibold ${levelColor[r.level-1] || 'text-gray-400'}">Lvl ${r.level}</span>
        <span class="text-xs border px-2 py-0.5 rounded-full ${statusCls}">${r.plan > 0 ? 'active' : 'inactive'}</span>
      </div>
    </div>`).join('');
}

// ===== RENDER LEVEL BREAKDOWN =====
function renderLevelBreakdown(tree) {
  const el = document.getElementById('level-breakdown');
  if (!el) return;
  const colors = ['bg-purple-500','bg-blue-500','bg-green-500','bg-yellow-500','bg-pink-500'];
  // Count refs per level
  const counts = [0,0,0,0,0];
  const flatten = (nodes, lvl) => {
    if (lvl > 5) return;
    nodes.forEach(n => {
      counts[lvl-1]++;
      if (n.children?.length) flatten(n.children, lvl+1);
    });
  };
  flatten(tree, 1);
  const maxCount = Math.max(...counts, 1);
  el.innerHTML = counts.map((count, i) => `
    <div>
      <div class="flex justify-between text-sm mb-1">
        <span class="text-gray-300">Level ${i+1} <span class="text-gray-500 ml-1">(${count} refs)</span></span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill ${colors[i]}" style="width:${Math.round((count/maxCount)*100)}%"></div>
      </div>
    </div>`).join('');
}

// ===== ANIMATED COUNTERS =====
function animateValue(id, start, end, duration, prefix, comma) {
  const el = document.getElementById(id);
  if (!el) return;
  const range = end - start;
  const startTime = performance.now();
  function step(now) {
    const elapsed  = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased    = 1 - Math.pow(1 - progress, 3);
    const val      = Math.round(start + range * eased);
    el.textContent = prefix + (comma ? val.toLocaleString() : val);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ===== COPY REFERRAL LINK =====
function copyRef() {
  const link = document.getElementById('ref-link')?.value;
  if (!link) return;
  navigator.clipboard.writeText(link)
    .then(() => showToast('Referral link copied! 🔗', 'success'))
    .catch(() => {
      const ta = document.createElement('textarea');
      ta.value = link;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('Referral link copied! 🔗', 'success');
    });
}

// ===== PLANS =====
async function buyPlan(amount) {
  if (!currentUser) return;

  showLoader();
  // Always fetch fresh balance from server (localStorage can be stale)
  try {
    const walletRes = await apiFetch('/wallet');
    currentUser.balance = walletRes.data.balance;
    currentUser.plan    = walletRes.data.plan;
    localStorage.setItem('ref_user', JSON.stringify(currentUser));
    document.querySelectorAll('.user-balance').forEach(el => el.textContent = fmtMoney(currentUser.balance));
  } catch (err) {
    hideLoader();
    showToast('Could not fetch wallet. Try again.', 'error');
    return;
  }
  hideLoader();

  // Prevent re-buy same plan
  if (currentUser.plan === amount) {
    showToast(`You already have the ${amount} plan active!`, 'info');
    return;
  }

  const balance = currentUser.balance || 0;
  const planName = amount === 1000 ? 'Starter (৳1,000)' : 'Premium (৳2,000)';

  // Insufficient balance → redirect to deposit
  if (balance < amount) {
    const shortfall = amount - balance;
    openModal(
      '💳 Insufficient Balance',
      `You need ৳${amount.toLocaleString()} but your balance is ৳${balance.toLocaleString()}. Please deposit ৳${shortfall.toLocaleString()} first.`,
      () => navigate('deposit')
    );
    document.getElementById('modal-confirm').textContent = 'Go to Deposit →';
    return;
  }

  // Confirm modal
  openModal(
    `Buy ${planName} Plan`,
    `৳${amount.toLocaleString()} will be deducted from your balance (৳${balance.toLocaleString()}). Confirm?`,
    async () => {
      showLoader();
      try {
        await apiFetch('/plan/buy', { method: 'POST', body: JSON.stringify({ plan: amount }) });
        hideLoader();
        currentUser.plan    = amount;
        currentUser.balance = balance - amount;
        localStorage.setItem('ref_user', JSON.stringify(currentUser));
        document.querySelectorAll('.user-plan').forEach(el => el.textContent = `${amount} Plan`);
        document.querySelectorAll('.user-balance').forEach(el => el.textContent = fmtMoney(currentUser.balance));
        showToast(`🎉 ${planName} activated! ৳${amount.toLocaleString()} deducted.`, 'success');
        await loadDashboardData();
      } catch (err) {
        hideLoader();
        if (err.message?.includes('Insufficient') || err.message?.includes('balance')) {
          showToast('Not enough balance! Please deposit first.', 'error');
          setTimeout(() => navigate('deposit'), 2000);
        } else {
          showToast(err.message, 'error');
        }
      }
    }
  );
}



// ===== DEPOSIT =====
async function handleDeposit(e) {
  e.preventDefault();
  const amount = document.getElementById('dep-amount').value;
  if (!amount) { showToast('Please enter an amount', 'error'); return; }
  if (parseInt(amount) < 100) { showToast('Minimum deposit is ৳100', 'error'); return; }
  showLoader();
  try {
    const res = await apiFetch('/deposit/checkout', {
      method: 'POST',
      body: JSON.stringify({ amount: parseFloat(amount) }),
    });
    
    if (res.payment_url) {
      window.location.href = res.payment_url;
    } else {
      throw new Error('Failed to generate payment link');
    }
  } catch (err) {
    hideLoader();
    showToast(err.message, 'error');
  }
}

// ===== DEPOSIT HISTORY =====
async function loadDepositHistory() {
  const el = document.getElementById('deposit-history');
  if (!el) return;
  try {
    const res = await apiFetch('/deposit/history');
    const list = res.data || [];
    if (!list.length) { el.innerHTML = '<p class="text-center text-gray-500 text-sm py-4">No deposit history.</p>'; return; }
    const badge = { approved:'bg-green-900/50 text-green-400 border-green-700/30', pending:'bg-yellow-900/50 text-yellow-400 border-yellow-700/30', rejected:'bg-red-900/50 text-red-400 border-red-700/30' };
    el.innerHTML = list.map(d => `
      <div class="tx-item">
        <div class="flex items-center gap-3 flex-1">
          <div class="w-10 h-10 rounded-xl bg-gray-700/60 flex items-center justify-center text-lg">📥</div>
          <div>
            <p class="text-sm font-medium">${d.method?.toUpperCase()} Deposit</p>
            <p class="text-xs text-gray-500">${fmtDate(d.createdAt)} · ID: ${d.transactionId}</p>
          </div>
        </div>
        <div class="text-right">
          <p class="text-sm font-bold text-green-400">+${fmtMoney(d.amount)}</p>
          <span class="text-xs border px-2 py-0.5 rounded-full ${badge[d.status] || badge.pending}">${d.status}</span>
        </div>
      </div>`).join('');
  } catch (err) { console.error(err); }
}

// ===== WITHDRAW =====
async function handleWithdraw(e) {
  e.preventDefault();
  const amount  = document.getElementById('wd-amount').value;
  const method  = document.getElementById('wd-method').value;
  const account = document.getElementById('wd-account').value.trim();
  if (!amount || !account) { showToast('Please fill all fields', 'error'); return; }
  if (parseInt(amount) < 100) { showToast('Minimum withdrawal is ৳100', 'error'); return; }
  openModal('Confirm Withdrawal', `Withdraw ${fmtMoney(parseInt(amount))} to ${account} via ${method}?`, async () => {
    showLoader();
    try {
      await apiFetch('/withdraw', {
        method: 'POST',
        body: JSON.stringify({ method, accountNumber: account, amount: parseFloat(amount) }),
      });
      hideLoader();
      showToast('Withdrawal request submitted! 📤', 'success');
      e.target.reset();
      loadWithdrawHistory();
      await loadDashboardData();
    } catch (err) {
      hideLoader();
      showToast(err.message, 'error');
    }
  });
}

// ===== WITHDRAW HISTORY =====
async function loadWithdrawHistory() {
  const el = document.getElementById('withdraw-history');
  if (!el) return;
  try {
    const res = await apiFetch('/withdraw/history');
    const list = res.data || [];
    if (!list.length) { el.innerHTML = '<p class="text-center text-gray-500 text-sm py-4">No withdrawal history.</p>'; return; }
    const badge = { approved:'bg-green-900/50 text-green-400 border-green-700/30', pending:'bg-yellow-900/50 text-yellow-400 border-yellow-700/30', rejected:'bg-red-900/50 text-red-400 border-red-700/30' };
    el.innerHTML = list.map(w => `
      <div class="tx-item">
        <div class="flex items-center gap-3 flex-1">
          <div class="w-10 h-10 rounded-xl bg-gray-700/60 flex items-center justify-center text-lg">📤</div>
          <div>
            <p class="text-sm font-medium">${w.method?.toUpperCase()} Withdrawal</p>
            <p class="text-xs text-gray-500">${fmtDate(w.createdAt)} · ${w.accountNumber}</p>
          </div>
        </div>
        <div class="text-right">
          <p class="text-sm font-bold text-red-400">-${fmtMoney(w.amount)}</p>
          <span class="text-xs border px-2 py-0.5 rounded-full ${badge[w.status] || badge.pending}">${w.status}</span>
        </div>
      </div>`).join('');
  } catch (err) { console.error(err); }
}

// ===== UPDATE PROFILE =====
async function handleUpdateProfile(e) {
  e.preventDefault();
  const name = document.getElementById('prof-name').value;
  const email = document.getElementById('prof-email').value;
  const btn = document.getElementById('btn-update-prof');
  const orgBtn = btn.innerHTML;
  btn.innerHTML = '<span class="animate-spin inline-block mr-2 w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>Saving...';
  btn.disabled = true;

  try {
    const res = await apiFetch('/user/profile', {
      method: 'PUT',
      body: JSON.stringify({ name, email })
    });
    showToast(res.message, 'success');
    currentUser.name = name;
    currentUser.email = email;
    localStorage.setItem('ref_user', JSON.stringify(currentUser));
    document.querySelectorAll('.user-name').forEach(el => el.textContent = name);
    document.querySelectorAll('.user-email').forEach(el => el.textContent = email);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.innerHTML = orgBtn;
    btn.disabled = false;
  }
}

// ===== PASSWORD CHANGE =====
async function handleChangePassword(e) {
  e.preventDefault();
  const pwd = document.getElementById('new-pwd').value;
  if (!pwd || pwd.length < 6) return showToast('Password must be at least 6 characters', 'error');
  
  const btn = document.getElementById('btn-update-pwd');
  const orgBtn = btn.innerHTML;
  btn.innerHTML = '<span class="animate-spin inline-block mr-2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></span>Updating...';
  btn.disabled = true;

  try {
    const res = await apiFetch('/user/profile', {
      method: 'PUT',
      body: JSON.stringify({ password: pwd })
    });
    showToast('Password changed successfully!', 'success');
    document.getElementById('new-pwd').value = '';
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.innerHTML = orgBtn;
    btn.disabled = false;
  }
}

// ===== PASSWORD TOGGLE =====
function togglePwd(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

// ===== TOAST =====
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const icons  = { success: '✓', error: '✕', info: 'ℹ' };
  toast.className = `fixed top-5 right-5 z-[9999] max-w-xs w-full toast-${type}`;
  toast.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
  toast.classList.remove('hidden');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.4s';
    setTimeout(() => {
      toast.classList.add('hidden');
      toast.style.opacity = '';
      toast.style.transition = '';
    }, 400);
  }, 3500);
}

// ===== LOADER =====
function showLoader() { document.getElementById('loader')?.classList.remove('hidden'); }
function hideLoader() { document.getElementById('loader')?.classList.add('hidden'); }

// ===== MODAL =====
let _modalCallback = null;
function openModal(title, body, onConfirm) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').textContent  = body;
  document.getElementById('modal').classList.remove('hidden');
  document.getElementById('modal').style.display = 'flex';
  _modalCallback = onConfirm;
  document.getElementById('modal-confirm').onclick = () => { 
    if (_modalCallback) _modalCallback(); 
    closeModal(); 
  };
}
function closeModal() {
  const modal = document.getElementById('modal');
  modal.classList.add('hidden');
  modal.style.display = 'none';
  _modalCallback = null;
}
document.getElementById('modal')?.addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// ===== SPIN TO EARN =====
let isSpinning = false;
async function handleSpin() {
  if (isSpinning) return;
  
  const spinCount = currentUser.availableSpins || 0;
  if (spinCount < 1) {
    showToast('You have 0 spins! Refer active members to earn spins.', 'error');
    return;
  }

  const btn = document.getElementById('spin-btn');
  const wheel = document.getElementById('wheel');
  
  try {
    isSpinning = true;
    btn.disabled = true;
    btn.classList.add('opacity-50');
    
    const res = await apiFetch('/spin', { method: 'POST' });
    const { reward, prizeIndex, spinsLeft, newBalance } = res.data;

    // Calculate rotation
    // 10 segments total (index 0-9). Each is 36 deg.
    // Prize indices match segments i & i+5. Let's use i.
    const extraDegrees = (5 + Math.floor(Math.random() * 5)) * 360;
    const prizeAngle = 360 - (prizeIndex * 36) - 18;
    const totalRotation = extraDegrees + prizeAngle;

    // Apply rotation
    wheel.style.transition = 'transform 4s cubic-bezier(0.15, 0, 0.15, 1)';
    wheel.style.transform = `rotate(${totalRotation}deg)`;

    // Wait for animation
    setTimeout(async () => {
      showToast(`Congratulations! You won ৳${reward} 🎉`, 'success');
      
      // Update local state
      currentUser.availableSpins = spinsLeft;
      currentUser.balance = newBalance;
      localStorage.setItem('ref_user', JSON.stringify(currentUser));
      
      // Update UI
      const spinDisp = document.getElementById('spin-count-display');
      if (spinDisp) spinDisp.textContent = spinsLeft;
      
      const balanceEls = document.querySelectorAll('.user-balance');
      balanceEls.forEach(el => el.textContent = fmtMoney(newBalance));
      
      const balanceCounter = document.getElementById('balance-counter');
      if (balanceCounter) balanceCounter.textContent = fmtMoney(newBalance);

      // Reset for next spin
      isSpinning = false;
      btn.disabled = false;
      btn.classList.remove('opacity-50');

    }, 4000);

  } catch (err) {
    isSpinning = false;
    btn.disabled = false;
    btn.classList.remove('opacity-50');
    showToast(err.message || 'Spin failed', 'error');
  }
}

