// Token Radar, model radar-2. Reads window.RADAR (written beside dashboard/ by main.ts)
// and renders the ranked board, a filterable table, a per-protocol detail drawer with the
// model's own inputs and the protocol's farm plan. No network: every byte it shows is in data.js.
//
// The pure functions below (impliedOf, farmSteps and their helpers) are the same derivation
// main.ts writes to board.json: category, chains, TVL and age decide the action, the capital,
// the hold and every cost and time. No name is special-cased. The page recomputes each row
// from the snapshot figures and checks the number board.json carries, so the page's code and
// the board's data are visibly the same arithmetic.
'use strict';

var DATA = window.RADAR || null;

// ---- pure model: identical to main.ts, line for line in the templates ----

function impliedOf(row, model) {
  var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
  var growthMult = 1 + (growth / 100) * model.growth_weight;
  var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
  var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  var breadth = 1 + model.breadth_step * Math.min(Math.max((row.chains || []).length - 1, 0), model.breadth_cap);
  return Math.max(1, Math.round(row.tvl_usd * model.base_multiple * growthMult * maturity * breadth));
}

function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
function capitalFor(p) {
  if (p.tvl_usd >= 5e9) return 300;
  if (p.tvl_usd >= 1e9) return 200;
  if (p.tvl_usd >= 250e6) return 120;
  if (p.tvl_usd >= 1e8) return 80;
  return 40;
}
function holdDaysFor(age) {
  if (age === null || age === undefined) return 60;
  if (age < 180) return 90;
  if (age < 365) return 60;
  if (age < 730) return 45;
  return 30;
}
function gasPerTx(chain) { return chain === 'Ethereum' ? 9 : 2; }

function actionFor(p, capital, chain) {
  var c = (p.category || '').toLowerCase();
  var name = p.name;
  if (c.indexOf('liquid staking') >= 0 || c.indexOf('liquid restaking') >= 0 || c.indexOf('restaking') >= 0 || c.indexOf('staking') >= 0)
    return 'Stake $' + capital + " of the chain's staking asset through " + name + ' on ' + chain + ' and keep the receipt token.';
  if (c.indexOf('lend') >= 0 || c.indexOf('collateral') >= 0)
    return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the loan position open.';
  if (c.indexOf('cdp') >= 0)
    return 'Open a vault on ' + name + ' with $' + capital + ' of collateral on ' + chain + ' and mint a small amount against it.';
  if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0)
    return 'Provide $' + capital + " of liquidity to " + name + "'s main pool on " + chain + ' and keep the position open.';
  if (c.indexOf('bridge') >= 0)
    return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and put the bridged funds to work in its app.';
  if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('options') >= 0 || c.indexOf('basis trading') >= 0)
    return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge on ' + chain + '.';
  if (c.indexOf('prediction') >= 0)
    return 'Fund $' + capital + ' and place one market position on ' + name + ' on ' + chain + '.';
  if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('risk') >= 0)
    return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the vault shares.';
  if (c.indexOf('stable') >= 0)
    return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + ' and hold it.';
  if (c.indexOf('rwa') >= 0)
    return 'Mint $' + capital + " of the protocol's yield-bearing asset on " + chain + ' and hold it.';
  if (c.indexOf('insurance') >= 0)
    return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy active.';
  if (c.indexOf('farm') >= 0)
    return 'Deposit $' + capital + ' of USDC into the ' + name + ' farm on ' + chain + ' and let the rewards accrue.';
  if (c.indexOf('payment') >= 0)
    return 'Route a $' + capital + ' payment through ' + name + ' on ' + chain + ' and confirm it settles.';
  if (c.indexOf('index') >= 0)
    return 'Buy $' + capital + ' of the ' + name + ' index on ' + chain + ' and hold the index token.';
  if (c.indexOf('governance') >= 0)
    return 'Stake $' + capital + ' for governance through ' + name + ' on ' + chain + ' and keep the voting position.';
  if (c.indexOf('privacy') >= 0)
    return 'Run one $' + capital + ' private transfer through ' + name + ' on ' + chain + ' and keep the receipt.';
  if (c.indexOf('chain') >= 0)
    return 'Bridge $' + capital + ' to ' + chain + " and use the chain's flagship app through " + name + '.';
  if (c.indexOf('anchor btc') >= 0 || c.indexOf('decentralized btc') >= 0)
    return 'Mint $' + capital + ' of the BTC-backed asset through ' + name + ' on ' + chain + ' and hold it.';
  if (c.indexOf('otc') >= 0)
    return 'List a small $' + capital + ' offer on the ' + name + ' marketplace on ' + chain + ' and let it fill.';
  if (c.indexOf('card') >= 0)
    return 'Load $' + capital + ' onto the ' + name + ' card on ' + chain + ' and spend a small amount with it.';
  if (c.indexOf('interest rate') >= 0)
    return 'Open a $' + capital + ' rate position on ' + name + ' on ' + chain + ' and hold it through the week.';
  if (c.indexOf('liquidity manager') >= 0)
    return 'Deposit $' + capital + ' into a managed position on ' + name + ' on ' + chain + ' and let it rebalance.';
  return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
}

function secondActionFor(p, capital, chain) {
  var c = (p.category || '').toLowerCase();
  var name = p.name;
  if (c.indexOf('liquid staking') >= 0 || c.indexOf('liquid restaking') >= 0 || c.indexOf('restaking') >= 0 || c.indexOf('staking') >= 0)
    return 'Claim the staking rewards from ' + name + ' once a week and restake them instead of selling.';
  if (c.indexOf('lend') >= 0 || c.indexOf('collateral') >= 0)
    return 'Borrow a small amount against the supplied collateral on ' + name + ', then repay it within the same week.';
  if (c.indexOf('cdp') >= 0)
    return "Adjust the vault's collateral ratio on " + name + ' once, then leave it steady for the rest of the month.';
  if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0)
    return 'Swap a small amount through the ' + name + ' pool each week so the wallet shows trading activity too.';
  if (c.indexOf('bridge') >= 0)
    return 'Bridge a small amount back through ' + name + ' and note the fee, so the route is used in both directions.';
  if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('options') >= 0 || c.indexOf('basis trading') >= 0)
    return 'Close the hedge on ' + name + ' and open a fresh one, so the position is not a single stale trade.';
  if (c.indexOf('prediction') >= 0)
    return 'Settle the first position on ' + name + ' and place a second, smaller one on a different market.';
  if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('risk') >= 0)
    return 'Move a slice of the vault deposit between two ' + name + ' vaults and record which one performed better.';
  if (c.indexOf('stable') >= 0)
    return 'Redeem a small part of the stable position on ' + name + ' and re-mint it, to show the full cycle.';
  if (c.indexOf('rwa') >= 0)
    return 'Claim the yield distribution on ' + name + ' when it pays out and hold the proceeds.';
  if (c.indexOf('insurance') >= 0)
    return 'Extend the cover on ' + name + ' by one more period before the first one lapses.';
  if (c.indexOf('farm') >= 0)
    return 'Harvest the farm rewards on ' + name + ' once a week and put them back into the farm.';
  if (c.indexOf('payment') >= 0)
    return 'Send a second, smaller payment through ' + name + ' the following week.';
  if (c.indexOf('index') >= 0)
    return 'Rebalance a slice of the ' + name + ' index position when its weights drift.';
  if (c.indexOf('governance') >= 0)
    return 'Vote on one live proposal through ' + name + ' and keep the voting receipt.';
  if (c.indexOf('privacy') >= 0)
    return 'Run a second private transfer through ' + name + ' the following week.';
  if (c.indexOf('chain') >= 0)
    return 'Use a second app on ' + chain + ' through ' + name + ' so the wallet is not tied to one contract.';
  if (c.indexOf('anchor btc') >= 0 || c.indexOf('decentralized btc') >= 0)
    return 'Redeem a small slice of the BTC-backed asset on ' + name + ' and mint it again.';
  if (c.indexOf('otc') >= 0)
    return 'Settle one completed trade on ' + name + ' and leave feedback where the marketplace asks for it.';
  if (c.indexOf('card') >= 0)
    return 'Spend a second small amount with the ' + name + ' card the following week.';
  if (c.indexOf('interest rate') >= 0)
    return 'Roll the rate position on ' + name + ' into the next period instead of closing it.';
  if (c.indexOf('liquidity manager') >= 0)
    return 'Withdraw a slice of the managed position on ' + name + ' and redeposit it after the rebalance.';
  return 'Make one swap or cast one vote through ' + name + ' so the wallet shows a second kind of activity.';
}

function stepText(step) {
  var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
  if (s.length > 600) s = s.slice(0, 596) + '...';
  if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
  return s;
}

function farmSteps(p) {
  var chain = chainOf(p);
  var capital = capitalFor(p);
  var hold = holdDaysFor(p.age_days);
  var gas = gasPerTx(chain);
  var weeklyGas = gas * 4;
  return [
    { text: "Open " + p.name + "'s own points or rewards page and read what it counts, before moving any funds.", cost: 'nothing to read', time: '15 minutes' },
    { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + gas + ' of gas', time: '15 minutes to set up' },
    { text: secondActionFor(p, capital, chain), cost: 'about $' + gas + ' of gas', time: '10 minutes' },
    { text: 'Do one qualifying action each week on ' + p.name + ', such as a deposit, a borrow, a swap or a vote.', cost: 'about $' + weeklyGas + ' of gas a month', time: '10 minutes a week' },
    { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
    { text: 'Budget the gas for the whole run up front: about $' + gas + ' a transaction on ' + chain + ', four to six transactions in all.', cost: 'about $' + (gas * 5) + ' of gas in total', time: '5 minutes to plan' },
    { text: 'Claim only from the link ' + p.name + ' itself publishes, and never pay anyone to claim for you.', cost: 'no fee to check; a claim that asks for payment is a scam', time: '10 minutes' },
    { text: 'Write the wallet, the dates and every transaction in a farm log, then unwind in reverse order when you exit.', cost: 'nothing but the log', time: '5 minutes' }
  ].map(stepText);
}

// ---- rendering ----
(function () {
  if (!DATA) return;
  var app = document.getElementById('app');
  var state = { q: '', category: 'all', chain: 'all', watchlistOnly: false, tab: 'pre-token', sort: 'implied', dir: 'desc', selected: null };
  var WATCHLIST = {};
  DATA.rows.forEach(function (r) { WATCHLIST[r.slug] = true; });

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('watchlist') === '1') state.watchlistOnly = true;
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('tab') === 'live') state.tab = 'live';
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.watchlistOnly) params.set('watchlist', '1');
    if (state.tab === 'live') params.set('tab', 'live');
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (state.watchlistOnly && !WATCHLIST[r.slug]) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    var dir = state.dir === 'desc' ? -1 : 1;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function masthead() {
    return el('header', { class: 'masthead' },
      el('div', { class: 'brand' }, el('span', { class: 'diamond' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'meta' },
        el('span', null, 'Snapshot ', el('b', { text: DATA.as_of })),
        el('span', null, 'DefiLlama protocol index'),
        el('span', null, 'Model ', el('b', { text: DATA.model_version }))
      )
    );
  }

  function hero() {
    return el('section', { class: 'hero' },
      el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
      el('p', null,
        'The watchlist is the floor: every protocol with at least ', el('b', { text: '$' + Math.round(DATA.floor_usd / 1e6) + 'M' }),
        ' of TVL and no token on record. The early radar adds ', el('b', { text: String(DATA.early_size) }),
        ' pre-token protocols below that floor. Implied value is a model of what a token could be worth if the protocol launched one today — not a price, and not a promise that it ever will.'
      )
    );
  }

  function stats() {
    var stat = function (n, label) { return el('div', { class: 'stat' }, el('b', { text: n }), el('span', { text: label })); };
    return el('div', { class: 'stats' },
      stat(DATA.watchlist_size + ' / ' + DATA.watchlist_size, 'Watchlist covered'),
      stat(String(DATA.board_size), 'Pre-token rows scored'),
      stat(String(DATA.early_size), 'Early rows below the floor'),
      stat(String(DATA.live_size), 'Live-token protocols set aside')
    );
  }

  function toolbar() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search the board', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var cat = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    cat.addEventListener('change', function () { state.category = cat.value; writeHash(); render(); });
    var chn = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chn.addEventListener('change', function () { state.chain = chn.value; writeHash(); render(); });
    var wl = el('input', { type: 'checkbox', id: 'watchlist', checked: state.watchlistOnly ? 'checked' : null });
    wl.addEventListener('change', function () { state.watchlistOnly = wl.checked; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'toolbar' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), cat),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chn),
      el('label', { class: 'check', for: 'watchlist' }, wl, 'Watchlist only'),
      el('div', { class: 'seg' }, pre, live),
      el('span', { class: 'shown', text: state.tab === 'pre-token' ? filteredRows().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = state.dir === 'desc' ? 'asc' : 'desc'; else { state.sort = key; state.dir = 'desc'; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir === 'desc' ? ' ▼' : ' ▲' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(filteredRows());
    if (list.length === 0) {
      return el('div', { class: 'card' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'btn hot', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.watchlistOnly = false; writeHash(); render(); } })
      ));
    }
    var max = DATA.rows.reduce(function (m, r) { return Math.max(m, r.implied_value_usd || 0); }, 1);
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num rank-num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'proto' },
          el('b', { text: r.name }),
          el('span', { text: (r.category || 'Other') + ' · ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'value' },
          el('div', { class: 'track', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', null, el('span', { class: 'badge pre', text: 'NO TOKEN' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'card' },
      el('div', { class: 'scroll' },
        el('table', null,
          el('caption', { text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'proto' }, el('b', { text: r.name }), el('span', { text: (r.category || 'Other') + ' · ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'badge live', text: 'TRADES' }))
      ));
    });
    return el('div', { class: 'card' },
      el('div', { class: 'scroll' },
        el('table', null,
          el('caption', { text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    return el('section', { class: 'card model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        'implied = round( tvl_usd x ' + m.base_multiple + ' x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ') x (1 + ' + m.breadth_step + ' x min(chains - 1, ' + m.breadth_cap + ')) )'
      ),
      el('p', { text: 'TVL and seven-day growth come from the snapshot. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses ' + m.unknown_age_days + ' days. Breadth counts the chains the protocol already serves. The early radar is every pre-token protocol below the watchlist floor, by TVL, and the live-token protocols are set aside with their market caps shown.' })
    );
  }

  var drawer = el('aside', { class: 'drawer', id: 'detail', hidden: 'hidden', 'aria-label': 'Protocol detail' });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    drawer.textContent = '';
    var steps = farmSteps(row);
    var recomputed = impliedOf(row, DATA.model);
    drawer.appendChild(el('div', { class: 'drawer-head' },
      el('div', null,
        el('span', { class: 'kicker', text: 'Rank ' + row.rank + ' of ' + DATA.board_size }),
        el('h2', { text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' · ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'x', type: 'button', 'aria-label': 'Close details', text: '×', onclick: function () { closeDetail(); } })
    ));
    drawer.appendChild(el('section', { class: 'dsec' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'grid2' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Chains served' }), el('b', { text: String((row.chains || []).length) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { text: String(row.growth_multiplier) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { text: String(row.maturity_multiplier) })),
        el('div', null, el('span', { text: 'Breadth multiplier' }), el('b', { text: String(row.breadth_multiplier) })),
        el('div', { class: 'total' }, el('span', { text: 'Implied value' }), el('b', { text: fmtUsd(row.implied_value_usd) }))
      ),
      el('p', { class: 'watch', text: 'Model ' + DATA.model_version + ': the page recomputes this row as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' })
    ));
    drawer.appendChild(el('section', { class: 'dsec' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    drawer.removeAttribute('hidden');
  }
  function closeDetail() {
    state.selected = null;
    writeHash();
    drawer.setAttribute('hidden', 'hidden');
    drawer.textContent = '';
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'wrap' });
    shell.appendChild(masthead());
    shell.appendChild(hero());
    shell.appendChild(stats());
    shell.appendChild(toolbar());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!drawer.isConnected) app.appendChild(drawer);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !drawer.hasAttribute('hidden')) closeDetail();
  });
})();
