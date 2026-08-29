'use strict';
'require view';
'require ui';
'require dom';
'require horus_controller.i18n as horusI18n';

return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	render: function() {
		var container = E('div', {
			class: 'horus-ban-view',
			style: 'direction:' + horusI18n.getDir() + '; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;'
		});

		// Professional Dark/Glassmorphism Theme Styles
		var styles = E('style', {}, `
			#maincontent { max-width: 98% !important; width: 98% !important; margin: 0 auto !important; padding: 10px !important; }
			.horus-ban-view { color: #f8fafc; width: 100% !important; max-width: 100% !important; box-sizing: border-box; }
			.glass-card { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 22px; margin-bottom: 22px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4); width: 100%; box-sizing: border-box; }
			.card-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 14px; margin-bottom: 20px; }
			.card-title { font-size: 18px; font-weight: 700; color: #00e676; margin: 0; display: flex; align-items: center; gap: 8px; }
			.card-desc { font-size: 13px; color: #94a3b8; margin: 4px 0 0 0; }
			
			.horus-tabs { display: flex; border-bottom: 2px solid rgba(255,255,255,0.1); margin-bottom: 20px; gap: 8px; }
			.horus-tab { padding: 12px 24px; cursor: pointer; font-size: 14px; font-weight: 700; color: #94a3b8; background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255,255,255,0.08); border-bottom: none; border-radius: 10px 10px 0 0; transition: all 0.2s; }
			.horus-tab.active { background: rgba(30, 41, 59, 0.9); color: #00e676; border-color: rgba(0, 230, 118, 0.4); border-bottom: 2px solid #00e676; margin-bottom: -2px; }
			.horus-tab:hover:not(.active) { background: rgba(51, 65, 85, 0.5); color: #f8fafc; }
			
			.form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 16px; }
			.form-group { display: flex; flex-direction: column; gap: 6px; }
			.form-label { font-size: 13px; font-weight: 600; color: #cbd5e1; display: flex; align-items: center; gap: 6px; }
			.form-control { background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 10px 14px; color: #f8fafc; font-size: 14px; outline: none; transition: all 0.2s; }
			.form-control:focus { border-color: #00e676; box-shadow: 0 0 0 3px rgba(0, 230, 118, 0.2); }
			.form-control option { background: #0f172a; color: #f8fafc; }
			
			/* AP Selection Grid */
			.ap-select-box { background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 16px; margin-bottom: 16px; }
			.ap-select-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px; }
			.ap-select-title { font-size: 14px; font-weight: bold; color: #38bdf8; display: flex; align-items: center; gap: 6px; }
			.ap-tools { display: flex; gap: 8px; }
			.btn-tool { padding: 4px 12px; font-size: 12px; font-weight: 600; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.05); color: #cbd5e1; cursor: pointer; transition: 0.2s; }
			.btn-tool:hover { background: rgba(255,255,255,0.15); color: #fff; }
			
			.ap-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; max-height: 200px; overflow-y: auto; padding: 4px; }
			.ap-tile { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; cursor: pointer; transition: all 0.2s; user-select: none; }
			.ap-tile:hover { background: rgba(51, 65, 85, 0.6); border-color: rgba(255, 255, 255, 0.25); transform: translateY(-1px); }
			.ap-tile.selected { background: rgba(0, 230, 118, 0.12); border-color: #00e676; box-shadow: 0 0 10px rgba(0, 230, 118, 0.15); }
			.ap-tile input[type="checkbox"] { width: 18px; height: 18px; accent-color: #00e676; cursor: pointer; }
			.ap-tile-info { display: flex; flex-direction: column; gap: 2px; }
			.ap-tile-name { font-size: 13px; font-weight: 700; color: #f8fafc; }
			.ap-tile-sub { font-size: 11px; color: #94a3b8; font-family: monospace; }
			
			/* Buttons */
			.btn-primary { padding: 10px 22px; background: linear-gradient(135deg, #00e676 0%, #00b0ff 100%); color: #000; border: none; border-radius: 8px; font-weight: 800; cursor: pointer; font-size: 14px; transition: all 0.2s; }
			.btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 15px rgba(0, 230, 118, 0.3); }
			.btn-unban { padding: 6px 14px; background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.4); border-radius: 6px; font-weight: 700; font-size: 12px; cursor: pointer; transition: 0.2s; white-space: nowrap; }
			.btn-unban:hover { background: #22c55e; color: #000; }
			
			/* Tables */
			.table-box { background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; overflow-x: auto; width: 100%; box-sizing: border-box; }
			.custom-table { width: 100%; border-collapse: collapse; text-align: right; }
			.custom-table th { background: rgba(30, 41, 59, 0.8); padding: 14px 16px; font-size: 13px; font-weight: 700; color: #94a3b8; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
			.custom-table td { padding: 14px 16px; font-size: 13px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); color: #e2e8f0; }
			.custom-table tr:hover td { background: rgba(255, 255, 255, 0.03); }
			
			.badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
			.badge-danger { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
			.badge-warning { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
			.badge-success { background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); }
			.badge-info { background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); }
			
			.hidden { display: none !important; }
		`);
		container.appendChild(styles);

		// Navigation Tabs with Language Switcher
		var tabsNav = E('div', { class: 'horus-tabs', style: 'display:flex; justify-content:space-between; align-items:flex-end;' });
		var tabsLeft = E('div', { style: 'display:flex; gap:8px;' });
		var tabBanned = E('div', { class: 'horus-tab active' }, horusI18n.t('banned_registry'));
		var tabSpoofLogs = E('div', { class: 'horus-tab' }, horusI18n.t('spoof_audit'));
		var tabRoamLogs = E('div', { class: 'horus-tab' }, horusI18n.t('roam_log'));
		tabsLeft.appendChild(tabBanned);
		tabsLeft.appendChild(tabSpoofLogs);
		tabsLeft.appendChild(tabRoamLogs);

		var langBtn = horusI18n.buildLangBtn(function() {
			container.style.direction = horusI18n.getDir();
			tabBanned.textContent = horusI18n.t('banned_registry');
			tabSpoofLogs.textContent = horusI18n.t('spoof_audit');
			tabRoamLogs.textContent = horusI18n.t('roam_log');
			btnOpenBanModal.textContent = horusI18n.t('manual_ban');
			loadData();
		});

		tabsNav.appendChild(tabsLeft);
		tabsNav.appendChild(E('div', { style: 'margin-bottom:8px;' }, langBtn));
		container.appendChild(tabsNav);

		// Sections
		var secBanned = E('div', { id: 'sec-banned' });
		var secSpoofLogs = E('div', { id: 'sec-spoof-logs', class: 'hidden' });
		var secRoamLogs = E('div', { id: 'sec-roam-logs', class: 'hidden' });

		container.appendChild(secBanned);
		container.appendChild(secSpoofLogs);
		container.appendChild(secRoamLogs);

		tabBanned.onclick = function() {
			tabBanned.classList.add('active'); tabSpoofLogs.classList.remove('active'); tabRoamLogs.classList.remove('active');
			secBanned.classList.remove('hidden'); secSpoofLogs.classList.add('hidden'); secRoamLogs.classList.add('hidden');
		};
		tabSpoofLogs.onclick = function() {
			tabSpoofLogs.classList.add('active'); tabBanned.classList.remove('active'); tabRoamLogs.classList.remove('active');
			secSpoofLogs.classList.remove('hidden'); secBanned.classList.add('hidden'); secRoamLogs.classList.add('hidden');
		};
		tabRoamLogs.onclick = function() {
			tabRoamLogs.classList.add('active'); tabBanned.classList.remove('active'); tabSpoofLogs.classList.remove('active');
			secRoamLogs.classList.remove('hidden'); secBanned.classList.add('hidden'); secSpoofLogs.classList.add('hidden');
		};

		// State Object
		var state = {
			data: { aps: {}, clients: {}, banned: [], logs: [] },
			radiusMap: {},
			selectedAps: new Set(),
			knownAps: {}
		};

		// 1. BANNED SECTION - Clean Header & Popup Modal Trigger
		var btnOpenBanModal = E('button', {
			class: 'btn-primary',
			style: 'background:linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color:#fff; display:flex; align-items:center; gap:8px; font-weight:800; padding:10px 22px; font-size:14px;'
		}, [
			E('span', { style: 'font-size:16px;' }, '➕'),
			E('span', {}, horusI18n.t('manual_ban'))
		]);

		btnOpenBanModal.onclick = function() {
			openManualBanModal();
		};

		var headerBar = E('div', { class: 'glass-card', style: 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px; margin-bottom:18px; padding:18px 24px;' }, [
			E('div', {}, [
				E('h3', { style: 'margin:0; color:#fbbf24; font-size:18px; display:flex; align-items:center; gap:8px; font-weight:800;' }, horusI18n.t('banned_registry')),
				E('p', { style: 'margin:4px 0 0 0; font-size:13px; color:#94a3b8;' }, 'Horus WLC Centralized MAC Blacklist & Access Control.')
			]),
			btnOpenBanModal
		]);
		secBanned.appendChild(headerBar);

		var bannedTableBody = E('tbody');
		var bannedTableWrapper = E('div', { class: 'table-box' }, [
			E('table', { class: 'custom-table' }, [
				E('thead', {}, [
					E('tr', {}, [
						E('th', {}, 'MAC'),
						E('th', {}, 'Radius Name'),
						E('th', {}, 'Reason'),
						E('th', {}, 'Timestamp'),
						E('th', {}, 'Duration'),
						E('th', { style: 'text-align:center;' }, 'Actions')
					])
				]),
				bannedTableBody
			])
		]);
		secBanned.appendChild(bannedTableWrapper);

		// 2. SPOOF DETECTION LOGS SECTION
		var spoofTableBody = E('tbody');
		var spoofCard = E('div', { class: 'glass-card' }, [
			E('div', { class: 'card-header' }, [
				E('div', {}, [
					E('h3', { class: 'card-title', style: 'color:#f87171;' }, horusI18n.t('spoof_audit')),
					E('p', { class: 'card-desc' }, 'Real-time detection and mitigation of duplicate client MAC attacks.')
				])
			]),
			E('div', { class: 'table-box' }, [
				E('table', { class: 'custom-table' }, [
					E('thead', {}, [
						E('tr', {}, [
							E('th', {}, 'Time'),
							E('th', {}, 'MAC'),
							E('th', {}, 'Radius User'),
							E('th', {}, 'Event Details'),
							E('th', {}, 'Type'),
							E('th', { style: 'text-align:center;' }, 'Action')
						])
					]),
					spoofTableBody
				])
			])
		]);
		secSpoofLogs.appendChild(spoofCard);

		// 3. FAST ROAMING LOGS SECTION
		var roamTableBody = E('tbody');
		var roamCard = E('div', { class: 'glass-card' }, [
			E('div', { class: 'card-header' }, [
				E('div', {}, [
					E('h3', { class: 'card-title', style: 'color:#38bdf8;' }, horusI18n.t('roam_log')),
					E('p', { class: 'card-desc' }, 'Smooth client roam transitions between Access Points.')
				])
			]),
			E('div', { class: 'table-box' }, [
				E('table', { class: 'custom-table' }, [
					E('thead', {}, [
						E('tr', {}, [
							E('th', {}, 'Time'),
							E('th', {}, 'MAC'),
							E('th', {}, 'Radius User'),
							E('th', {}, 'Roam Trail')
						])
					]),
					roamTableBody
				])
			])
		]);
		secRoamLogs.appendChild(roamCard);

		// MODAL: Manual MAC Ban Dialog
		function openManualBanModal() {
			var inMac = E('input', { class: 'form-control', type: 'text', placeholder: 'AA:BB:CC:DD:EE:FF', style: 'font-family: monospace; text-transform: uppercase;' });
			var inDuration = E('select', { class: 'form-control' }, [
				E('option', { value: '0' }, '🔒 Permanent'),
				E('option', { value: '3600' }, '⏳ 1 Hour'),
				E('option', { value: '86400' }, '⏳ 24 Hours'),
				E('option', { value: '604800' }, '⏳ 7 Days')
			]);
			var inReason = E('input', { class: 'form-control', type: 'text', placeholder: 'Manual Ban / Network Policy' });

			var modalApGrid = E('div', { class: 'ap-grid' });
			var modalSelCountBadge = E('span', { style: 'color:#00e676; font-weight:bold; font-size:12px;' }, '');

			var modalSelectedAps = new Set();
			Object.keys(state.knownAps).forEach(function(m){ modalSelectedAps.add(m); });

			function updateModalCount() {
				modalSelCountBadge.textContent = '(' + modalSelectedAps.size + ' APs selected)';
			}

			function renderModalAps() {
				var tiles = [];
				var apKeys = Object.keys(state.knownAps);
				if (apKeys.length === 0) {
					tiles.push(E('div', { style: 'color:#94a3b8; font-size:13px; padding:10px;' }, 'Discovering APs via HMP...'));
				} else {
					apKeys.forEach(function(mac) {
						var ap = state.knownAps[mac];
						var isChecked = modalSelectedAps.has(mac);
						var tile = E('div', { class: isChecked ? 'ap-tile selected' : 'ap-tile' });
						var cb = E('input', { type: 'checkbox' });
						cb.checked = isChecked;

						tile.onclick = function(e) {
							if (e.target !== cb) cb.checked = !cb.checked;
							if (cb.checked) modalSelectedAps.add(mac);
							else modalSelectedAps.delete(mac);
							tile.className = cb.checked ? 'ap-tile selected' : 'ap-tile';
							updateModalCount();
						};

						tile.appendChild(cb);
						tile.appendChild(E('div', { class: 'ap-tile-info' }, [
							E('span', { class: 'ap-tile-name' }, '📡 ' + (ap.hostname || 'AP')),
							E('span', { class: 'ap-tile-sub' }, (ap.ip || '-') + ' | ' + mac)
						]));
						tiles.push(tile);
					});
				}
				dom.content(modalApGrid, tiles);
				updateModalCount();
			}

			var btnModalSelAll = E('button', { class: 'btn-tool', type: 'button' }, '✅ Select All');
			btnModalSelAll.onclick = function() {
				Object.keys(state.knownAps).forEach(function(m){ modalSelectedAps.add(m); });
				renderModalAps();
			};

			var btnModalDeselAll = E('button', { class: 'btn-tool', type: 'button' }, '❌ Deselect All');
			btnModalDeselAll.onclick = function() {
				modalSelectedAps.clear();
				renderModalAps();
			};

			renderModalAps();

			var modalBody = E('div', { style: 'direction:' + horusI18n.getDir() + '; text-align:' + (horusI18n.getDir() === 'rtl' ? 'right' : 'left') + '; color:#f8fafc;' }, [
				E('h3', { style: 'color:#ef4444; margin-top:0; display:flex; align-items:center; gap:8px;' }, '🛡️ Manual MAC Ban'),
				E('p', { style: 'font-size:13px; color:#cbd5e1;' }, 'Enter client MAC address and select target Access Points:'),
				E('div', { class: 'form-grid' }, [
					E('div', { class: 'form-group' }, [ E('label', { class: 'form-label' }, '📍 MAC Address:'), inMac ]),
					E('div', { class: 'form-group' }, [ E('label', { class: 'form-label' }, '⏳ Duration:'), inDuration ]),
					E('div', { class: 'form-group' }, [ E('label', { class: 'form-label' }, '📝 Reason:'), inReason ])
				]),
				E('div', { class: 'ap-select-box' }, [
					E('div', { class: 'ap-select-header' }, [
						E('div', { class: 'ap-select-title' }, [
							E('span', {}, '🎯 Target APs:'),
							modalSelCountBadge
						]),
						E('div', { class: 'ap-tools' }, [ btnModalSelAll, btnModalDeselAll ])
					]),
					modalApGrid
				])
			]);

			ui.showModal('Manual MAC Ban', [
				modalBody,
				E('div', { class: 'right', style: 'margin-top:18px; display:flex; gap:10px; justify-content:flex-end;' }, [
					E('button', { class: 'btn', click: ui.hideModal }, 'Cancel'),
					E('button', {
						class: 'btn primary',
						style: 'background:linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color:#fff; border:none;',
						click: function() {
							var rawMac = inMac.value.trim();
							var cleanMac = rawMac.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
							if (cleanMac.length !== 12) {
								alert('Please enter a valid 12-digit MAC address (e.g. AA:BB:CC:DD:EE:FF).');
								return;
							}
							var mac = cleanMac.match(/.{1,2}/g).join(':');

							if (modalSelectedAps.size === 0) {
								alert('Please select at least one target AP.');
								return;
							}

							var dur = parseInt(inDuration.value, 10);
							var rsn = inReason.value.trim() || 'Manual Admin Ban';
							var targetList = Array.from(modalSelectedAps);
							var isAll = (targetList.length === Object.keys(state.knownAps).length);

							ui.hideModal();
							fetch('/cgi-bin/horus_ban_action', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({
									action: 'ban',
									mac: mac,
									scope: isAll ? 'all' : targetList,
									duration: dur,
									reason: rsn
								})
							}).then(function(){
								ui.addNotification(null, E('p', '✅ Ban command dispatched for ' + mac));
								loadData();
							});
						}
					}, '🚫 Execute Ban Command')
				])
			]);
		}

		function loadData() {
			Promise.all([
				fetch('/cgi-bin/horus_map_data?_=' + Date.now()).then(function(r){ return r.json(); }).catch(function(){ return {}; }),
				fetch('/cgi-bin/horus_mac_data?_=' + Date.now()).then(function(r){ return r.json(); }).catch(function(){ return {}; })
			]).then(function(results) {
				var mapData = results[0] || {};
				var radiusData = results[1] || {};

				state.data = mapData;
				state.radiusMap = {};
				var radList = radiusData.data || [];
				if (Array.isArray(radList)) {
					radList.forEach(function(u) {
						var m = (u.mac || '').toUpperCase().trim();
						if (m) state.radiusMap[m] = u;
					});
				}

				if (mapData.aps) {
					state.knownAps = mapData.aps;
				}

				renderBannedTable();
				renderLogs();
			});
		}

		function renderBannedTable() {
			var bannedList = state.data.banned || [];
			var rows = [];

			if (bannedList.length === 0) {
				rows.push(E('tr', {}, E('td', { colspan: 6, style: 'text-align:center; padding: 25px; color:#64748b;' }, 'No banned devices currently.')));
			} else {
				bannedList.forEach(function(b) {
					var mac = (b.mac || '').toUpperCase();
					var rUser = state.radiusMap[mac] || {};
					var dispName = rUser.name || rUser.username || '-';

					var dateStr = b.banned_at ? new Date(b.banned_at * 1000).toLocaleString() : '-';
					var durStr = (b.duration === 0 || !b.duration) ? '🔒 Permanent' : Math.round(b.duration / 3600) + ' Hours';

					var btnUnban = E('button', { class: 'btn-unban' }, horusI18n.t('unban'));
					btnUnban.onclick = function() {
						if (confirm('Unban MAC (' + mac + ') on all APs?')) {
							fetch('/cgi-bin/horus_ban_action', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({ action: 'unban', mac: mac, scope: 'all' })
							}).then(function(){
								ui.addNotification(null, E('p', '✅ Unbanned MAC: ' + mac));
								loadData();
							});
						}
					};

					var btnAllowAp = E('button', { class: 'btn-unban', style: 'background:rgba(56,189,248,0.2); color:#38bdf8; border:1px solid rgba(56,189,248,0.4); margin-right:6px;' }, '🎯 Allow Home AP Only');
					btnAllowAp.onclick = function() {
						var apKeys = Object.keys(state.knownAps);
						if (apKeys.length === 0) { alert('No APs available'); return; }
						var apOptions = apKeys.map(function(k, idx){
							return (idx + 1) + '. ' + (state.knownAps[k].hostname || 'AP') + ' (' + (state.knownAps[k].ip || k) + ')';
						}).join('\n');
						var selIdx = prompt('Select AP number to whitelist for this subscriber:\n\n' + apOptions);
						if (selIdx) {
							var num = parseInt(selIdx, 10);
							if (num >= 1 && num <= apKeys.length) {
								var chosenAp = apKeys[num - 1];
								fetch('/cgi-bin/horus_ban_action', {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({ action: 'allow_on_ap', mac: mac, exempt_ap: chosenAp })
								}).then(function(){
									ui.addNotification(null, E('p', '✅ Client locked to designated AP.'));
									loadData();
								});
							}
						}
					};

					rows.push(E('tr', {}, [
						E('td', { style: 'font-family:monospace; font-weight:700; color:#f87171;' }, mac),
						E('td', { style: 'color:#00e676; font-weight:700;' }, dispName),
						E('td', {}, E('span', { class: 'badge badge-danger' }, b.reason || 'Manual Ban')),
						E('td', { style: 'font-size:12px; color:#94a3b8;' }, dateStr),
						E('td', {}, durStr),
						E('td', { style: 'text-align:center; display:flex; gap:6px; justify-content:center;' }, [btnUnban, btnAllowAp])
					]));
				});
			}
			dom.content(bannedTableBody, rows);
		}

		function renderLogs() {
			var logsList = state.data.logs || [];
			var spoofRows = [];
			var roamRows = [];

			logsList.forEach(function(l) {
				var mac = (l.mac || '').toUpperCase();
				var rUser = state.radiusMap[mac] || {};
				var dispName = rUser.name || rUser.username || '-';
				var timeStr = l.timestamp ? new Date(l.timestamp * 1000).toLocaleTimeString() : '-';

				if (l.type === 'spoof_ban' || l.type === 'spoof_warning' || l.type === 'ban') {
					var bType = l.type === 'spoof_ban' ? E('span', { class: 'badge badge-danger' }, '🔴 Spoof Ban') : (l.type === 'spoof_warning' ? E('span', { class: 'badge badge-warning' }, '🟡 Suspect') : E('span', { class: 'badge badge-info' }, 'Ban'));
					
					var btnQuickBan = E('button', { class: 'btn-tool', style: 'background:rgba(239,68,68,0.2); color:#f87171;' }, '🚫 Ban');
					btnQuickBan.onclick = function() {
						fetch('/cgi-bin/horus_ban_action', { method: 'POST', body: JSON.stringify({ action: 'ban', mac: mac, scope: 'all', duration: 0 }) }).then(loadData);
					};

					spoofRows.push(E('tr', {}, [
						E('td', { style: 'font-size:12px; color:#94a3b8;' }, timeStr),
						E('td', { style: 'font-family:monospace; font-weight:700; color:#38bdf8;' }, mac),
						E('td', { style: 'color:#00e676; font-weight:700;' }, dispName),
						E('td', {}, l.details || '-'),
						E('td', {}, bType),
						E('td', { style: 'text-align:center;' }, btnQuickBan)
					]));
				} else if (l.type === 'roam') {
					roamRows.push(E('tr', {}, [
						E('td', { style: 'font-size:12px; color:#94a3b8;' }, timeStr),
						E('td', { style: 'font-family:monospace; font-weight:700; color:#38bdf8;' }, mac),
						E('td', { style: 'color:#00e676; font-weight:700;' }, dispName),
						E('td', { style: 'color:#4ade80;' }, '🟢 ' + (l.details || '-'))
					]));
				}
			});

			if (spoofRows.length === 0) {
				spoofRows.push(E('tr', {}, E('td', { colspan: 6, style: 'text-align:center; padding:20px; color:#64748b;' }, 'No spoofing incidents detected.')));
			}
			if (roamRows.length === 0) {
				roamRows.push(E('tr', {}, E('td', { colspan: 4, style: 'text-align:center; padding:20px; color:#64748b;' }, 'No roam events recorded recently.')));
			}

			dom.content(spoofTableBody, spoofRows);
			dom.content(roamTableBody, roamRows);
		}

		loadData();
		setInterval(loadData, 4000);

		return container;
	}
});
