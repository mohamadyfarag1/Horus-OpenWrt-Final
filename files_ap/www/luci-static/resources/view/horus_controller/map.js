'use strict';
'require view';
'require dom';
'require ui';
'require horus_controller.styles as horusStyles';
'require horus_controller.bulk as horusBulk';
'require horus_controller.detail as horusDetail';
'require horus_controller.groups as horusGroups';

return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	render: function() {
		var styleHelper = new horusStyles();
		var bulkHelper = new horusBulk();
		var detailHelper = new horusDetail();
		var groupHelper = new horusGroups();

		var container = E('div', { class: 'horus-wlc-container', id: 'horus-wlc-root', style: 'direction:rtl; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;' });
		container.appendChild(styleHelper.getStyles());

		// Navigation Tabs
		var tabsNav = E('div', { class: 'horus-tabs' });
		var tabDash = E('div', { class: 'horus-tab active' }, '📊 لوحة التحكم والإكسسات (WLC Dashboard)');
		var tabGroups = E('div', { class: 'horus-tab' }, '📁 المجموعات والقوالب (AP Groups)');
		tabsNav.appendChild(tabDash);
		tabsNav.appendChild(tabGroups);
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

		// 1. Dashboard View Elements
		var cardsDiv = E('div', { class: 'dash-cards' });
		viewDash.appendChild(cardsDiv);

		// Bulk Bar
		var bulkBar = E('div', { class: 'bulk-bar hidden' });
		var bulkTitle = E('div', { class: 'bulk-title' }, '🎯 الإجراءات الجماعية:');
		var bulkActions = E('div', { class: 'bulk-actions' });

		var btnBulkWifi = E('button', { class: 'btn-bulk btn-bulk-wifi' }, '📶 تعديل الواي فاي');
		var btnBulkPass = E('button', { class: 'btn-bulk btn-bulk-pass' }, '🔐 تغيير الباسورد');
		var btnBulkReboot = E('button', { class: 'btn-bulk btn-bulk-reboot' }, '🔄 ريستارت');
		var btnBulkRadioOff = E('button', { class: 'btn-bulk btn-bulk-off' }, '📴 إيقاف الوايرليس');
		var btnBulkRadioOn = E('button', { class: 'btn-bulk btn-bulk-on' }, '✔️ تشغيل الوايرليس');

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
		var searchInput = E('input', { type: 'text', placeholder: '🔍 بحث بالاسم، الآي بي، أو عنوان الماك...' });
		var filterSelect = E('select', {}, [
			E('option', { value: 'all' }, 'جميع الإكسسات (All APs)'),
			E('option', { value: 'online' }, 'المتصلة فقط 🟢'),
			E('option', { value: 'offline' }, 'المفصولة فقط 🔴')
		]);
		toolbar.appendChild(searchInput);
		toolbar.appendChild(filterSelect);
		viewDash.appendChild(toolbar);

		// Main Table
		var cbSelectAll = E('input', { type: 'checkbox', style: 'width:18px; height:18px; cursor:pointer; accent-color:#00e676;' });
		var tableBody = E('tbody');
		var tableWrapper = E('div', { class: 'table-box' }, [
			E('table', { class: 'custom-table' }, [
				E('thead', {}, [
					E('tr', {}, [
						E('th', { style: 'width:40px; text-align:center;' }, cbSelectAll),
						E('th', { style: 'width:100px;' }, 'الحالة'),
						E('th', {}, 'اسم الإكسس / Hostname'),
						E('th', {}, 'عنوان الـ IP والماك'),
						E('th', {}, 'السرعة اللحظية الحالية'),
						E('th', {}, 'أداء المعالج والحرارة'),
						E('th', {}, 'المتصلين (وايرليس / كابل)'),
						E('th', {}, 'ترددات الواي فاي النشطة'),
						E('th', { style: 'text-align: center;' }, 'إجراءات وتحكم شامل')
					])
				]),
				tableBody
			])
		]);
		viewDash.appendChild(tableWrapper);

		// 2. Groups View Initialization
		var groupsComponent = groupHelper.buildGroupsSection(state, fetchNetworkData, ui);
		viewGroups.appendChild(groupsComponent.formEl);
		viewGroups.appendChild(groupsComponent.tableEl);

		// State Object
		var state = {
			data: { aps: {}, clients: {} },
			radiusMap: {},
			groups: [],
			assignments: {},
			selectedAps: new Set(),
			currentDetailApMac: null
		};

		function openApDetailView(apMac) {
			state.currentDetailApMac = apMac;
			viewDash.classList.add('hidden');
			viewGroups.classList.add('hidden');
			viewApDetail.classList.remove('hidden');
			detailHelper.buildApDetailView(apMac, state, viewApDetail, function() {
				state.currentDetailApMac = null;
				viewApDetail.classList.add('hidden');
				viewDash.classList.remove('hidden');
			}, ui);
			window.scrollTo({ top: 0, behavior: 'smooth' });
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
				groupHelper.renderGroupsTable(state, groupsComponent.tbodyEl, fetchNetworkData);

				if (state.currentDetailApMac && !viewApDetail.classList.contains('hidden')) {
					var updated = detailHelper.updateApDetailLive(state.currentDetailApMac, state, ui);
					if (!updated) {
						detailHelper.buildApDetailView(state.currentDetailApMac, state, viewApDetail, function() {
							state.currentDetailApMac = null;
							viewApDetail.classList.add('hidden');
							viewDash.classList.remove('hidden');
						}, ui);
					}
				}
			});
		}

		// Bulk Button Bindings
		btnBulkWifi.onclick = function() { bulkHelper.openBulkWifiModal(state, ui); };
		btnBulkPass.onclick = function() { bulkHelper.openBulkPassModal(state, ui); };
		btnBulkReboot.onclick = function() { bulkHelper.runBulkHardware('إعادة التشغيل', 'reboot', state, ui); };
		btnBulkRadioOff.onclick = function() { bulkHelper.runBulkHardware('إيقاف بث الوايرليس', 'wifi_radio', state, ui, '1'); };
		btnBulkRadioOn.onclick = function() { bulkHelper.runBulkHardware('تشغيل بث الوايرليس', 'wifi_radio', state, ui, '0'); };

		cbSelectAll.onchange = function() {
			var isChecked = cbSelectAll.checked;
			var aps = state.data.aps || {};
			state.selectedAps.clear();
			if (isChecked) {
				Object.keys(aps).forEach(function(m){ state.selectedAps.add(m); });
			}
			renderDashboard();
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

				var gName = 'غير محدد';
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

			dom.content(cardsDiv, [
				E('div', { class: 'dash-card total' }, [ E('h3', {}, total), E('p', {}, 'إجمالي الإكسسات') ]),
				E('div', { class: 'dash-card online' }, [ E('h3', {}, online), E('p', {}, 'متصل 🟢') ]),
				E('div', { class: 'dash-card offline' }, [ E('h3', {}, offline), E('p', {}, 'مفصول 🔴') ]),
				E('div', { class: 'dash-card clients' }, [ E('h3', {}, totalClients), E('p', {}, 'العملاء المتصلين') ])
			]);

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

			var rows = [];
			if (filtered.length === 0) {
				rows.push(E('tr', {}, E('td', { colspan: 9, style: 'text-align:center; padding: 25px; color: #64748b;' }, 'لا توجد إكسسات مطابقة.')));
			} else {
				filtered.forEach(function(ap) {
					var isSelected = state.selectedAps.has(ap.mac);
					var rowCb = E('input', { type: 'checkbox', style: 'width:18px; height:18px; cursor:pointer; accent-color:#00e676;' });
					rowCb.checked = isSelected;

					var tr = E('tr', { class: isSelected ? 'selected' : '' });

					rowCb.onchange = function() {
						if (rowCb.checked) state.selectedAps.add(ap.mac);
						else state.selectedAps.delete(ap.mac);
						tr.className = rowCb.checked ? 'selected' : '';
						bulkHelper.updateBulkBar(state, bulkBar, bulkTitle);
					};

					var dot = E('span', { class: ap.isOnline ? 'status-dot status-online' : 'status-dot status-offline' });
					
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
					var wifiBox = E('div', { class: 'ap-wifi-box' }, wifiPills.length > 0 ? wifiPills : [E('span', { style: 'color:#64748b;' }, '-')]);

					var btnManage = E('button', { class: 'btn-ctrl btn-ctrl-steer', style: 'padding: 7px 14px; font-size: 12px;' }, '🖥️ تحكم وإدارة');
					btnManage.onclick = function() { openApDetailView(ap.mac); };

					var btnReboot = E('button', { class: 'btn-ctrl btn-ctrl-kick', style: 'padding: 7px 14px; font-size: 12px;' }, '🔄 ريستارت');
					btnReboot.onclick = function() {
						if (confirm('إعادة تشغيل الإكسس (' + ap.mac + ')؟')) {
							fetch('/cgi-bin/horus_ap_action', { method: 'POST', body: JSON.stringify({ target_ap: ap.mac, action: 'reboot' }) });
							ui.addNotification(null, E('p', 'تم إرسال أمر إعادة التشغيل'));
						}
					};

					var actionBox = E('div', { class: 'ap-action-group' }, [btnManage, btnReboot]);

					var clientPills = [
						E('span', { class: 'pill-wifi' }, '📶 ' + ap.clients + ' وايرليس')
					];
					if (ap.wired > 0) {
						clientPills.push(E('span', { class: 'pill-wired' }, '🔌 ' + ap.wired + ' كابل'));
					}
					var clientBox = E('div', { class: 'ap-clients-box' }, clientPills);

					var hwBox = E('div', { class: 'ap-hw-box' }, [
						E('div', { style: 'display:flex; justify-content:space-between; gap:6px;' }, [
							E('span', {}, '🧠 المعالج:'),
							E('b', { style: 'color:#38bdf8;' }, ap.stats.cpu_load || '0.0')
						]),
						(ap.stats.cpu_temp && ap.stats.cpu_temp !== '-') ? E('div', { style: 'display:flex; justify-content:space-between; gap:6px;' }, [
							E('span', {}, '🌡️ الحرارة:'),
							E('b', { style: 'color:#f87171;' }, ap.stats.cpu_temp)
						]) : '',
						E('div', { style: 'display:flex; justify-content:space-between; gap:6px;' }, [
							E('span', {}, '💾 الرام:'),
							E('b', { style: 'color:#4ade80;' }, (ap.stats.mem_pct || 0) + '%')
						])
					]);

					var speedBox = E('div', { class: 'speed-meter-box', style: 'min-width:115px;' }, [
						E('div', { class: 'speed-meter-row rx' }, [ E('span', {}, '⬇️ سحب:'), E('span', {}, ap.stats.rx_speed || '0 bps') ]),
						E('div', { class: 'speed-meter-row tx' }, [ E('span', {}, '⬆️ رفع:'), E('span', {}, ap.stats.tx_speed || '0 bps') ])
					]);

					dom.content(tr, [
						E('td', { style: 'text-align:center;' }, rowCb),
						E('td', { style: 'white-space:nowrap;' }, [dot, ' ', ap.isOnline ? 'متصل 🟢' : 'مفصول 🔴']),
						E('td', { style: 'font-weight:800; font-size:14px; color:#f8fafc;' }, ap.hostname),
						E('td', {}, [
							E('div', { style: 'color:#38bdf8; font-family:monospace; font-weight:800;' }, ap.ip),
							E('div', { style: 'font-family:monospace; font-size:11px; color:#94a3b8;' }, ap.mac)
						]),
						E('td', {}, speedBox),
						E('td', {}, hwBox),
						E('td', {}, clientBox),
						E('td', {}, wifiBox),
						E('td', { style: 'text-align:center;' }, actionBox)
					]);
					rows.push(tr);
				});
			}
			dom.content(tableBody, rows);
			bulkHelper.updateBulkBar(state, bulkBar, bulkTitle);
		}

		searchInput.oninput = renderDashboard;
		filterSelect.onchange = renderDashboard;

		fetchNetworkData();
		setInterval(fetchNetworkData, 4000);

		return container;
	}
});
