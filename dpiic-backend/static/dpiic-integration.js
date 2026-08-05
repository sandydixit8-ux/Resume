(function () {
  'use strict';

  var config = window.DPIIC_CONFIG || {};
  var base = String(config.apiBase || '').replace(/\/+$/, '');
  var autoLogin = config.autoLogin || null;

  var token = null;
  var apiUp = false;
  var currentUser = null;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmt(n) { return Number(n || 0).toLocaleString('en-IN'); }

  function fmtDate(v) {
    if (!v) return '';
    var d = new Date(v);
    if (isNaN(d.getTime())) return String(v).slice(0, 10);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function fmtTime(v) {
    if (!v) return '';
    var d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }

  function api(path, options) {
    options = options || {};
    options.headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    if (token) options.headers.Authorization = 'Bearer ' + token;
    return fetch(base + path, options).then(function (res) {
      return res.json().then(function (body) {
        return { status: res.status, ok: res.ok, body: body };
      }).catch(function () {
        return { status: res.status, ok: res.ok, body: null };
      });
    });
  }

  function setStat(idx, value, deltaText, deltaClass) {
    var card = $$('#view-dashboard .stat-row .stat')[idx - 1];
    if (!card) return;
    var valEl = $('.val', card);
    var deltaEl = $('.delta', card);
    if (valEl) valEl.textContent = fmt(value);
    if (deltaEl) {
      deltaEl.textContent = deltaText;
      deltaEl.className = 'delta ' + (deltaClass || '');
    }
  }

  function hydrateDashboard(s) {
    if (!s) return;
    setStat(1, s.datasets_indexed, '▲ ' + fmt(s.datasets_weekly_delta) + ' this week', 'up');
    setStat(2, s.active_projects, '▲ ' + s.projects_new + ' new', 'up');
    setStat(3, s.ml_running, s.ml_queued + ' queued', 'warn');
    setStat(4, s.pending_requests, s.requests_awaiting + ' awaiting approval', 'warn');
  }

  function hydrateCoverage(programmes) {
    var bars = $$('#view-dashboard .strat-bar');
    if (!programmes || !bars.length) return;
    programmes.slice(0, bars.length).forEach(function (p, i) {
      var nameEl = $('.name', bars[i]);
      var amtEl = $('.amt', bars[i]);
      if (nameEl) nameEl.textContent = p.code + ' — ' + p.name;
      if (amtEl) amtEl.textContent = fmt(p.record_count);
    });
  }

  function hydrateActivity(activity) {
    var box = $('#view-dashboard .dash-grid .panel:nth-of-type(2) .panel-body');
    if (!box || !activity) return;
    box.innerHTML = activity.slice(0, 6).map(function (a) {
      return '<div class="activity-item"><span class="time">' + esc(a.time) + '</span>' +
        '<span class="txt"><b>' + esc(a.actor) + '</b> ' + esc(a.text) + '</span></div>';
    }).join('');
  }

  function hydrateCatalogue(res) {
    var panel = $$('#view-catalogue .panel')[1];
    if (!panel) return;
    var head = $('.panel-head h4', panel);
    if (head) head.textContent = 'Results — ' + res.items.length + ' of ' + fmt(res.total);
    var body = $('.panel-body', panel);
    if (!body) return;
    if (typeof datasetMeta !== 'undefined' && datasetMeta.splice) {
      datasetMeta.splice(0, datasetMeta.length);
      res.items.forEach(function (d) {
        datasetMeta.push({ name: d.name, prog: d.programme, format: d.format, coverage: d.coverage });
      });
    }
    body.innerHTML = res.items.map(function (d, i) {
      return '<div class="dataset-row' + (i === 0 ? ' selected' : '') + '" onclick="selectDataset(this,' + i + ')">' +
        '<div><div class="ds-name">' + esc(d.name) + '</div>' +
        '<div class="ds-meta">' + esc(d.programme) + ' · ' + esc(d.format) + ' · Updated ' + fmtDate(d.updated_at) + '</div></div>' +
        '<span class="tag">' + esc(d.data_type) + '</span></div>';
    }).join('');
    var first = $('.dataset-row', body);
    if (first && typeof selectDataset === 'function') selectDataset(first, 0);
  }

  function hydrateAi(executions, outputs, models) {
    var execBox = $('#view-ai .ai-grid .panel:nth-of-type(1) .panel-body');
    if (execBox && executions) {
      execBox.innerHTML = executions.slice(0, 6).map(function (x) {
        return '<div class="model-row"><div>' +
          '<div style="font-size:13px; font-weight:500;">' + esc(x.name) + '</div>' +
          '<div style="font-size:11px; color:var(--text-faint);">' + esc(x.target) + '</div></div>' +
          '<span class="status-dot ' + esc(x.status) + '">' + esc(x.status) + '</span></div>';
      }).join('');
    }
    var confPanel = $('#view-ai .ai-grid .panel:nth-of-type(2)');
    if (confPanel && models && models.length) {
      var m = models[0];
      var head = $('.panel-head h4', confPanel);
      if (head) head.textContent = 'Prediction confidence — ' + m.name;
      var mono = $$('.panel-body > div', confPanel).filter(function (el) {
        return /IBM Plex Mono/.test(el.getAttribute('style') || '');
      })[0];
      if (mono) mono.textContent = (m.auc * 100).toFixed(1) + '%';
      var fill = $('.confidence-fill', confPanel);
      if (fill) fill.style.width = Math.round(m.auc * 100) + '%';
    }
    var chipBox = ($$('#view-ai > .panel')[0] || {}).querySelector ? $$('#view-ai > .panel')[0].querySelector('.panel-body') : null;
    if (chipBox && outputs) {
      chipBox.innerHTML = outputs.map(function (o) {
        return '<div class="output-chip">✔ &nbsp; ' + esc(o.title) +
          ' — <span class="mono" style="color:var(--text-faint);">' + esc(o.meta) + '</span></div>';
      }).join('');
    }
    var countEl = document.getElementById('mpaResultsCount');
    if (countEl && models) countEl.textContent = 'Results — ' + models.length + ' of ' + models.length + ' models';
    if (typeof mpaMeta !== 'undefined' && mpaMeta.splice && models) {
      mpaMeta.splice(0, mpaMeta.length);
      models.forEach(function (m) {
        mpaMeta.push({
          name: m.name,
          algo: m.algorithm_display,
          auc: m.auc.toFixed(2),
          aoi: m.aoi,
          date: fmtDate(m.updated_at),
          source: m.source
        });
      });
    }
  }

  function toWfStage(s) {
    return {
      key: s.key,
      num: s.num,
      name: s.name,
      desc: s.description,
      count: s.count,
      status: s.status,
      statusColor: s.status_color,
      color: s.color,
      metrics: [
        { k: 'Records', v: fmt(s.count) },
        { k: 'Datasets', v: String((s.subtasks || []).length) },
        { k: 'Success Rate', v: s.progress == null ? '—' : Math.round(s.progress) + '%' }
      ],
      progress: s.progress,
      progColor: s.prog_color,
      lastLabel: s.last_label,
      lastVal: s.last_val,
      substeps: (s.subtasks || []).map(function (t) { return { t: t.title, done: t.done }; })
    };
  }

  function applyStages(stages) {
    if (!stages || typeof wfStages === 'undefined' || !wfStages.splice) return;
    wfStages.splice(0, wfStages.length);
    stages.forEach(function (s) { wfStages.push(toWfStage(s)); });
  }

  function applyAlerts(alerts) {
    if (!alerts || typeof wfAlerts === 'undefined' || !wfAlerts.splice) return;
    wfAlerts.splice(0, wfAlerts.length);
    alerts.forEach(function (a) { wfAlerts.push({ color: a.color, icon: a.icon, text: a.text, time: a.time }); });
  }

  function hydrateWorkflow(stages, alerts) {
    applyStages(stages);
    applyAlerts(alerts);
    if (typeof renderWfStrip === 'function') renderWfStrip();
    if (typeof renderWfChips === 'function') renderWfChips();
    if (typeof renderWfStageList === 'function') renderWfStageList();
    renderDonut();
    if (typeof renderWfAlerts === 'function') renderWfAlerts();
  }

  function hydrateWorkspace(projects) {
    var box = $('#view-workspace .panel .panel-body');
    if (!box || !projects) return;
    box.innerHTML = projects.map(function (p) {
      return '<div class="dataset-row"><div><div class="ds-name">' + esc(p.name) + '</div>' +
        '<div class="ds-meta">Lead: ' + esc(p.lead) + ' · ' + p.dataset_count + ' datasets · Stage: ' + esc(p.stage) + '</div></div>' +
        '<span class="tag">' + esc(p.status) + '</span></div>';
    }).join('');
  }

  function hydrateKnowledge(items) {
    var grid = $('#view-kh .kh-grid');
    if (!grid || !items) return;
    grid.innerHTML = items.map(function (k) {
      return '<div class="kh-card"><div class="kh-type">' + esc(k.item_type) + '</div>' +
        '<h4>' + esc(k.title) + '</h4><p>' + esc(k.summary) + '</p></div>';
    }).join('');
  }

  function hydrateReports(reports) {
    var box = $('#view-reports .panel .panel-body');
    if (!box || !reports) return;
    box.innerHTML = reports.map(function (r) {
      return '<div class="dataset-row"><div><div class="ds-name">' + esc(r.title) + '</div>' +
        '<div class="ds-meta">Generated from ' + esc(r.source) + ' · ' + fmtDate(r.generated_at) + '</div></div>' +
        '<span class="tag">' + esc(r.format) + '</span></div>';
    }).join('');
  }

  function hydrateAdmin(requests) {
    var box = $('#view-admin .panel .panel-body');
    if (!box) return;
    box.innerHTML = (requests || []).map(function (r) {
      return '<div class="dataset-row" data-rid="' + r.id + '"><div>' +
        '<div class="ds-name">' + esc(r.requester_name) + ' — ' + esc(r.dataset_name) + '</div>' +
        '<div class="ds-meta">Requested ' + esc(fmtTime(r.requested_at)) + ' · ' + esc(r.requester_role) + '</div></div>' +
        '<div style="display:flex; gap:8px;">' +
        '<button class="btn primary" style="padding:6px 12px;" onclick="DPIIC.decide(' + r.id + ',\'approve\',this)">Approve</button>' +
        '<button class="btn" style="padding:6px 12px;" onclick="DPIIC.decide(' + r.id + ',\'deny\',this)">Deny</button>' +
        '</div></div>';
    }).join('');
  }

  function decide(requestId, decision, btn) {
    api('/api/admin/access-requests/' + requestId + '/decision', {
      method: 'POST',
      body: JSON.stringify({ decision: decision })
    }).then(function (res) {
      if (res.ok) {
        var row = btn && btn.closest('.dataset-row');
        if (row) row.remove();
        if (typeof wfToast === 'function') wfToast('Request #' + requestId + ' ' + decision + 'd.');
      } else if (typeof wfToast === 'function') {
        wfToast('Decision failed (' + res.status + ').');
      }
    });
  }

  window.DPIIC = { decide: decide, refresh: null };

  function hydrateAll() {
    api('/api/dashboard/summary').then(function (r) { if (r.ok) hydrateDashboard(r.body); });
    api('/api/dashboard/coverage').then(function (r) { if (r.ok) hydrateCoverage(r.body); });
    api('/api/dashboard/activity').then(function (r) { if (r.ok) hydrateActivity(r.body); });
    api('/api/workflow/stages').then(function (r) { if (r.ok) hydrateWorkflow(r.body, null); });
    api('/api/workflow/alerts').then(function (r) { if (r.ok) applyAlerts(r.body); });
    api('/api/datasets').then(function (r) { if (r.ok) hydrateCatalogue(r.body); });
    Promise.all([
      api('/api/ai/executions'),
      api('/api/ai/outputs'),
      api('/api/mpa/models')
    ]).then(function (rs) {
      hydrateAi(rs[0].ok ? rs[0].body : null, rs[1].ok ? rs[1].body : null, rs[2].ok ? rs[2].body : null);
    });
    api('/api/projects').then(function (r) { if (r.ok) hydrateWorkspace(r.body); });
    api('/api/knowledge').then(function (r) { if (r.ok) hydrateKnowledge(r.body); });
    api('/api/reports').then(function (r) { if (r.ok) hydrateReports(r.body); });
    api('/api/admin/access-requests').then(function (r) { if (r.ok) hydrateAdmin(r.body); });
  }

  function showLoginError(msg) {
    var err = document.getElementById('loginError');
    if (!err) {
      err = document.createElement('div');
      err.id = 'loginError';
      err.style.cssText = 'color:#e0676b; font-size:11.5px; margin-top:10px;';
      var btn = $('#loginOverlay .login-card .btn.primary');
      if (btn) btn.parentNode.appendChild(err);
    }
    if (err) err.textContent = msg;
  }

  function enterSecurePortal(user) {
    var fullName = user.full_name || user.user_id;
    var initials = fullName.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
    var nameEl = document.getElementById('userName');
    var avatarEl = document.getElementById('userAvatar');
    if (avatarEl) avatarEl.textContent = initials;
    if (nameEl) nameEl.textContent = fullName + ' · ' + user.role;
    closeLogin();
    document.getElementById('public').classList.remove('active');
    document.getElementById('secure').classList.add('active');
    window.scrollTo(0, 0);
  }

  function doLogin(userId, password) {
    return api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, password: password })
    }).then(function (res) {
      apiUp = true;
      if (res.ok && res.body && res.body.access_token) {
        token = res.body.access_token;
        currentUser = res.body.user;
        hydrateAll();
        return true;
      }
      return false;
    }).catch(function () {
      apiUp = false;
      return false;
    });
  }

  function renderDonut() {
    var svg = document.getElementById('wfDonut');
    var legend = document.getElementById('wfLegend');
    if (!svg || !legend) return;
    if (typeof wfStages === 'undefined' || typeof wfColors === 'undefined') return;
    var statuses = ['New', 'In Progress', 'Completed', 'Stored'];
    var colors = [wfColors.purple, wfColors.orange, wfColors.green, wfColors.teal];
    var data = statuses.map(function (st, i) {
      return {
        label: st,
        val: wfStages.filter(function (s) { return s.status === st; }).length,
        color: colors[i]
      };
    }).filter(function (d) { return d.val > 0; });
    if (!data.length) return;
    var total = data.reduce(function (a, d) { return a + d.val; }, 0);
    var cx = 90, cy = 90, r = 68, stroke = 24;
    var circ = 2 * Math.PI * r;
    var offset = 0;
    var paths = '';
    data.forEach(function (d) {
      var frac = d.val / total;
      var len = frac * circ;
      paths += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + d.color +
        '" stroke-width="' + stroke + '" stroke-dasharray="' + len + ' ' + (circ - len) +
        '" stroke-dashoffset="' + (-offset) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>';
      offset += len;
    });
    svg.innerHTML = paths +
      '<text x="' + cx + '" y="' + (cy - 6) + '" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-size="24" font-weight="700" fill="#eceee8">' + total + '</text>' +
      '<text x="' + cx + '" y="' + (cy + 14) + '" text-anchor="middle" font-family="IBM Plex Sans, sans-serif" font-size="11" fill="#a9bcc0">Total Datasets</text>';
    legend.innerHTML = data.map(function (d) {
      return '<div class="wf-legend-row" data-label="' + d.label + '" onclick="wfSetFilter(\'' + d.label + '\')">' +
        '<span class="wf-legend-dot" style="background:' + d.color + '"></span>' +
        '<span class="wf-legend-label">' + d.label + '</span>' +
        '<span class="wf-legend-val">' + d.val + ' (' + Math.round(d.val / total * 100) + '%)</span></div>';
    }).join('');
  }

  function installOverrides() {
    if (typeof wfColors !== 'undefined' && typeof wfStages !== 'undefined') {
      window.renderWfDonut = renderDonut;
    }
    if (typeof wfSimulateRun === 'function') {
      window.wfSimulateRun = function () {
        api('/api/workflow/simulate', { method: 'POST' }).then(function (res) {
          if (res.ok && res.body && res.body.stages) {
            applyStages(res.body.stages);
            if (typeof renderWfStrip === 'function') renderWfStrip();
            if (typeof renderWfStageList === 'function') renderWfStageList();
            renderDonut();
            if (typeof wfToast === 'function') wfToast('Pipeline simulation completed via backend.');
          } else if (typeof wfToast === 'function') {
            wfToast('Simulation unavailable (' + res.status + ').');
          }
        });
      };
    }
  }

  function init() {
    installOverrides();
    if (typeof enterSecure === 'function') {
      var origEnterSecure = window.enterSecure;
      window.enterSecure = function () {
        var inputs = $$('#loginOverlay .login-card input');
        var userId = inputs[0] && inputs[0].value.trim();
        var password = inputs[1] && inputs[1].value;
        if (apiUp && userId && password) {
          doLogin(userId, password).then(function (ok) {
            if (ok) enterSecurePortal(currentUser);
            else showLoginError('Invalid credentials or role restrictions.');
          });
          return;
        }
        origEnterSecure();
      };
    }
    if (autoLogin && autoLogin.user && autoLogin.password) {
      doLogin(autoLogin.user, autoLogin.password).then(function (ok) {
        if (ok) enterSecurePortal(currentUser);
      });
    }
  }

  installOverrides();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
