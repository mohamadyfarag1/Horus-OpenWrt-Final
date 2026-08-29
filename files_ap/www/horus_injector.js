// ====================================================================
// RADIUS Sync - Flicker-Free Synchronous LuCI Table Hook (v2.5)
// Real-time updates, cache-clearing on offline/disabled, instant feedback
// ====================================================================

(function() {
    'use strict';

    var cachedMap = {};
    var cachedMapByIp = {};
    var currentStatus = 'unknown'; // 'online', 'offline', 'disabled'
    var isFetching = false;

    function formatSession(secs) {
        secs = parseInt(secs) || 0;
        var d = Math.floor(secs / 86400);
        var h = Math.floor((secs % 86400) / 3600);
        var m = Math.floor((secs % 3600) / 60);
        if (d > 0) return d + 'd ' + h + 'h';
        if (h > 0) return h + 'h ' + m + 'm';
        return m + 'm';
    }

    function formatQuota(bytes) {
        if (bytes === null || bytes === undefined || bytes === '') return null;
        var b = parseFloat(bytes);
        if (b < 0) return 'غير محدود';
        if (isNaN(b) || b <= 0) return '0 MB';
        if (b >= 1073741824) {
            return (b / 1073741824).toFixed(2) + ' GB';
        } else if (b >= 1048576) {
            return (b / 1048576).toFixed(1) + ' MB';
        } else {
            return (b / 1024).toFixed(0) + ' KB';
        }
    }

    function calculateRemainingDays(expirStr) {
        if (!expirStr || expirStr === '') return null;
        try {
            var expDate = new Date(expirStr.replace(/-/g, '/'));
            var now = new Date();
            var diffMs = expDate - now;
            var days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            return days;
        } catch(e) {
            return null;
        }
    }

    function normalizeMac(mac) {
        if (!mac) return '';
        var clean = String(mac).replace(/[^a-fA-F0-9]/g, '').toUpperCase();
        if (clean.length === 12) {
            return clean.match(/.{1,2}/g).join(':');
        }
        return String(mac).toUpperCase().trim();
    }

    function buildMacMap(raw) {
        var map = {};
        var ipMap = {};
        if (!raw) return { macMap: map, ipMap: ipMap };

        var list = [];
        if (Array.isArray(raw)) {
            list = raw;
        } else if (raw.data && Array.isArray(raw.data)) {
            list = raw.data;
        } else if (typeof raw === 'object') {
            for (var k in raw) {
                if (k !== 'data' && k !== 'status' && k !== 'timestamp' && k !== 'count' && typeof raw[k] === 'object') {
                    var n_k = normalizeMac(k);
                    if (n_k) map[n_k] = raw[k];
                }
            }
            return { macMap: map, ipMap: ipMap };
        }

        for (var i = 0; i < list.length; i++) {
            var u = list[i];
            if (!u) continue;

            var rawMac = u.mac || u.callingstationid || u.username || '';
            var mac = normalizeMac(rawMac);

            var displayName = u.name || '';
            if (!displayName || displayName === mac || displayName === rawMac) {
                if (u.user_details && u.user_details.firstname && u.user_details.firstname !== '') {
                    displayName = u.user_details.firstname;
                    if (u.user_details.lastname && u.user_details.lastname !== '') {
                        displayName += ' ' + u.user_details.lastname;
                    }
                } else if (u.firstname && u.firstname !== '') {
                    displayName = u.firstname;
                    if (u.lastname && u.lastname !== '') {
                        displayName += ' ' + u.lastname;
                    }
                } else {
                    displayName = u.username || '';
                }
            }

            var profileName = u.profile || u.profile_name || u.user_profile_name || '';
            if (!profileName && u.user_details && u.user_details.profile_details) {
                profileName = u.user_details.profile_details.name || '';
            } else if (!profileName && u.profile_details) {
                profileName = u.profile_details.name || '';
            }

            var expiry = u.expiration || (u.user_details && u.user_details.expiration) || '';
            var ip = u.ip || u.framedipaddress || '';
            var sess = parseInt(u.session || u.uptime || u.acctsessiontime) || 0;
            var quota = (u.quota !== undefined && u.quota !== null && u.quota !== '') ? u.quota : (u.remainingTrafficBytes !== undefined ? u.remainingTrafficBytes : '');
            var balance = (u.balance !== undefined && u.balance !== null && u.balance !== '') ? u.balance : (u.credits !== undefined ? u.credits : (u.user_details && u.user_details.balance ? u.user_details.balance : ''));
            var loan = (u.loan !== undefined && u.loan !== null && u.loan !== '') ? u.loan : (u.user_details && u.user_details.loan_balance ? u.user_details.loan_balance : '');

            var userObj = {
                username: u.username || '',
                name: displayName,
                profile: profileName,
                quota: quota,
                balance: balance,
                loan: loan,
                ip: ip,
                expiration: expiry,
                session: sess
            };

            if (mac && /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac)) {
                map[mac] = userObj;
            }
            if (ip && /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/.test(ip)) {
                ipMap[ip] = userObj;
            }
        }
        return { macMap: map, ipMap: ipMap };
    }

    function clearInjections() {
        var badges = document.querySelectorAll('.sas-badge-icon');
        for (var b = 0; b < badges.length; b++) {
            badges[b].remove();
        }

        var cells = document.querySelectorAll('[data-sas-done]');
        for (var c = 0; c < cells.length; c++) {
            var orig = cells[c].getAttribute('data-orig-content');
            if (orig !== null) {
                cells[c].innerHTML = orig;
            }
            cells[c].removeAttribute('data-sas-done');
        }
    }

    function injectAll() {
        var rows = document.querySelectorAll('tr');

        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];

            // Skip header rows
            if (row.querySelector('th')) continue;

            var cells = row.querySelectorAll('td');
            // Associated stations rows in LuCI have 4 to 6 cells (Network, MAC, Host, Signal, Rate, Action)
            // Wireless overview / interface rows only have 2 or 3 cells.
            if (cells.length < 4) continue;

            // Skip if this row has buttons for Edit, Scan, Restart, Add (interface management actions)
            var btns = row.querySelectorAll('button, input[type="button"], a.cbi-button');
            var hasInterfaceBtn = false;
            for (var b = 0; b < btns.length; b++) {
                var btnText = (btns[b].textContent || btns[b].value || '').trim().toLowerCase();
                if (btnText.indexOf('edit') !== -1 || btnText.indexOf('تعديل') !== -1 ||
                    btnText.indexOf('scan') !== -1 || btnText.indexOf('فحص') !== -1 ||
                    btnText.indexOf('restart') !== -1 || btnText.indexOf('إعادة') !== -1 ||
                    btnText.indexOf('add') !== -1 || btnText.indexOf('إضافة') !== -1) {
                    hasInterfaceBtn = true;
                    break;
                }
            }
            if (hasInterfaceBtn) continue;

            var macCellIndex = -1;
            var matchedMac = '';
            var matchedIp = '';

            for (var c = 0; c < cells.length; c++) {
                var txt = cells[c].textContent.trim();
                var macMatch = txt.match(/([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}/);
                if (macMatch) {
                    macCellIndex = c;
                    matchedMac = normalizeMac(macMatch[0]);
                }
                var ipMatch = txt.match(/\b(?:192\.168|10\.|172\.(?:1[6-9]|2[0-9]|3[01]))\.[0-9]+\.[0-9]+\b/);
                if (ipMatch) {
                    matchedIp = ipMatch[0];
                }
            }

            if (macCellIndex !== -1 && matchedMac !== '') {
                var hostCell = (cells.length > macCellIndex + 1) ? cells[macCellIndex + 1] : null;
                if (hostCell && hostCell.querySelector('input[type="button"], button, a.cbi-button')) {
                    continue;
                }

                var info = cachedMap[matchedMac] || (matchedIp ? cachedMapByIp[matchedIp] : null);

                if (info && (info.name || info.profile || info.ip)) {
                    if (hostCell) {
                        if (!hostCell.hasAttribute('data-orig-content')) {
                            hostCell.setAttribute('data-orig-content', hostCell.innerHTML);
                        }

                        var displayName = info.name || info.username || 'مشترك';
                        var isCard = (info.username && info.username.length > 3 && /^\d+$/.test(info.username));

                        var quotaFormatted = formatQuota(info.quota);
                        var quotaHtml = '';
                        if (quotaFormatted !== null) {
                            quotaHtml = '<span style="color:#ffd54f; font-weight:bold; font-size:11px; margin-right:6px;">📊 متبقي: ' + quotaFormatted + '</span> ';
                        }

                        var balNum = parseFloat(info.balance !== undefined && info.balance !== null && info.balance !== '' ? info.balance : 0);
                        var balColor = (!isNaN(balNum) && balNum > 0) ? '#ffd700' : '#b0bec5';
                        var balanceHtml = '<span style="color:' + balColor + '; font-weight:bold; font-size:11px;">💰 رصيد: ' + (isNaN(balNum) ? '0.00' : balNum.toFixed(2)) + ' ج</span>';

                        var loanHtml = '';
                        if (info.loan !== undefined && info.loan !== null && info.loan !== '') {
                            var loanNum = parseFloat(info.loan);
                            if (!isNaN(loanNum) && loanNum > 0) {
                                loanHtml = '<span style="color:#ff5252; font-weight:bold; font-size:11px;">💳 سلف: ' + loanNum.toFixed(2) + ' ج</span>';
                            }
                        }

                        var days = calculateRemainingDays(info.expiration);
                        var daysHtml = '';
                        if (days !== null) {
                            var daysColor = days > 3 ? '#00e676' : (days > 0 ? '#ffb74d' : '#ff5252');
                            daysHtml = '<span style="color:' + daysColor + '; font-weight:bold; font-size:11px;">📅 ' + 
                                       (days > 0 ? 'متبقي ' + days + ' يوم' : 'منتهي الصلاحية') + '</span>';
                        }

                        var cellKey = [
                            matchedMac,
                            displayName,
                            info.profile || '',
                            info.quota || '',
                            info.balance || '',
                            info.loan || '',
                            info.ip || '',
                            info.session || '',
                            info.expiration || ''
                        ].join('_');
                        if (hostCell.getAttribute('data-sas-done') === cellKey) {
                            continue;
                        }
                        hostCell.setAttribute('data-sas-done', cellKey);

                        hostCell.innerHTML = [
                            '<div style="line-height:1.5; font-family:sans-serif; text-align:right; direction:rtl; width:100%; min-width:180px;">',
                                '<div style="font-weight:bold; color:#00e676; font-size:13px; margin-bottom:2px; word-break:break-word;">',
                                    (isCard ? '💳 كارت: ' : '👤 ') + displayName,
                                '</div>',
                                '<div style="display:flex; flex-wrap:wrap; gap:4px 8px; align-items:center; font-size:11px; margin-bottom:2px;">',
                                    info.profile ? '<span style="color:#69f0ae; font-weight:500;">📦 ' + info.profile + '</span>' : '',
                                    balanceHtml,
                                    loanHtml,
                                '</div>',
                                '<div style="display:flex; flex-wrap:wrap; gap:4px 8px; align-items:center; font-size:11px; margin-bottom:2px;">',
                                    quotaHtml,
                                    daysHtml,
                                '</div>',
                                '<div style="display:flex; flex-wrap:wrap; gap:4px 8px; align-items:center; font-size:10px; color:#b0bec5;">',
                                    info.ip ? '<span style="color:#80deea; font-family:monospace;">🌐 ' + info.ip + '</span>' : '',
                                    info.session ? '<span style="color:#cfd8dc;">⏱ ' + formatSession(info.session) + '</span>' : '',
                                '</div>',
                            '</div>'
                        ].join('');
                    }

                    var macCell = cells[macCellIndex];
                    var existingBadge = macCell.querySelector('.sas-badge-icon');
                    if (existingBadge) existingBadge.remove();
                    var badge = document.createElement('span');
                    badge.className = 'sas-badge-icon';
                    badge.style.cssText = 'display:inline-block; margin-left:6px; font-size:10px; background:#00c853; color:#000; padding:1px 4px; border-radius:3px; font-weight:bold;';
                    badge.textContent = 'SAS ✓';
                    macCell.appendChild(badge);
                } else {
                    // Unregistered / Guest / Disconnected indicator
                    if (hostCell) {
                        if (!hostCell.hasAttribute('data-orig-content')) {
                            hostCell.setAttribute('data-orig-content', hostCell.innerHTML);
                        }
                        var unregKey = matchedMac + '_unreg_' + currentStatus;
                        if (hostCell.getAttribute('data-sas-done') !== unregKey) {
                            hostCell.setAttribute('data-sas-done', unregKey);
                            if (currentStatus === 'offline') {
                                hostCell.innerHTML = '<div style="text-align:right; font-family:sans-serif;"><span style="color:#ff5252; font-size:10px; background:rgba(255,82,82,0.12); border:1px solid #ff5252; border-radius:3px; padding:2px 6px; font-weight:bold;">الريديس غير متصل 🔴</span></div>';
                            } else if (currentStatus === 'disabled') {
                                hostCell.innerHTML = '<div style="text-align:right; font-family:sans-serif;"><span style="color:#ffb74d; font-size:10px; background:rgba(255,183,77,0.12); border:1px solid #ffb74d; border-radius:3px; padding:2px 6px;">مزامنة الريديس معطلة ⏸</span></div>';
                            } else {
                                hostCell.innerHTML = '<div style="text-align:right; font-family:sans-serif;"><span style="color:#b0bec5; font-size:10px; background:rgba(255,255,255,0.06); border:1px dashed rgba(255,255,255,0.25); border-radius:3px; padding:2px 6px;" title="الريديس متصل، ولكن هذا الماك غير مسجل في سيرفر الساس أو لم يسجل دخوله بعد">غير مسجل بالريديس ⚪</span></div>';
                            }
                        }
                    }

                    var macCell = cells[macCellIndex];
                    var existingBadge = macCell.querySelector('.sas-badge-icon');
                    if (existingBadge) existingBadge.remove();
                    var badge = document.createElement('span');
                    badge.className = 'sas-badge-icon';
                    if (currentStatus === 'offline') {
                        badge.style.cssText = 'display:inline-block; margin-left:6px; font-size:10px; background:rgba(255,82,82,0.2); color:#ff5252; padding:1px 4px; border-radius:3px; border:1px solid #ff5252; font-weight:bold;';
                        badge.textContent = 'OFFLINE ❌';
                    } else if (currentStatus === 'disabled') {
                        badge.style.cssText = 'display:inline-block; margin-left:6px; font-size:10px; background:rgba(255,183,77,0.15); color:#ffb74d; padding:1px 4px; border-radius:3px; border:1px solid #ffb74d;';
                        badge.textContent = 'معطل';
                    } else {
                        badge.style.cssText = 'display:inline-block; margin-left:6px; font-size:10px; background:rgba(255,255,255,0.08); color:#b0bec5; padding:1px 4px; border-radius:3px; border:1px solid rgba(255,255,255,0.15);';
                        badge.textContent = 'غير مسجل';
                    }
                    macCell.appendChild(badge);
                }
            }
        }
    }

    function fetchFreshData() {
        if (isFetching) return;
        isFetching = true;

        fetch('/cgi-bin/horus_mac_data?_=' + Date.now())
            .then(function(r) { return r.json(); })
            .then(function(raw) {
                isFetching = false;
                currentStatus = raw.status || (Array.isArray(raw.data) && raw.data.length > 0 ? 'online' : 'disabled');
                
                if (currentStatus === 'disabled') {
                    cachedMap = {};
                    cachedMapByIp = {};
                    injectAll();
                    return;
                }

                if (currentStatus === 'offline' && (!raw.data || raw.data.length === 0)) {
                    cachedMap = {};
                    cachedMapByIp = {};
                    injectAll();
                    return;
                }

                var res = buildMacMap(raw);
                if (res && res.macMap) {
                    for (var m in res.macMap) {
                        cachedMap[m] = res.macMap[m];
                    }
                    for (var ip in res.ipMap) {
                        cachedMapByIp[ip] = res.ipMap[ip];
                    }
                }
                injectAll();
            })
            .catch(function() {
                isFetching = false;
            });
    }

    // Hook LuCI's cbi_update_table for synchronous 0-flicker updates
    function attachHook() {
        if (window.cbi_update_table && !window._cbi_hooked) {
            window._cbi_hooked = true;
            var orig = window.cbi_update_table;
            window.cbi_update_table = function() {
                var res = orig.apply(this, arguments);
                injectAll();
                return res;
            };
        }
    }

    // Run hook & sync
    attachHook();
    fetchFreshData();
    injectAll();

    // Instantaneous DOM MutationObserver for 0ms flicker-free injection on LuCI table updates
    if (window.MutationObserver) {
        var obsTimeout = null;
        var observer = new MutationObserver(function() {
            if (!obsTimeout) {
                obsTimeout = setTimeout(function() {
                    obsTimeout = null;
                    injectAll();
                }, 50);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // Regular checks
    setInterval(attachHook, 500);
    setInterval(injectAll, 200);
    setInterval(fetchFreshData, 3000); // Live poll from local router every 3 seconds
})();
