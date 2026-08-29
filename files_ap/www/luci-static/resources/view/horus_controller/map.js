'use strict';
'require view';
'require dom';
'require ui';
'require horus_controller.styles as horusStyles';
'require horus_controller.i18n as horusI18n';
'require horus_controller.bulk as horusBulk';
'require horus_controller.detail as horusDetail';
'require horus_controller.groups as horusGroups';

return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	render: function() {
		var container = E('div', {
			class: 'horus-wlc-container',
			id: 'horus-wlc-root',
			style: 'direction:' + horusI18n.getDir() + '; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;'
		});
		container.appendChild(horusStyles.getStyles());

		// Header Bar with Navigation Tabs and Language Switcher
		var tabsNav = E('div', { class: 'horus-tabs', style: 'display:flex; justify-content:space-between; align-items:flex-end;' });
		
		var tabsLeft = E('div', { style: 'display:flex; gap:8px;' });
		var tabDash = E('div', { class: 'horus-tab active' }, horusI18n.t('wlc_dashboard'));
		var tabGroups = E('div', { class: 'horus-tab' }, horusI18n.t('ap_groups'));
		tabsLeft.appendChild(tabDash);
		tabsLeft.appendChild(tabGroups);

		var langBtn = horusI18n.buildLangBtn(function(newLang) {
			container.style.direction = horusI18n.getDir();
			tabDash.textContent = horusI18n.t('wlc_dashboard');
			tabGroups.textContent = horusI18n.t('ap_groups');
			renderDashboard();
			if (state.currentDetailApMac && !viewApDetail.classList.contains('hidden')) {
				openApDetailView(state.currentDetailApMac);
			}
		});

		tabsNav.appendChild(tabsLeft);
		tabsNav.appendChild(E('div', { style: 'margin-bottom:8px;' }, langBtn));
		container.appendChild(tabsNav);

		// View Containers
		var viewDash = E('div', { id: 'view-dash' });
		var viewGroups = E('div', { id: 'view-groups', class: 'hidden' });
		var viewApDetail = E('div', { id: 'view-ap-detail', class: 'hidden' });
		container.appendChild(viewDash);
		container.appendChild(viewGroups);
		container.appendChild(viewApDetail);

		tabDash.onclick = function() {
			tabDash.className = 'horus-tab active';
			tabGroups.className = 'horus-tab';
			viewDash.classList.remove('hidden');
			viewGroups.classList.add('hidden');
			viewApDetail.classList.add('hidden');
			state.currentDetailApMac = null;
		};

		tabGroups.onclick = function() {
			tabGroups.className = 'horus-tab active';
			tabDash.className = 'horus-tab';
			viewGroups.classList.remove('hidden');
			viewDash.classList.add('hidden');
			viewApDetail.classList.add('hidden');
			state.currentDetailApMac = null;
		};

		// 1. Dashboard View Top Cards (Built once, updated in-place)
		var cardTotalH3 = E('h3', {}, '0');
		var cardOnlineH3 = E('h3', {}, '0');
		var cardOfflineH3 = E('h3', {}, '0');
		var cardClientsH3 = E('h3', {}, '0');

		var cardTotalLabel = E('p', {}, horusI18n.t('total_aps'));
		var cardOnlineLabel = E('p', {}, horusI18n.t('online'));
		var cardOfflineLabel = E('p', {}, horusI18n.t('offline'));
		var cardClientsLabel = E('p', {}, horusI18n.t('connected_clients'));

		var cardsDiv = E('div', { class: 'dash-cards' }, [
			E('div', { class: 'dash-card total' }, [ cardTotalH3, cardTotalLabel ]),
			E('div', { class: 'dash-card online' }, [ cardOnlineH3, cardOnlineLabel ]),
			E('div', { class: 'dash-card offline' }, [ cardOfflineH3, cardOfflineLabel ]),
			E('div', { class: 'dash-card clients' }, [ cardClientsH3, cardClientsLabel ])
		]);
		viewDash.appendChild(cardsDiv);

		// Bulk Bar
		var bulkBar = E('div', { class: 'bulk-bar hidden' });
		var bulkTitle = E('div', { class: 'bulk-title' }, horusI18n.t('bulk_title', { n: 0 }));
		var bulkActions = E('div', { class: 'bulk-actions' });

		var btnBulkWifi = E('button', { class: 'btn-bulk btn-bulk-wifi' }, horusI18n.t('bulk_wifi'));
		var btnBulkPass = E('button', { class: 'btn-bulk btn-bulk-pass' }, horusI18n.t('bulk_pass'));
		var btnBulkReboot = E('button', { class: 'btn-bulk btn-bulk-reboot' }, horusI18n.t('bulk_reboot'));
		var btnBulkRadioOff = E('button', { class: 'btn-bulk btn-bulk-off' }, horusI18n.t('bulk_radio_off'));
		var btnBulkRadioOn = E('button', { class: 'btn-bulk btn-bulk-on' }, horusI18n.t('bulk_radio_on'));

		bulkActions.appendChild(btnBulkWifi);
		bulkActions.appendChild(btnBulkPass);
		bulkActions.appendChild(btnBulkReboot);
		bulkActions.appendChild(btnBulkRadioOff);
		bulkActions.appendChild(btnBulkRadioOn);
		bulkBar.appendChild(bulkTitle);
		bulkBar.appendChild(bulkActions);
		viewDash.appendChild(bulkBar);

		// Filter Toolbar
		var toolbar = E('div', { class: 'toolbar' });
		var searchInput = E('input', { type: 'text', placeholder: horusI18n.t('search_placeholder') });
		var filterSelect = E('select', {}, [
			E('option', { value: 'all' }, horusI18n.t('all_aps')),
			E('option', { value: 'online' }, horusI18n.t('online_only')),
			E('option', { value: 'offline' }, horusI18n.t('offline_only'))
		]);
		toolbar.appendChild(searchInput);
		toolbar.appendChild(filterSelect);
		viewDash.appendChild(toolbar);

		// Main Table Thead Headers
		var thStatus = E('th', { style: 'width:100px;' }, horusI18n.t('status'));
		var thHostname = E('th', {}, horusI18n.t('ap_name_host'));
		var thIpMac = E('th', {}, horusI18n.t('ip_mac'));
		var thSpeed = E('th', {}, horusI18n.t('live_speed'));
		var thHw = E('th', {}, horusI18n.t('hw_health'));
		var thClients = E('th', {}, horusI18n.t('clients_col'));
		var thWifi = E('th', {}, horusI18n.t('active_wifi'));
		var thActions = E('th', { style: 'text-align: center;' }, horusI18n.t('actions'));

		var cbSelectAll = E('input', { type: 'checkbox', style: 'width:18px; height:18px; cursor:pointer; accent-color:#00e676;' });
		var tableBody = E('tbody');
		var tableWrapper = E('div', { class: 'table-box' }, [
			E('table', { class: 'custom-table' }, [
				E('thead', {}, [
					E('tr', {}, [
						E('th', { style: 'width:40px; text-align:center;' }, cbSelectAll),
						thStatus,
						thHostname,
						thIpMac,
						thSpeed,
						thHw,
						thClients,
						thWifi,
						thActions
					])
				]),
				tableBody
			])
		]);
		viewDash.appendChild(tableWrapper);

		// State Object
		var state = {
			data: { aps: {}, clients: {} },
			radiusMap: {},
			groups: [],
			assignments: {},
			selectedAps: new Set(),
			currentDetailApMac: null
		};

		// 2. Groups View Initialization
		var groupsComponent = horusGroups.buildGroupsSection(state, fetchNetworkData, ui);
		viewGroups.appendChild(groupsComponent.formEl);
		viewGroups.appendChild(groupsComponent.tableEl);

		function openApDetailView(apMac) {
			state.currentDetailApMac = apMac;
			viewDash.classList.add('hidden');
			viewGroups.classList.add('hidden');
			viewApDetail.classList.remove('hidden');
			horusDetail.buildApDetailView(apMac, state, viewApDetail, function() {
				state.currentDetailApMac = null;
				viewApDetail.classList.add('hidden');
				viewDash.classList.remove('hidden');
			}, ui);
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}

		function createApTableRow(ap) {
			var isSelected = state.selectedAps.has(ap.mac);
			var rowCb = E('input', { type: 'checkbox', class: 'ap-row-cb', style: 'width:18px; height:18px; cursor:pointer; accent-color:#00e676;' });
			rowCb.checked = isSelected;

			var tr = E('tr', { 'data-mac': ap.mac, class: isSelected ? 'selected' : '' });

			rowCb.onchange = function() {
				if (rowCb.checked) state.selectedAps.add(ap.mac);
				else state.selectedAps.delete(ap.mac);
				tr.className = rowCb.checked ? 'selected' : '';
				horusBulk.updateBulkBar(state, bulkBar, bulkTitle);
			};

			var dot = E('span', { class: 'live-ap-dot status-dot ' + (ap.isOnline ? 'status-online' : 'status-offline') });
			var statusText = E('span', { class: 'live-ap-status-text' }, ap.isOnline ? horusI18n.t('online') : horusI18n.t('offline'));

			var wifiPills = [];
			if (ap.wifi && ap.wifi.length > 0) {
				ap.wifi.forEach(function(w) {
					var is5G = (w.band_code === '5g' || w.band === '5GHz' || w.channel >= 36);
					var bColor = is5G ? '#38bdf8' : '#4ade80';
					var bIcon = is5G ? '⚡' : '📶';
					var bLabel = is5G ? '5G' : '2.4G';
					var bChan = (w.channel || 'Auto');
					wifiPills.push(E('div', { class: 'ap-wifi-pill' }, [
						E('span', { style: 'color:' + bColor + '; font-weight:800;' }, bIcon + ' ' + bLabel + ' (' + bChan + '):'),
						E('span', { style: 'color:#f8fafc; font-weight:600;' }, w.ssid || '-')
					]));
				});
			}
			var wifiBox = E('div', { class: 'ap-wifi-box live-ap-wifi-box' }, wifiPills.length > 0 ? wifiPills : [E('span', { style: 'color:#64748b;' }, '-')]);

			var btnManage = E('button', { class: 'btn-ctrl btn-ctrl-steer', style: 'padding: 7px 14px; font-size: 12px;' }, horusI18n.t('manage'));
			btnManage.onclick = function() { openApDetailView(ap.mac); };

			var btnReboot = E('button', { class: 'btn-ctrl btn-ctrl-kick', style: 'padding: 7px 14px; font-size: 12px;' }, horusI18n.t('reboot'));
			btnReboot.onclick = function() {
				if (confirm('Reboot AP (' + ap.mac + ')?')) {
					fetch('/cgi-bin/horus_ap_action', { method: 'POST', body: JSON.stringify({ target_ap: ap.mac, action: 'reboot' }) });
					ui.addNotification(null, E('p', 'Reboot command dispatched.'));
				}
			};

			var actionBox = E('div', { class: 'ap-action-group' }, [btnManage, btnReboot]);

			var pillWifi = E('span', { class: 'pill-wifi live-pill-wifi' }, '📶 ' + ap.clients + ' ' + horusI18n.t('wireless_clients'));
			var pillWired = E('span', { class: 'pill-wired live-pill-wired', style: ap.wired > 0 ? '' : 'display:none;' }, '🔌 ' + ap.wired + ' ' + horusI18n.t('wired_clients'));
			var clientBox = E('div', { class: 'ap-clients-box' }, [ pillWifi, pillWired ]);

			var hwCpuB = E('b', { class: 'live-hw-cpu', style: 'color:#38bdf8;' }, ap.stats.cpu_load || '0.0');
			var hwTempDiv = E('div', { class: 'live-hw-temp-row', style: (ap.stats.cpu_temp && ap.stats.cpu_temp !== '-') ? 'display:flex; justify-content:space-between; gap:6px;' : 'display:none;' }, [
				E('span', {}, '🌡️ ' + horusI18n.t('temp') + ':'),
				E('b', { class: 'live-hw-temp', style: 'color:#f87171;' }, ap.stats.cpu_temp || '')
			]);
			var hwRamB = E('b', { class: 'live-hw-ram', style: 'color:#4ade80;' }, (ap.stats.mem_pct || 0) + '%');

			var hwBox = E('div', { class: 'ap-hw-box' }, [
				E('div', { style: 'display:flex; justify-content:space-between; gap:6px;' }, [ E('span', {}, '🧠 ' + horusI18n.t('cpu') + ':'), hwCpuB ]),
				hwTempDiv,
				E('div', { style: 'display:flex; justify-content:space-between; gap:6px;' }, [ E('span', {}, '💾 ' + horusI18n.t('ram') + ':'), hwRamB ])
			]);

			var speedRxSpan = E('span', { class: 'live-ap-rx' }, ap.stats.rx_speed || '0 bps');
			var speedTxSpan = E('span', { class: 'live-ap-tx' }, ap.stats.tx_speed || '0 bps');

			var speedBox = E('div', { class: 'speed-meter-box', style: 'min-width:115px;' }, [
				E('div', { class: 'speed-meter-row rx' }, [ E('span', {}, '⬇️ ' + horusI18n.t('download') + ':'), speedRxSpan ]),
				E('div', { class: 'speed-meter-row tx' }, [ E('span', {}, '⬆️ ' + horusI18n.t('upload') + ':'), speedTxSpan ])
			]);

			dom.content(tr, [
				E('td', { style: 'text-align:center;' }, rowCb),
				E('td', { style: 'white-space:nowrap;' }, [dot, ' ', statusText]),
				E('td', { class: 'live-ap-host', style: 'font-weight:800; font-size:14px; color:#f8fafc;' }, ap.hostname),
				E('td', {}, [
					E('div', { class: 'live-ap-ip', style: 'color:#38bdf8; font-family:monospace; font-weight:800;' }, ap.ip),
					E('div', { style: 'font-family:monospace; font-size:11px; color:#94a3b8;' }, ap.mac)
				]),
				E('td', {}, speedBox),
				E('td', {}, hwBox),
				E('td', {}, clientBox),
				E('td', {}, wifiBox),
				E('td', { style: 'text-align:center;' }, actionBox)
			]);

			return tr;
		}

		function updateDashboardTableInPlace(processed) {
			var q = searchInput.value.toLowerCase().trim();
			var filtered = processed.filter(function(ap) {
				var matchSearch = (ap.mac.toLowerCase().indexOf(q) > -1) || 
								  (ap.hostname.toLowerCase().indexOf(q) > -1) || 
								  (ap.ip.toLowerCase().indexOf(q) > -1);
				var matchFilter = true;
				if (filterSelect.value === 'online' && !ap.isOnline) matchFilter = false;
				if (filterSelect.value === 'offline' && ap.isOnline) matchFilter = false;
				return matchSearch && matchFilter;
			});

			if (filtered.length === 0) {
				var emptyEl = tableBody.querySelector('.empty-ap-row');
				if (!emptyEl) {
					dom.content(tableBody, [
						E('tr', { class: 'empty-ap-row' }, E('td', { colspan: 9, style: 'text-align:center; padding: 25px; color: #64748b;' }, 'No matching APs found.'))
					]);
				}
				return;
			}

			var emptyRow = tableBody.querySelector('.empty-ap-row');
			if (emptyRow) emptyRow.remove();

			var activeMacSet = new Set();

			filtered.forEach(function(ap) {
				activeMacSet.add(ap.mac);
				var existingRow = tableBody.querySelector('tr[data-mac="' + ap.mac + '"]');

				if (existingRow) {
					// In-place Update (Zero flicker)
					var dot = existingRow.querySelector('.live-ap-dot');
					if (dot) dot.className = 'live-ap-dot status-dot ' + (ap.isOnline ? 'status-online' : 'status-offline');

					var stText = existingRow.querySelector('.live-ap-status-text');
					var nStText = ap.isOnline ? horusI18n.t('online') : horusI18n.t('offline');
					if (stText && stText.textContent !== nStText) stText.textContent = nStText;

					var hostEl = existingRow.querySelector('.live-ap-host');
					if (hostEl && hostEl.textContent !== ap.hostname) hostEl.textContent = ap.hostname;

					var ipEl = existingRow.querySelector('.live-ap-ip');
					if (ipEl && ipEl.textContent !== ap.ip) ipEl.textContent = ap.ip;

					var rxEl = existingRow.querySelector('.live-ap-rx');
					var nRx = ap.stats.rx_speed || '0 bps';
					if (rxEl && rxEl.textContent !== nRx) rxEl.textContent = nRx;

					var txEl = existingRow.querySelector('.live-ap-tx');
					var nTx = ap.stats.tx_speed || '0 bps';
					if (txEl && txEl.textContent !== nTx) txEl.textContent = nTx;

					var cpuEl = existingRow.querySelector('.live-hw-cpu');
					var nCpu = ap.stats.cpu_load || '0.0';
					if (cpuEl && cpuEl.textContent !== nCpu) cpuEl.textContent = nCpu;

					var ramEl = existingRow.querySelector('.live-hw-ram');
					var nRam = (ap.stats.mem_pct || 0) + '%';
					if (ramEl && ramEl.textContent !== nRam) ramEl.textContent = nRam;

					var pWifi = existingRow.querySelector('.live-pill-wifi');
					var nWifi = '📶 ' + ap.clients + ' ' + horusI18n.t('wireless_clients');
					if (pWifi && pWifi.textContent !== nWifi) pWifi.textContent = nWifi;

					var pWired = existingRow.querySelector('.live-pill-wired');
					if (pWired) {
						if (ap.wired > 0) {
							pWired.style.display = '';
							pWired.textContent = '🔌 ' + ap.wired + ' ' + horusI18n.t('wired_clients');
						} else {
							pWired.style.display = 'none';
						}
					}
				} else {
					tableBody.appendChild(createApTableRow(ap));
				}
			});

			var currentRows = tableBody.querySelectorAll('tr[data-mac]');
			currentRows.forEach(function(r) {
				var rMac = r.getAttribute('data-mac');
				if (rMac && !activeMacSet.has(rMac)) {
					r.remove();
				}
			});
		}

		function fetchNetworkData() {
			Promise.all([
				fetch('/cgi-bin/horus_map_data?_=' + Date.now()).then(function(r){ return r.json(); }).catch(function(){ return {}; }),
				fetch('/cgi-bin/horus_mac_data?_=' + Date.now()).then(function(r){ return r.json(); }).catch(function(){ return {}; }),
				fetch('/cgi-bin/horus_groups?_=' + Date.now()).then(function(r){ return r.json(); }).catch(function(){ return {}; })
			]).then(function(results) {
				var mapData = results[0] || {};
				var radiusData = results[1] || {};
				var groupData = results[2] || {};

				state.data = mapData;
				state.groups = groupData.groups || [];
				state.assignments = groupData.assignments || {};

				state.radiusMap = {};
				var radList = radiusData.data || [];
				if (Array.isArray(radList)) {
					radList.forEach(function(u) {
						var m = (u.mac || '').toUpperCase().trim();
						if (m) state.radiusMap[m] = u;
					});
				}

				renderDashboard();
				horusGroups.renderGroupsTable(state, groupsComponent.tbodyEl, fetchNetworkData);

				if (state.currentDetailApMac && !viewApDetail.classList.contains('hidden')) {
					var updated = horusDetail.updateApDetailLive(state.currentDetailApMac, state, ui);
					if (!updated) {
						horusDetail.buildApDetailView(state.currentDetailApMac, state, viewApDetail, function() {
							state.currentDetailApMac = null;
							viewApDetail.classList.add('hidden');
							viewDash.classList.remove('hidden');
						}, ui);
					}
				}
			});
		}

		// Bulk Button Bindings
		btnBulkWifi.onclick = function() { horusBulk.openBulkWifiModal(state, ui); };
		btnBulkPass.onclick = function() { horusBulk.openBulkPassModal(state, ui); };
		btnBulkReboot.onclick = function() { horusBulk.runBulkHardware('Reboot', 'reboot', state, ui); };
		btnBulkRadioOff.onclick = function() { horusBulk.runBulkHardware('Turn off WiFi', 'wifi_radio', state, ui, '1'); };
		btnBulkRadioOn.onclick = function() { horusBulk.runBulkHardware('Turn on WiFi', 'wifi_radio', state, ui, '0'); };

		cbSelectAll.onchange = function() {
			var isChecked = cbSelectAll.checked;
			var aps = state.data.aps || {};
			state.selectedAps.clear();
			if (isChecked) {
				Object.keys(aps).forEach(function(m){ state.selectedAps.add(m); });
			}
			tableBody.querySelectorAll('tr[data-mac]').forEach(function(tr){
				var cb = tr.querySelector('.ap-row-cb');
				if (cb) cb.checked = isChecked;
				tr.className = isChecked ? 'selected' : '';
			});
			horusBulk.updateBulkBar(state, bulkBar, bulkTitle);
		};

		function renderDashboard() {
			var aps = state.data.aps || {};
			var apKeys = Object.keys(aps);
			var total = apKeys.length;
			var online = 0, offline = 0, totalClients = 0;
			var refTime = state.data.router_time || Math.floor(Date.now() / 1000);
			var processed = [];

			apKeys.forEach(function(mac) {
				var ap = aps[mac];
				var isOnline = Math.abs(refTime - (ap.last_seen || 0)) < 35;
				if (isOnline) online++; else offline++;
				var cCount = ap.clients ? ap.clients.length : 0;
				totalClients += cCount;

				var wiredCount = 0;
				if (ap.ports) {
					ap.ports.forEach(function(p){ wiredCount += (p.clients ? p.clients.length : 0); });
				}

				var gName = '-';
				var gId = state.assignments[mac];
				if (gId) {
					var g = state.groups.find(function(x) { return x.id === gId; });
					if (g) gName = g.name;
				}

				processed.push({
					mac: mac,
					hostname: ap.hostname || 'Horus-AP',
					ip: ap.ip || '-',
					group: gName,
					clients: cCount,
					wired: wiredCount,
					isOnline: isOnline,
					wifi: ap.wifi || [],
					stats: ap.stats || {}
				});
			});

			// Update Summary Cards smoothly in-place
			if (cardTotalH3.textContent !== total.toString()) cardTotalH3.textContent = total;
			if (cardOnlineH3.textContent !== online.toString()) cardOnlineH3.textContent = online;
			if (cardOfflineH3.textContent !== offline.toString()) cardOfflineH3.textContent = offline;
			if (cardClientsH3.textContent !== totalClients.toString()) cardClientsH3.textContent = totalClients;

			cardTotalLabel.textContent = horusI18n.t('total_aps');
			cardOnlineLabel.textContent = horusI18n.t('online');
			cardOfflineLabel.textContent = horusI18n.t('offline');
			cardClientsLabel.textContent = horusI18n.t('connected_clients');

			thStatus.textContent = horusI18n.t('status');
			thHostname.textContent = horusI18n.t('ap_name_host');
			thIpMac.textContent = horusI18n.t('ip_mac');
			thSpeed.textContent = horusI18n.t('live_speed');
			thHw.textContent = horusI18n.t('hw_health');
			thClients.textContent = horusI18n.t('clients_col');
			thWifi.textContent = horusI18n.t('active_wifi');
			thActions.textContent = horusI18n.t('actions');

			updateDashboardTableInPlace(processed);
			horusBulk.updateBulkBar(state, bulkBar, bulkTitle);
		}

		searchInput.oninput = function() {
			renderDashboard();
		};
		filterSelect.onchange = function() {
			tableBody.innerHTML = '';
			renderDashboard();
		};

		fetchNetworkData();
		setInterval(fetchNetworkData, 4000);

		return container;
	}
});
