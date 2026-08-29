'use strict';
'require view';
'require dom';
'require ui';

return view.extend({
	render: function() {
		var container = E('div', { class: 'horus-dashboard', id: 'horus-dashboard-container' });

		// 1. Styles (Theme Adaptive)
		var styles = E('style', {}, `
			.horus-dashboard { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; direction: rtl; color: inherit; }
			
			/* Tabs */
			.horus-tabs { display: flex; border-bottom: 2px solid rgba(128,128,128,0.3); margin-bottom: 20px; }
			.horus-tab { padding: 10px 20px; cursor: pointer; font-size: 16px; font-weight: bold; color: inherit; opacity: 0.7; background: rgba(128,128,128,0.05); border: 1px solid transparent; border-bottom: none; border-radius: 8px 8px 0 0; margin-left: 5px; transition: 0.3s; }
			.horus-tab.active { background: rgba(128,128,128,0.15); opacity: 1; color: #4ba3e3; border-color: rgba(128,128,128,0.3); border-bottom-color: transparent; margin-bottom: -2px; }
			.horus-tab:hover:not(.active) { background: rgba(128,128,128,0.1); opacity: 0.9; }
			
			/* Dashboard Layout */
			.dash-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
			.dash-card { background: rgba(128,128,128,0.05); padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border: 1px solid rgba(128,128,128,0.2); text-align: center; color: inherit; }
			.dash-card h3 { margin: 0; font-size: 28px; color: inherit; font-weight: bold; }
			.dash-card p { margin: 5px 0 0 0; color: inherit; opacity: 0.8; font-size: 14px; }
			.dash-card.total { border-bottom: 4px solid #007bff; }
			.dash-card.online { border-bottom: 4px solid #28a745; }
			.dash-card.offline { border-bottom: 4px solid #dc3545; }
			.dash-card.clients { border-bottom: 4px solid #17a2b8; }
			
			.toolbar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; margin-bottom: 15px; gap: 10px; background: rgba(128,128,128,0.05); padding: 15px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid rgba(128,128,128,0.2); }
			.toolbar input, .toolbar select { padding: 8px 12px; background: rgba(128,128,128,0.1); color: inherit; border: 1px solid rgba(128,128,128,0.3); border-radius: 4px; outline: none; font-size: 14px; }
			.toolbar input { flex-grow: 1; min-width: 200px; }
			.toolbar select option { background: #333; color: #fff; }
			@media (prefers-color-scheme: light) { .toolbar select option { background: #fff; color: #000; } }
			
			.bulk-actions { display: flex; gap: 10px; align-items: center; background: rgba(128,128,128,0.1); padding: 8px 15px; border-radius: 6px; border: 1px solid rgba(128,128,128,0.2); }
			.bulk-actions select { background: rgba(128,128,128,0.1); color: inherit; border: 1px solid rgba(128,128,128,0.3); padding: 6px 10px; border-radius: 4px; }
			.bulk-actions select option { background: #333; color: #fff; }
			@media (prefers-color-scheme: light) { .bulk-actions select option { background: #fff; color: #000; } }
			
			.table-wrapper { background: rgba(128,128,128,0.05); border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow-x: auto; border: 1px solid rgba(128,128,128,0.2); margin-bottom:20px; }
			.table-wrapper table { width: 100%; border-collapse: collapse; }
			.table-wrapper th, .table-wrapper td { padding: 12px 15px; text-align: right; border-bottom: 1px solid rgba(128,128,128,0.15); }
			.table-wrapper th { background: rgba(128,128,128,0.15); font-weight: bold; color: inherit; border-bottom: 2px solid rgba(128,128,128,0.3); }
			.table-wrapper tr:hover { background: rgba(128,128,128,0.1); }
			
			.status-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-left: 5px; }
			.status-online { background: #28a745; box-shadow: 0 0 5px #28a745; }
			.status-offline { background: #dc3545; box-shadow: 0 0 5px #dc3545; }
			
			.pagination { display: flex; justify-content: space-between; align-items: center; padding: 15px; background: rgba(128,128,128,0.05); border-top: 1px solid rgba(128,128,128,0.2); }
			.btn-page { padding: 6px 15px; border: 1px solid #4ba3e3; background: transparent; color: #4ba3e3; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold; transition: all 0.2s; }
			.btn-page:disabled { border-color: rgba(128,128,128,0.3); color: rgba(128,128,128,0.5); cursor: not-allowed; background: rgba(128,128,128,0.05); }
			.btn-page:hover:not(:disabled) { background: #4ba3e3; color: #fff; }
			
			.btn-action { padding: 5px 10px; background: #dc3545; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; transition: 0.2s; }
			.btn-action.edit { background: #28a745; }
			.btn-action.edit:hover { background: #218838; }
			.btn-action:hover { background: #c82333; }
			
			.btn-bulk { padding: 8px 15px; background: #4ba3e3; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; transition: 0.2s; }
			.btn-bulk:hover { background: #357ebd; }
			.btn-bulk:disabled { background: rgba(128,128,128,0.4); cursor: not-allowed; color: rgba(255,255,255,0.5); }
			
			.checkbox-custom { width: 18px; height: 18px; cursor: pointer; }
			
			/* Groups Form */
			.group-form { background: rgba(128,128,128,0.05); padding: 20px; border-radius: 8px; border: 1px solid rgba(128,128,128,0.2); margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
			.group-form h4 { margin-top: 0; color: inherit; border-bottom: 1px solid rgba(128,128,128,0.2); padding-bottom: 10px; }
			.form-row { display: flex; gap: 15px; margin-bottom: 15px; flex-wrap: wrap; }
			.form-group { flex: 1; min-width: 200px; display: flex; flex-direction: column; }
			.form-group label { margin-bottom: 5px; font-weight: bold; font-size: 13px; color: inherit; opacity: 0.9; }
			.form-group input, .form-group select { padding: 10px; background: rgba(128,128,128,0.1); color: inherit; border: 1px solid rgba(128,128,128,0.3); border-radius: 4px; font-size: 14px; }
			.form-group select option { background: #333; color: #fff; }
			@media (prefers-color-scheme: light) { .form-group select option { background: #fff; color: #000; } }
			
			.btn-primary { padding: 10px 20px; background: #007bff; color: #fff; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; }
			.btn-primary:hover { background: #0056b3; }
			
			.hidden { display: none !important; }
		`);
		container.appendChild(styles);

		// 2. TABS
		var tabDashboard = E('div', { class: 'horus-tab active' }, 'لوحة التحكم والمراقبة (Dashboard)');
		var tabGroups = E('div', { class: 'horus-tab' }, 'نظام المجموعات والقوالب (AP Groups)');
		var tabsContainer = E('div', { class: 'horus-tabs' }, [tabDashboard, tabGroups]);
		container.appendChild(tabsContainer);

		var viewDashboard = E('div', { id: 'view-dashboard' });
		var viewGroups = E('div', { id: 'view-groups', class: 'hidden' });
		container.appendChild(viewDashboard);
		container.appendChild(viewGroups);

		// Switch Logic
		tabDashboard.onclick = function() {
			tabDashboard.classList.add('active'); tabGroups.classList.remove('active');
			viewDashboard.classList.remove('hidden'); viewGroups.classList.add('hidden');
		};
		tabGroups.onclick = function() {
			tabGroups.classList.add('active'); tabDashboard.classList.remove('active');
			viewGroups.classList.remove('hidden'); viewDashboard.classList.add('hidden');
			fetchGroups(); // Refresh groups data when opening tab
		};

		// ----------------------------------------------------
		// VIEW 1: DASHBOARD
		// ----------------------------------------------------
		var cardsDiv = E('div', { class: 'dash-cards' });
		
		var toolbarDiv = E('div', { class: 'toolbar' });
		var searchInput = E('input', { type: 'text', placeholder: 'بحث بالاسم، الماك أدرس...' });
		var filterSelect = E('select', {}, [
			E('option', { value: 'all' }, 'جميع الإكسسات'),
			E('option', { value: 'online' }, 'المتصلة فقط'),
			E('option', { value: 'offline' }, 'المفصولة فقط')
		]);
		
		var bulkActionSelect = E('select', {}, [
			E('option', { value: '' }, '-- الإجراء الجماعي --'),
			E('option', { value: 'reboot' }, 'إعادة تشغيل المحددين'),
			E('option', { value: 'wifi_off' }, 'إطفاء الوايرليس ❌'),
			E('option', { value: 'wifi_on' }, 'تشغيل الوايرليس ✔️')
		]);
		// Dynamically add Groups to this select later
		
		var bulkActionBtn = E('button', { class: 'btn-bulk', disabled: true }, 'تطبيق');
		var selectedCountLabel = E('span', { style: 'font-weight:bold; color:#007bff;' }, '0');
		var bulkDiv = E('div', { class: 'bulk-actions' }, [
			E('span', {}, 'تم تحديد: '), selectedCountLabel,
			bulkActionSelect, bulkActionBtn
		]);
		
		toolbarDiv.appendChild(searchInput);
		toolbarDiv.appendChild(filterSelect);
		toolbarDiv.appendChild(bulkDiv);

		var tableBody = E('tbody', { id: 'ap-table-body' });
		var selectAllCb = E('input', { type: 'checkbox', class: 'checkbox-custom' });
		
		var table = E('div', { class: 'table-wrapper' }, [
			E('table', {}, [
				E('thead', {}, [
					E('tr', {}, [
						E('th', { style: 'width: 40px; text-align: center;' }, selectAllCb),
						E('th', {}, 'الحالة'),
						E('th', {}, 'MAC Address'),
						E('th', {}, 'Hostname / IP'),
						E('th', {}, 'المجموعة'),
						E('th', {}, 'العملاء المتصلين'),
						E('th', {}, 'إجراء')
					])
				]),
				tableBody
			])
		]);

		var btnPrev = E('button', { class: 'btn-page' }, 'السابق');
		var btnNext = E('button', { class: 'btn-page' }, 'التالي');
		var pageInfo = E('span', { style: 'font-weight: bold; color: #555;' }, 'صفحة 1 من 1');
		var paginationDiv = E('div', { class: 'pagination' }, [btnNext, pageInfo, btnPrev]);

		viewDashboard.appendChild(cardsDiv);
		viewDashboard.appendChild(toolbarDiv);
		viewDashboard.appendChild(table);
		viewDashboard.appendChild(paginationDiv);

		// ----------------------------------------------------
		// VIEW 2: GROUPS
		// ----------------------------------------------------
		var gFormName = E('input', { type: 'text', placeholder: 'مثال: أبراج السوق' });
		var gFormSSID = E('input', { type: 'text', placeholder: 'اسم الشبكة (SSID)' });
		var gFormPass = E('input', { type: 'text', placeholder: 'كلمة المرور' });
		var gFormEnc = E('select', {}, [
			E('option', { value: 'psk2' }, 'WPA2-PSK (قوي)'),
			E('option', { value: 'none' }, 'بدون كلمة مرور (مفتوح)')
		]);
		var gFormBand = E('select', {}, [
			E('option', { value: 'both' }, 'كلا الترددين (2.4G & 5G)'),
			E('option', { value: '2g' }, 'تردد 2.4GHz فقط'),
			E('option', { value: '5g' }, 'تردد 5GHz فقط')
		]);
		var gFormBtn = E('button', { class: 'btn-primary' }, 'إنشاء وحفظ المجموعة');

		var groupForm = E('div', { class: 'group-form' }, [
			E('h4', {}, 'إضافة مجموعة قوالب جديدة'),
			E('div', { class: 'form-row' }, [
				E('div', { class: 'form-group' }, [ E('label', {}, 'اسم المجموعة (للتنظيم)'), gFormName ]),
				E('div', { class: 'form-group' }, [ E('label', {}, 'اسم شبكة الوايرليس (SSID)'), gFormSSID ]),
				E('div', { class: 'form-group' }, [ E('label', {}, 'التردد المستهدف'), gFormBand ])
			]),
			E('div', { class: 'form-row' }, [
				E('div', { class: 'form-group' }, [ E('label', {}, 'كلمة المرور (Password)'), gFormPass ]),
				E('div', { class: 'form-group' }, [ E('label', {}, 'نوع التشفير'), gFormEnc ]),
				E('div', { class: 'form-group', style: 'justify-content: flex-end;' }, [ gFormBtn ])
			])
		]);

		var gTableBody = E('tbody');
		var gTable = E('div', { class: 'table-wrapper' }, [
			E('table', {}, [
				E('thead', {}, [
					E('tr', {}, [
						E('th', {}, 'اسم المجموعة'),
						E('th', {}, 'الشبكة (SSID)'),
						E('th', {}, 'التردد المستهدف'),
						E('th', {}, 'الإكسسات المخصصة'),
						E('th', {}, 'إجراءات')
					])
				]),
				gTableBody
			])
		]);

		viewGroups.appendChild(groupForm);
		viewGroups.appendChild(gTable);

		// ----------------------------------------------------
		// STATE & LOGIC
		// ----------------------------------------------------
		var state = {
			data: { aps: {}, clients: [] },
			groups: [],
			assignments: {},
			searchQuery: '',
			filterMode: 'all',
			currentPage: 1,
			itemsPerPage: 20,
			selectedMACs: new Set()
		};

		function fetchGroups() {
			fetch('/cgi-bin/horus_groups')
				.then(function(res) { return res.json(); })
				.then(function(data) {
					if (data && data.groups) {
						state.groups = data.groups;
						state.assignments = data.assignments || {};
						renderGroupsTable();
						updateBulkSelectOptions();
						updateView(); // refresh dashboard to show group names
					}
				});
		}

		gFormBtn.onclick = function() {
			var n = gFormName.value.trim();
			var s = gFormSSID.value.trim();
			var p = gFormPass.value.trim();
			if (!n || !s) { alert('الرجاء كتابة اسم المجموعة واسم الشبكة'); return; }
			
			gFormBtn.disabled = true;
			fetch('/cgi-bin/horus_groups', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'create_group', name: n, ssid: s, password: p, encryption: gFormEnc.value, band: gFormBand.value })
			}).then(function(res) { return res.json(); }).then(function(res) {
				gFormBtn.disabled = false;
				if (res.status === 'ok') {
					ui.addNotification(null, E('p', 'تم إنشاء المجموعة بنجاح!'));
					gFormName.value = ''; gFormSSID.value = ''; gFormPass.value = '';
					fetchGroups();
				}
			});
		};

		function renderGroupsTable() {
			var rows = [];
			if (state.groups.length === 0) {
				rows.push(E('tr', {}, E('td', { colspan: 5, style: 'text-align:center; padding: 20px;' }, 'لا توجد مجموعات حتى الآن.')));
			} else {
				state.groups.forEach(function(g) {
					var count = 0;
					Object.keys(state.assignments).forEach(function(mac) {
						if (state.assignments[mac] === g.id) count++;
					});
					
					var btnDelete = E('button', { class: 'btn-action' }, 'حذف');
					btnDelete.onclick = function() {
						if (confirm('هل أنت متأكد من حذف هذه المجموعة؟')) {
							fetch('/cgi-bin/horus_groups', { method: 'POST', body: JSON.stringify({ action: 'delete_group', group_id: g.id }) })
								.then(function() { fetchGroups(); });
						}
					};
					
					var b_label = (g.band === '2g') ? '2.4GHz فقط' : ((g.band === '5g') ? '5GHz فقط' : 'الترددين');
					
					rows.push(E('tr', {}, [
						E('td', { style: 'font-weight:bold;' }, g.name),
						E('td', {}, g.ssid),
						E('td', {}, E('span', { style: 'background: rgba(108, 117, 125, 0.2); color: inherit; padding: 3px 8px; border-radius: 12px; font-size: 12px; border: 1px solid rgba(108, 117, 125, 0.5); backdrop-filter: blur(4px);' }, b_label)),
						E('td', {}, E('span', { style: 'background: rgba(0, 123, 255, 0.2); color: inherit; padding: 3px 8px; border-radius: 12px; font-size: 12px; border: 1px solid rgba(0, 123, 255, 0.5); backdrop-filter: blur(4px);' }, count)),
						E('td', {}, btnDelete)
					]));
				});
			}
			dom.content(gTableBody, rows);
		}

		function updateBulkSelectOptions() {
			var opts = [
				E('option', { value: '' }, '-- الإجراء الجماعي --'),
				E('option', { value: 'reboot' }, 'إعادة تشغيل المحددين'),
				E('option', { value: 'wifi_off' }, 'إطفاء الوايرليس ❌'),
				E('option', { value: 'wifi_on' }, 'تشغيل الوايرليس ✔️'),
				E('option', { disabled: true }, '────────────────')
			];
			opts.push(E('option', { value: 'assign_none' }, 'إزالة من المجموعة 📭'));
			state.groups.forEach(function(g) {
				opts.push(E('option', { value: 'assign_' + g.id }, 'إضافة للمجموعة: ' + g.name + ' 📁'));
			});
			dom.content(bulkActionSelect, opts);
		}

		// ----------------------------------------------------
		// DASHBOARD LOGIC
		// ----------------------------------------------------
		function executeApAction(macs, action) {
			var msg = Array.isArray(macs) 
				? 'هل أنت متأكد من تطبيق الإجراء على (' + macs.length + ') إكسس؟' 
				: 'هل أنت متأكد من تطبيق الإجراء على هذا الإكسس؟';
				
			if (action.startsWith('assign_')) {
				var g_id = action === 'assign_none' ? '' : action.replace('assign_', '');
				msg = 'سيتم تغيير مجموعة الوايرليس المخصصة لهذه الإكسسات. هل أنت متأكد؟';
				if (confirm(msg)) {
					fetch('/cgi-bin/horus_groups', { 
						method: 'POST', 
						headers: { 'Content-Type': 'application/json' }, 
						body: JSON.stringify({ action: 'assign_ap', group_id: g_id, macs: macs }) 
					}).then(function() {
						ui.addNotification(null, E('p', 'تم التعيين وبدء تطبيق قالب المجموعة بنجاح!'));
						if (Array.isArray(macs)) state.selectedMACs.clear();
						fetchGroups();
					});
				}
				return;
			}
			
			if (confirm(msg)) {
				var payload = { target_ap: macs };
				if (action === 'reboot') { payload.action = 'reboot'; }
				else if (action === 'wifi_off') { payload.action = 'wifi_radio'; payload.state = '1'; }
				else if (action === 'wifi_on') { payload.action = 'wifi_radio'; payload.state = '0'; }
				
				fetch('/cgi-bin/horus_ap_action', { 
					method: 'POST', 
					headers: { 'Content-Type': 'application/json' }, 
					body: JSON.stringify(payload) 
				}).then(function() {
					ui.addNotification(null, E('p', 'تم إرسال الأمر بنجاح!'));
					if (Array.isArray(macs)) { state.selectedMACs.clear(); updateView(); }
				});
			}
		}

		bulkActionBtn.addEventListener('click', function() {
			var action = bulkActionSelect.value;
			if (!action) { alert('يرجى اختيار الإجراء أولاً'); return; }
			if (state.selectedMACs.size === 0) return;
			executeApAction(Array.from(state.selectedMACs), action);
			bulkActionSelect.value = '';
		});

		selectAllCb.addEventListener('change', function(e) {
			var isChecked = e.target.checked;
			var q = state.searchQuery.toLowerCase();
			var aps = state.data.aps || {};
			var now = Math.floor(Date.now() / 1000);
			
			Object.keys(aps).forEach(function(mac) {
				var ap = aps[mac];
				var isOnline = (now - (ap.last_seen || 0)) < 30;
				var matchSearch = (mac.toLowerCase().indexOf(q) > -1) || 
								  ((ap.hostname || '').toLowerCase().indexOf(q) > -1) || 
								  ((ap.ip || '').toLowerCase().indexOf(q) > -1);
				var matchFilter = true;
				if (state.filterMode === 'online' && !isOnline) matchFilter = false;
				if (state.filterMode === 'offline' && isOnline) matchFilter = false;
				
				if (matchSearch && matchFilter) {
					if (isChecked) state.selectedMACs.add(mac);
					else state.selectedMACs.delete(mac);
				}
			});
			updateView();
		});

		function updateView() {
			var aps = state.data.aps || {};
			var apKeys = Object.keys(aps);
			
			var total = apKeys.length;
			var online = 0, offline = 0, totalClients = 0;
			var now = Math.floor(Date.now() / 1000);
			var processedAps = [];

			apKeys.forEach(function(mac) {
				var ap = aps[mac];
				var isOnline = (now - (ap.last_seen || 0)) < 30;
				if (isOnline) online++; else offline++;
				var cCount = ap.clients ? ap.clients.length : 0;
				totalClients += cCount;
				
				var g_id = state.assignments[mac];
				var g_name = 'غير محدد';
				if (g_id) {
					var g = state.groups.find(function(x) { return x.id === g_id; });
					if (g) g_name = g.name;
				}

				processedAps.push({
					mac: mac,
					hostname: ap.hostname || 'Unknown',
					ip: ap.ip || '-',
					group: g_name,
					clients: cCount,
					isOnline: isOnline
				});
			});

			dom.content(cardsDiv, [
				E('div', { class: 'dash-card total' }, [ E('h3', {}, total), E('p', {}, 'الإكسسات') ]),
				E('div', { class: 'dash-card online' }, [ E('h3', {}, online), E('p', {}, 'متصل 🟢') ]),
				E('div', { class: 'dash-card offline' }, [ E('h3', {}, offline), E('p', {}, 'مفصول 🔴') ]),
				E('div', { class: 'dash-card clients' }, [ E('h3', {}, totalClients), E('p', {}, 'العملاء المتصلين') ])
			]);

			var q = state.searchQuery.toLowerCase();
			var filtered = processedAps.filter(function(ap) {
				var matchSearch = (ap.mac.toLowerCase().indexOf(q) > -1) || 
								  (ap.hostname.toLowerCase().indexOf(q) > -1) || 
								  (ap.ip.toLowerCase().indexOf(q) > -1);
				var matchFilter = true;
				if (state.filterMode === 'online' && !ap.isOnline) matchFilter = false;
				if (state.filterMode === 'offline' && ap.isOnline) matchFilter = false;
				return matchSearch && matchFilter;
			});

			selectedCountLabel.textContent = state.selectedMACs.size;
			bulkActionBtn.disabled = (state.selectedMACs.size === 0);
			selectAllCb.checked = (filtered.length > 0 && filtered.every(function(ap) { return state.selectedMACs.has(ap.mac); }));

			var totalPages = Math.ceil(filtered.length / state.itemsPerPage) || 1;
			if (state.currentPage > totalPages) state.currentPage = totalPages;
			
			var startIndex = (state.currentPage - 1) * state.itemsPerPage;
			var paginated = filtered.slice(startIndex, startIndex + state.itemsPerPage);

			var rows = [];
			if (paginated.length === 0) {
				rows.push(E('tr', {}, E('td', { colspan: 7, style: 'text-align:center; padding: 30px; color: #777;' }, 'لا توجد بيانات مطابقة.')));
			} else {
				paginated.forEach(function(ap) {
					var statusIcon = E('span', { class: ap.isOnline ? 'status-dot status-online' : 'status-dot status-offline' });
					var cb = E('input', { type: 'checkbox', class: 'checkbox-custom', value: ap.mac });
					cb.checked = state.selectedMACs.has(ap.mac);
					cb.addEventListener('change', function(e) {
						if (e.target.checked) state.selectedMACs.add(ap.mac);
						else state.selectedMACs.delete(ap.mac);
						updateView();
					});
					
					var btnReboot = E('button', { class: 'btn-action' }, 'إعادة تشغيل');
					btnReboot.onclick = function() { executeApAction(ap.mac, 'reboot'); };
					
					rows.push(E('tr', {}, [
						E('td', { style: 'text-align: center;' }, cb),
						E('td', {}, [statusIcon, ' ', ap.isOnline ? 'متصل' : 'مفصول']),
						E('td', { style: 'font-family: monospace;' }, ap.mac),
						E('td', {}, [E('strong', {}, ap.hostname), E('br'), E('small', {style:'color:#888'}, ap.ip)]),
						E('td', { style: 'color: #007bff; font-weight: bold;' }, ap.group),
						E('td', {}, E('span', { style: 'background: rgba(23, 162, 184, 0.2); color: inherit; padding: 3px 8px; border-radius: 12px; font-size: 12px; border: 1px solid rgba(23, 162, 184, 0.5); backdrop-filter: blur(4px);' }, ap.clients)),
						E('td', {}, btnReboot)
					]));
				});
			}
			dom.content(tableBody, rows);
			btnPrev.disabled = (state.currentPage === 1);
			btnNext.disabled = (state.currentPage === totalPages);
			pageInfo.textContent = 'صفحة ' + state.currentPage + ' من ' + totalPages;
		}

		searchInput.addEventListener('input', function(e) { state.searchQuery = e.target.value; state.currentPage = 1; updateView(); });
		filterSelect.addEventListener('change', function(e) { state.filterMode = e.target.value; state.currentPage = 1; updateView(); });
		btnPrev.addEventListener('click', function() { if (state.currentPage > 1) { state.currentPage--; updateView(); } });
		btnNext.addEventListener('click', function() { state.currentPage++; updateView(); });

		function fetchData() {
			fetch('/cgi-bin/horus_map_data')
				.then(function(res) { return res.json(); })
				.then(function(data) { state.data = data; updateView(); })
				.catch(function(err) {});
		}

		fetchGroups();
		fetchData();
		var intervalId = setInterval(fetchData, 5000);
		container.addEventListener('DOMNodeRemovedFromDocument', function() { clearInterval(intervalId); });

		return container;
	}
});
