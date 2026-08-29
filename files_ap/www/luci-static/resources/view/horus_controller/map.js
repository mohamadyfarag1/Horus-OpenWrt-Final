'use strict';
'require view';
'require dom';
'require ui';

return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	render: function() {
		var container = E('div', { class: 'horus-wlc-container', id: 'horus-wlc-root', style: 'direction:rtl; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;' });

		// Professional Enterprise Palette
		var styles = E('style', {}, `
			.horus-wlc-container { color: #f8fafc; }
			.glass-card { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 22px; margin-bottom: 22px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4); }
			
			.horus-tabs { display: flex; border-bottom: 2px solid rgba(255,255,255,0.1); margin-bottom: 20px; gap: 8px; }
			.horus-tab { padding: 12px 24px; cursor: pointer; font-size: 15px; font-weight: 700; color: #94a3b8; background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255,255,255,0.08); border-bottom: none; border-radius: 10px 10px 0 0; transition: all 0.2s; }
			.horus-tab.active { background: rgba(30, 41, 59, 0.9); color: #00e676; border-color: rgba(0, 230, 118, 0.4); border-bottom: 2px solid #00e676; margin-bottom: -2px; }
			.horus-tab:hover:not(.active) { background: rgba(51, 65, 85, 0.5); color: #f8fafc; }
			
			.dash-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 22px; }
			.dash-card { background: rgba(30, 41, 59, 0.6); backdrop-filter: blur(10px); padding: 20px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.08); text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
			.dash-card h3 { margin: 0; font-size: 32px; font-weight: 800; }
			.dash-card p { margin: 6px 0 0 0; font-size: 13px; font-weight: 600; color: #94a3b8; }
			.dash-card.total h3 { color: #38bdf8; }
			.dash-card.online h3 { color: #4ade80; }
			.dash-card.offline h3 { color: #f87171; }
			.dash-card.clients h3 { color: #fbbf24; }
			
			/* Bulk Action Bar */
			.bulk-bar { background: linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.9) 100%); border: 1px solid rgba(0, 230, 118, 0.4); border-radius: 10px; padding: 14px 18px; margin-bottom: 18px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; box-shadow: 0 0 20px rgba(0, 230, 118, 0.15); }
			.bulk-title { font-weight: 800; color: #00e676; font-size: 14px; display: flex; align-items: center; gap: 8px; }
			.bulk-actions { display: flex; flex-wrap: wrap; gap: 8px; }
			.btn-bulk { padding: 8px 14px; font-size: 12px; font-weight: 700; border-radius: 6px; border: none; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 6px; }
			.btn-bulk-wifi { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #fff; }
			.btn-bulk-pass { background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); color: #fff; }
			.btn-bulk-reboot { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); }
			.btn-bulk-off { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); }
			.btn-bulk-on { background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.4); }
			
			.toolbar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 12px; background: rgba(30, 41, 59, 0.5); padding: 14px 18px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08); }
			.toolbar input, .toolbar select { padding: 9px 14px; background: rgba(15, 23, 42, 0.6); color: #f8fafc; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; outline: none; font-size: 13px; }
			.toolbar input { flex-grow: 1; min-width: 220px; }
			
			.table-box { background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; overflow-x: auto; margin-bottom: 20px; }
			.custom-table { width: 100%; border-collapse: collapse; text-align: right; }
			.custom-table th { background: rgba(30, 41, 59, 0.8); padding: 14px 16px; font-size: 13px; font-weight: 700; color: #94a3b8; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
			.custom-table td { padding: 14px 16px; font-size: 13px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); color: #e2e8f0; }
			.custom-table tr:hover td { background: rgba(255, 255, 255, 0.03); }
			.custom-table tr.selected td { background: rgba(0, 230, 118, 0.07); }
			
			.status-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-left: 6px; }
			.status-online { background: #22c55e; box-shadow: 0 0 8px #22c55e; }
			.status-offline { background: #ef4444; box-shadow: 0 0 8px #ef4444; }
			
			.btn-action { padding: 7px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 700; margin-left: 5px; transition: all 0.2s; }
			.btn-manage { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #fff; box-shadow: 0 2px 8px rgba(2, 132, 199, 0.3); }
			.btn-manage:hover { background: #0284c7; transform: translateY(-1px); }
			.btn-reboot { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); }
			.btn-reboot:hover { background: #f59e0b; color: #000; }
			.btn-kick { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); }
			.btn-kick:hover { background: #ef4444; color: #fff; }
			.btn-primary { padding: 10px 22px; background: linear-gradient(135deg, #00e676 0%, #00b0ff 100%); color: #000; border: none; border-radius: 8px; font-weight: 800; cursor: pointer; font-size: 14px; }
			.btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 15px rgba(0, 230, 118, 0.3); }
			
			/* Full Dedicated AP Drilldown */
			.ap-detail-header { display: flex; justify-content: space-between; align-items: center; background: rgba(15, 23, 42, 0.6); padding: 18px 24px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); margin-bottom: 24px; flex-wrap: wrap; gap: 15px; }
			.ap-detail-title { font-size: 20px; font-weight: 800; color: #38bdf8; display: flex; align-items: center; gap: 10px; margin: 0; }
			.btn-back { padding: 9px 18px; background: rgba(255,255,255,0.08); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; font-weight: 700; cursor: pointer; transition: 0.2s; }
			.btn-back:hover { background: rgba(255,255,255,0.2); color: #fff; }
			
			.radios-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; margin-bottom: 24px; }
			.radio-card { background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 14px; }
			.radio-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; }
			.radio-title { font-size: 16px; font-weight: 700; color: #4ade80; margin: 0; }
			.radio-ops { display: flex; gap: 8px; flex-wrap: wrap; }
			.btn-sm-op { padding: 5px 12px; font-size: 12px; font-weight: 600; border-radius: 6px; border: none; cursor: pointer; transition: 0.2s; }
			
			/* Ports Grid */
			.ports-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; margin-bottom: 24px; }
			.port-card { background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 8px; }
			.port-header { display: flex; justify-content: space-between; align-items: center; }
			.port-name { font-weight: 800; font-size: 14px; color: #38bdf8; }
			.port-status-up { color: #4ade80; font-weight: 700; font-size: 12px; }
			.port-status-down { color: #94a3b8; font-size: 12px; }
			.port-clients-list { font-size: 11px; color: #cbd5e1; font-family: monospace; }
			
			.form-row { display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
			.form-field { flex: 1; min-width: 180px; display: flex; flex-direction: column; gap: 4px; }
			.form-field label { font-size: 12px; font-weight: 600; color: #cbd5e1; }
			.form-field input, .form-field select { padding: 9px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15); background: rgba(15, 23, 42, 0.6); color: #f8fafc; font-size: 13px; outline: none; }
			.form-field input:focus, .form-field select:focus { border-color: #00e676; }
			
			/* Modern Client Actions Group */
			.client-ctrl-group { display: flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; }
			.btn-ctrl { padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; border: none; display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s; white-space: nowrap; user-select: none; }
			.btn-ctrl-steer { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.35); }
			.btn-ctrl-steer:hover { background: #0284c7; color: #fff; transform: translateY(-1px); box-shadow: 0 2px 8px rgba(2, 132, 199, 0.4); }
			.btn-ctrl-kick { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35); }
			.btn-ctrl-kick:hover { background: #f59e0b; color: #000; transform: translateY(-1px); }
			.btn-ctrl-ban { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.35); }
			.btn-ctrl-ban:hover { background: #ef4444; color: #fff; transform: translateY(-1px); box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4); }

			/* Modern Live Speed Meter Box */
			.speed-meter-box { display: inline-flex; flex-direction: column; gap: 4px; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.1); padding: 6px 10px; border-radius: 8px; min-width: 120px; white-space: nowrap; box-shadow: inset 0 1px 3px rgba(0,0,0,0.3); }
			.speed-meter-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-family: monospace; font-size: 12px; font-weight: 800; }
			.speed-meter-row.rx { color: #38bdf8; }
			.speed-meter-row.tx { color: #4ade80; }

			/* Modern Data Session Box */
			.session-data-box { display: inline-flex; flex-direction: column; gap: 3px; font-size: 11px; color: #cbd5e1; font-family: monospace; white-space: nowrap; background: rgba(0,0,0,0.25); padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.06); }

			/* Wireless Health Box */
			.wireless-health-box { display: inline-flex; flex-direction: column; align-items: center; gap: 4px; white-space: nowrap; }

			.hidden { display: none !important; }
		`);
		container.appendChild(styles);

		// Navigation Tabs
		var tabsNav = E('div', { class: 'horus-tabs' });
		var tabDash = E('div', { class: 'horus-tab active' }, '📊 لوحة التحكم والإكسسات (WLC Dashboard)');
		var tabGroups = E('div', { class: 'horus-tab' }, '📁 المجموعات والقوالب (AP Groups)');
		tabsNav.appendChild(tabDash);
		tabsNav.appendChild(tabGroups);
		container.appendChild(tabsNav);

		// Views Containers
		var viewDash = E('div', { id: 'view-dashboard' });
		var viewGroups = E('div', { id: 'view-groups', class: 'hidden' });
		var viewApDetail = E('div', { id: 'view-ap-detail', class: 'hidden' });

		container.appendChild(viewDash);
		container.appendChild(viewGroups);
		container.appendChild(viewApDetail);

		tabDash.onclick = function() {
			tabDash.classList.add('active'); tabGroups.classList.remove('active');
			viewDash.classList.remove('hidden'); viewGroups.classList.add('hidden'); viewApDetail.classList.add('hidden');
		};
		tabGroups.onclick = function() {
			tabGroups.classList.add('active'); tabDash.classList.remove('active');
			viewGroups.classList.remove('hidden'); viewDash.classList.add('hidden'); viewApDetail.classList.add('hidden');
		};

		// 1. Dashboard Overview Elements
		var cardsDiv = E('div', { class: 'dash-cards' });
		viewDash.appendChild(cardsDiv);

		// Bulk Action Toolbar
		var bulkBar = E('div', { class: 'bulk-bar hidden' });
		var bulkTitle = E('div', { class: 'bulk-title' }, '🎯 تم تحديد 0 إكسس - الإجراءات الجماعية:');
		var btnBulkWifi = E('button', { class: 'btn-bulk btn-bulk-wifi' }, [ E('span', {}, '📶'), E('span', {}, 'تعديل الواي فاي الجماعي') ]);
		var btnBulkPass = E('button', { class: 'btn-bulk btn-bulk-pass' }, [ E('span', {}, '🔑'), E('span', {}, 'تغيير باسورد الراوتر (Admin Pass)') ]);
		var btnBulkReboot = E('button', { class: 'btn-bulk btn-bulk-reboot' }, [ E('span', {}, '🔄'), E('span', {}, 'إعادة تشغيل جماعية') ]);
		var btnBulkRadioOff = E('button', { class: 'btn-bulk btn-bulk-off' }, [ E('span', {}, '📴'), E('span', {}, 'إيقاف الوايرليس') ]);
		var btnBulkRadioOn = E('button', { class: 'btn-bulk btn-bulk-on' }, [ E('span', {}, '✔️'), E('span', {}, 'تشغيل الوايرليس') ]);

		bulkBar.appendChild(bulkTitle);
		bulkBar.appendChild(E('div', { class: 'bulk-actions' }, [
			btnBulkWifi, btnBulkPass, btnBulkReboot, btnBulkRadioOff, btnBulkRadioOn
		]));
		viewDash.appendChild(bulkBar);

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

		var cbSelectAll = E('input', { type: 'checkbox', style: 'width:18px; height:18px; cursor:pointer; accent-color:#00e676;' });
		var tableBody = E('tbody');
		var tableWrapper = E('div', { class: 'table-box' }, [
			E('table', { class: 'custom-table' }, [
				E('thead', {}, [
					E('tr', {}, [
						E('th', { style: 'width:40px; text-align:center;' }, cbSelectAll),
						E('th', {}, 'الحالة'),
						E('th', {}, 'اسم الإكسس / Hostname'),
						E('th', {}, 'عنوان الـ IP والماك'),
						E('th', {}, 'السرعة والترافيك اللحظي'),
						E('th', {}, 'أداء الجهاز'),
						E('th', {}, 'المتصلين (وايرليس / سلك)'),
						E('th', {}, 'ترددات الواي فاي'),
						E('th', { style: 'text-align: center;' }, 'إجراءات وتحكم شامل')
					])
				]),
				tableBody
			])
		]);
		viewDash.appendChild(tableWrapper);

		// 2. Groups View Elements
		var groupForm = E('div', { class: 'glass-card', style: 'text-align:right;' }, [
			E('h3', { style: 'margin-top:0; color:#00e676; font-size:17px;' }, '➕ إنشاء قالب مجموعة وايرليس جديدة'),
			E('div', { class: 'form-row' }, [
				E('div', { class: 'form-field' }, [ E('label', {}, 'اسم المجموعة:'), E('input', { id: 'g_name', placeholder: 'مثال: الدور الأول' }) ]),
				E('div', { class: 'form-field' }, [ E('label', {}, 'اسم الشبكة (SSID):'), E('input', { id: 'g_ssid', placeholder: 'RedaNet_WiFi' }) ]),
				E('div', { class: 'form-field' }, [ E('label', {}, 'كلمة السر:'), E('input', { id: 'g_pass', type: 'password', placeholder: 'كلمة سر الوايفاي' }) ]),
				E('div', { class: 'form-field' }, [
					E('label', {}, 'التردد المستهدف:'),
					E('select', { id: 'g_band' }, [
						E('option', { value: 'both' }, 'الترددين معاً (2.4GHz + 5GHz)'),
						E('option', { value: '2g' }, '2.4GHz فقط'),
						E('option', { value: '5g' }, '5GHz فقط')
					])
				])
			]),
			E('button', { class: 'btn-primary', id: 'btn_create_group' }, '💾 حفظ وإنشاء المجموعة')
		]);
		viewGroups.appendChild(groupForm);

		var gTableBody = E('tbody');
		var gTableWrapper = E('div', { class: 'table-box' }, [
			E('table', { class: 'custom-table' }, [
				E('thead', {}, [
					E('tr', {}, [
						E('th', {}, 'اسم المجموعة'),
						E('th', {}, 'اسم الشبكة (SSID)'),
						E('th', {}, 'التردد المستهدف'),
						E('th', {}, 'عدد الإكسسات'),
						E('th', {}, 'إجراءات')
					])
				]),
				gTableBody
			])
		]);
		viewGroups.appendChild(gTableWrapper);

		// State & Logic
		var state = {
			data: { aps: {}, clients: {} },
			radiusMap: {},
			groups: [],
			assignments: {},
			selectedAps: new Set(),
			currentDetailApMac: null
		};

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
				renderGroups();
				if (state.currentDetailApMac && !viewApDetail.classList.contains('hidden')) {
					renderApDetailView(state.currentDetailApMac);
				}
			});
		}

		// ----------------------------------------------------
		// BULK ACTIONS MODALS
		// ----------------------------------------------------
		btnBulkWifi.onclick = function() {
			if (state.selectedAps.size === 0) return;
			var targetList = Array.from(state.selectedAps);

			var inBand = E('select', {}, [
				E('option', { value: 'both' }, 'الترددين معاً (2.4GHz + 5GHz)'),
				E('option', { value: '2g' }, 'تردد 2.4GHz فقط'),
				E('option', { value: '5g' }, 'تردد 5GHz فقط')
			]);
			var inSsid = E('input', { type: 'text', placeholder: 'اسم الشبكة الجديد (SSID)' });
			var inPass = E('input', { type: 'password', placeholder: 'كلمة السر الجديدة (8 أحرف فأكثر)' });
			var inChannel = E('select', {}, [
				E('option', { value: '' }, 'بدون تغيير (الحالي)'),
				E('option', { value: 'auto' }, 'Auto (تلقائي)')
			]);
			for (var c = 1; c <= 13; c++) inChannel.appendChild(E('option', { value: c.toString() }, 'قناة ' + c));
			[36, 40, 44, 48, 149, 153, 157, 161, 165].forEach(function(c5){ inChannel.appendChild(E('option', { value: c5.toString() }, 'قناة ' + c5)); });

			var modalBox = E('div', { style: 'direction:rtl; text-align:right; color:#f8fafc;' }, [
				E('h3', { style: 'color:#00e676; margin-top:0;' }, '📶 تطبيق إعدادات الوايفاي الجماعي على (' + targetList.length + ') إكسس'),
				E('p', { style: 'font-size:13px; color:#94a3b8;' }, 'سيتم إرسال وتطبيق التغييرات لجميع الأجهزة المحددة فوراً عبر HMP.'),
				E('div', { class: 'form-row' }, [
					E('div', { class: 'form-field' }, [ E('label', {}, 'التردد المستهدف:'), inBand ]),
					E('div', { class: 'form-field' }, [ E('label', {}, 'اسم الشبكة (SSID):'), inSsid ]),
					E('div', { class: 'form-field' }, [ E('label', {}, 'كلمة السر:'), inPass ]),
					E('div', { class: 'form-field' }, [ E('label', {}, 'القناة:'), inChannel ])
				])
			]);

			ui.showModal(_('تعديل الوايفاي الجماعي'), [
				modalBox,
				E('div', { class: 'right', style: 'margin-top:15px; display:flex; gap:10px; justify-content:flex-end;' }, [
					E('button', { class: 'btn', click: ui.hideModal }, _('إلغاء')),
					E('button', { class: 'btn cbi-button-action', click: function() {
						var ssid = inSsid.value.trim();
						var pass = inPass.value.trim();
						var band = inBand.value;
						var ch = inChannel.value;

						if (!ssid && !pass && !ch) { alert('يرجى إدخال اسم شبكة أو كلمة سر أو قناة لتطبيقها.'); return; }

						fetch('/cgi-bin/horus_wifi_action', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								target_ap: targetList,
								action: 'apply_profile',
								band: band,
								ssid: ssid,
								password: pass,
								channel: ch
							})
						}).then(function(){
							ui.hideModal();
							ui.addNotification(null, E('p', '✅ تم إرسال وتطبيق إعدادات الوايرليس على (' + targetList.length + ') إكسس بنجاح!'));
						});
					}}, _('🚀 تطبيق فوري على الأجهزة المحددة'))
				])
			]);
		};

		btnBulkPass.onclick = function() {
			if (state.selectedAps.size === 0) return;
			var targetList = Array.from(state.selectedAps);

			var inNewPass = E('input', { type: 'password', placeholder: 'كلمة السر الجديدة' });
			var inConfirmPass = E('input', { type: 'password', placeholder: 'تأكيد كلمة السر الجديدة' });

			var modalBox = E('div', { style: 'direction:rtl; text-align:right; color:#f8fafc;' }, [
				E('h3', { style: 'color:#a855f7; margin-top:0;' }, '🔑 تغيير باسورد الراوتر (Root / Admin) لـ (' + targetList.length + ') إكسس'),
				E('p', { style: 'font-size:13px; color:#94a3b8;' }, 'سيتم تحديث كلمة مرور تسجيل الدخول للوحة التحكم وSSH على جميع الإكسسات المحددة دفعة واحدة.'),
				E('div', { class: 'form-row' }, [
					E('div', { class: 'form-field' }, [ E('label', {}, 'كلمة السر الجديدة:'), inNewPass ]),
					E('div', { class: 'form-field' }, [ E('label', {}, 'تأكيد كلمة السر:'), inConfirmPass ])
				])
			]);

			ui.showModal(_('تغيير باسورد لوحة التحكم'), [
				modalBox,
				E('div', { class: 'right', style: 'margin-top:15px; display:flex; gap:10px; justify-content:flex-end;' }, [
					E('button', { class: 'btn', click: ui.hideModal }, _('إلغاء')),
					E('button', { class: 'btn cbi-button-action', click: function() {
						var p1 = inNewPass.value.trim();
						var p2 = inConfirmPass.value.trim();
						if (!p1 || p1 !== p2) { alert('كلمتا السر غير متطابقتين أو فارغتين.'); return; }

						fetch('/cgi-bin/horus_ap_action', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								target_ap: targetList,
								action: 'admin_password',
								password: p1
							})
						}).then(function(){
							ui.hideModal();
							ui.addNotification(null, E('p', '✅ تم تغيير باسورد لوحة التحكم على (' + targetList.length + ') إكسس بنجاح!'));
						});
					}}, _('🔒 تغيير الباسورد فوراً'))
				])
			]);
		};

		function runBulkHardware(actName, actParam, val) {
			if (state.selectedAps.size === 0) return;
			var targetList = Array.from(state.selectedAps);
			if (confirm('هل أنت متأكد من تنفيذ (' + actName + ') على (' + targetList.length + ') إكسس؟')) {
				var p = { target_ap: targetList, action: actParam };
				if (val !== undefined) p.state = val;
				fetch('/cgi-bin/horus_ap_action', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(p)
				}).then(function(){
					ui.addNotification(null, E('p', '✅ تم إرسال أمر ' + actName + ' إلى الأجهزة المحددة بنجاح!'));
				});
			}
		}

		btnBulkReboot.onclick = function() { runBulkHardware('إعادة التشغيل', 'reboot'); };
		btnBulkRadioOff.onclick = function() { runBulkHardware('إيقاف بث الوايرليس', 'wifi_radio', '1'); };
		btnBulkRadioOn.onclick = function() { runBulkHardware('تشغيل بث الوايرليس', 'wifi_radio', '0'); };

		// ----------------------------------------------------
		// FULL-SCREEN DEDICATED AP MANAGEMENT VIEW
		// ----------------------------------------------------
		function openApDetailView(apMac) {
			state.currentDetailApMac = apMac;
			viewDash.classList.add('hidden');
			viewGroups.classList.add('hidden');
			viewApDetail.classList.remove('hidden');
			renderApDetailView(apMac);
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}

		function renderApDetailView(apMac) {
			var ap = state.data.aps[apMac] || {};
			var wifiList = ap.wifi || [];
			var portsList = ap.ports || [];
			var clientsList = ap.clients || [];

			dom.content(viewApDetail, []);

			// Top Header Card with Back Button
			var btnBack = E('button', { class: 'btn-back' }, '⬅️ العودة للوحة الإكسسات العامة');
			btnBack.onclick = function() {
				state.currentDetailApMac = null;
				viewApDetail.classList.add('hidden');
				viewDash.classList.remove('hidden');
			};

			var headerBox = E('div', { class: 'ap-detail-header' }, [
				E('div', {}, [
					E('h2', { class: 'ap-detail-title' }, [
						E('span', {}, '📡 ' + (ap.hostname || 'Horus-AP')),
						E('span', { class: 'badge', style: 'font-size:12px; background:rgba(34,197,94,0.2); color:#4ade80; border:1px solid rgba(34,197,94,0.4); padding:3px 10px; border-radius:20px;' }, 'متصل عبر HMP 🟢')
					]),
					E('div', { style: 'font-size:13px; color:#94a3b8; font-family:monospace; margin-top:5px;' }, 'MAC: ' + apMac + ' | LAN IP: ' + (ap.ip || '-'))
				]),
				E('div', { style: 'display:flex; gap:10px;' }, [
					E('button', { class: 'btn-action btn-reboot', style: 'padding:9px 18px; font-size:13px;' }, '🔄 إعادة تشغيل الإكسس'),
					btnBack
				])
			]);
			headerBox.querySelector('.btn-reboot').onclick = function() {
				if (confirm('هل أنت متأكد من إعادة تشغيل الإكسس (' + apMac + ')؟')) {
					fetch('/cgi-bin/horus_ap_action', { method: 'POST', body: JSON.stringify({ target_ap: apMac, action: 'reboot' }) });
					ui.addNotification(null, E('p', 'تم إرسال أمر إعادة التشغيل للإكسس.'));
				}
			};
			viewApDetail.appendChild(headerBox);

			// Real-Time Speed & Capacity Metrics Banner
			var st = ap.stats || {};
			var statsBanner = E('div', { style: 'display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:14px; margin-bottom: 20px;' }, [
				E('div', { class: 'dash-card', style: 'border:1px solid rgba(56,189,248,0.3); background:rgba(15,23,42,0.6); padding:16px; border-radius:10px;' }, [
					E('h3', { style: 'color:#38bdf8; font-size:22px; margin:0;' }, '⬇️ ' + (st.rx_speed || '0 bps')),
					E('p', { style: 'color:#94a3b8; font-size:12px; margin:4px 0 0 0;' }, 'سرعة التحميل اللحظية | الإجمالي: ' + (st.total_rx || '-'))
				]),
				E('div', { class: 'dash-card', style: 'border:1px solid rgba(34,197,94,0.3); background:rgba(15,23,42,0.6); padding:16px; border-radius:10px;' }, [
					E('h3', { style: 'color:#4ade80; font-size:22px; margin:0;' }, '⬆️ ' + (st.tx_speed || '0 bps')),
					E('p', { style: 'color:#94a3b8; font-size:12px; margin:4px 0 0 0;' }, 'سرعة الرفع اللحظية | الإجمالي: ' + (st.total_tx || '-'))
				]),
				E('div', { class: 'dash-card', style: 'border:1px solid rgba(251,191,36,0.3); background:rgba(15,23,42,0.6); padding:16px; border-radius:10px;' }, [
					E('h3', { style: 'color:#fbbf24; font-size:22px; margin:0;' }, '👥 ' + clientsList.length + ' متصل'),
					E('p', { style: 'color:#94a3b8; font-size:12px; margin:4px 0 0 0;' }, 'عدد عملاء الوايرليس النشطين')
				]),
				E('div', { class: 'dash-card', style: 'border:1px solid rgba(168,85,247,0.3); background:rgba(15,23,42,0.6); padding:16px; border-radius:10px;' }, [
					E('h3', { style: 'color:#a855f7; font-size:20px; margin:0;' }, '🧠 ' + (st.cpu_load || '0.0') + ' | 💾 ' + (st.mem_pct || 0) + '%' + ((st.cpu_temp && st.cpu_temp !== '-') ? ' | 🌡️ ' + st.cpu_temp : '')),
					E('p', { style: 'color:#94a3b8; font-size:12px; margin:4px 0 0 0;' }, 'المعالج والذاكرة وحرارة الجهاز')
				])
			]);
			viewApDetail.appendChild(statsBanner);

			// --- Section 1: Independent Radios (2.4GHz & 5GHz) ---
			var radiosGrid = E('div', { class: 'radios-grid' });

			var radio2g = wifiList.find(function(w){ return w.band_code === '2g' || w.band === '2.4GHz' || w.channel <= 14; }) || { band: '2.4GHz', band_code: '2g', channel: '1', htmode: 'HT20', ssid: 'RedaNet LG', noise: '-87 dBm', disabled: false };
			var radio5g = wifiList.find(function(w){ return w.band_code === '5g' || w.band === '5GHz' || w.channel >= 36; }) || { band: '5GHz', band_code: '5g', channel: '157', htmode: 'VHT80', ssid: 'ras2ac', noise: '-92 dBm', disabled: false };

			function buildRadioCard(rData, is5G) {
				var bTitle = is5G ? '📶 راديو 5GHz (Radio 1 - عالي السرعة)' : '📶 راديو 2.4GHz (Radio 0 - طويل المدى)';
				var cardColor = is5G ? '#38bdf8' : '#4ade80';

				var inSsid = E('input', { type: 'text', value: rData.ssid || '', placeholder: 'اسم الشبكة' });
				var inPass = E('input', { type: 'password', placeholder: 'كلمة السر الجديدة' });
				var inChan = E('select', {});
				inChan.appendChild(E('option', { value: '' }, 'الحالي (' + (rData.channel || 'Auto') + ')'));
				inChan.appendChild(E('option', { value: 'auto' }, 'Auto (تلقائي)'));
				if (!is5G) {
					for (var c = 1; c <= 13; c++) inChan.appendChild(E('option', { value: c.toString() }, 'قناة ' + c));
				} else {
					[36, 40, 44, 48, 149, 153, 157, 161, 165].forEach(function(c5){ inChan.appendChild(E('option', { value: c5.toString() }, 'قناة ' + c5)); });
				}

				var inHt = E('select', {}, [
					E('option', { value: '' }, 'الحالي (' + (rData.htmode || '-') + ')'),
					E('option', { value: 'HT20' }, '20 MHz (أفضل استقرار)'),
					E('option', { value: 'HT40' }, '40 MHz (سرعة مضاعفة)'),
					E('option', { value: 'VHT80' }, '80 MHz (أقصى سرعة)')
				]);

				var noiseDisplay = E('div', { style: 'margin: 6px 0 12px 0; font-size:12px; color:#cbd5e1; background:rgba(0,0,0,0.25); padding:6px 10px; border-radius:6px; display:flex; justify-content:space-between;' }, [
					E('span', {}, '📡 مستوى الضوضاء والتشويش (Noise Floor):'),
					E('span', { style: 'color:#38bdf8; font-weight:bold; font-family:monospace;' }, (rData.noise || '-') + ' 🟢 بيئة نقية')
				]);

				var btnSave = E('button', { class: 'btn-primary', style: 'width:100%; margin-top:8px;' }, '💾 حفظ وتطبيق إعدادات ' + (is5G ? '5G' : '2.4G'));
				btnSave.onclick = function() {
					btnSave.disabled = true;
					fetch('/cgi-bin/horus_wifi_action', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							target_ap: apMac,
							action: 'apply_profile',
							band: is5G ? '5g' : '2g',
							ssid: inSsid.value.trim(),
							password: inPass.value.trim(),
							channel: inChan.value,
							htmode: inHt.value
						})
					}).then(function(){
						btnSave.disabled = false;
						ui.addNotification(null, E('p', '✅ تم تحديث إعدادات راديو ' + (is5G ? '5G' : '2.4G') + ' بنجاح!'));
					});
				};

				var btnRestart = E('button', { class: 'btn-sm-op', style: 'background:rgba(56,189,248,0.2); color:#38bdf8; border:1px solid rgba(56,189,248,0.4);' }, '🔄 ريستارت ' + (is5G ? '5G' : '2.4G'));
				btnRestart.onclick = function() {
					fetch('/cgi-bin/horus_wifi_action', { method: 'POST', body: JSON.stringify({ target_ap: apMac, action: 'radio_restart', radio: is5G ? 'radio1' : 'radio0' }) });
					ui.addNotification(null, E('p', 'تم إعادة تشغيل راديو ' + (is5G ? '5G' : '2.4G')));
				};

				var btnToggle = E('button', { class: 'btn-sm-op', style: rData.disabled ? 'background:rgba(34,197,94,0.2); color:#4ade80; border:1px solid rgba(34,197,94,0.4);' : 'background:rgba(239,68,68,0.2); color:#f87171; border:1px solid rgba(239,68,68,0.4);' }, rData.disabled ? '✔️ تشغيل الراديو' : '📴 إيقاف الراديو');
				btnToggle.onclick = function() {
					var nextState = rData.disabled ? '0' : '1';
					fetch('/cgi-bin/horus_ap_action', { method: 'POST', body: JSON.stringify({ target_ap: apMac, action: 'radio_toggle', radio: is5G ? 'radio1' : 'radio0', state: nextState }) });
					ui.addNotification(null, E('p', (nextState === '0' ? 'تم تشغيل' : 'تم إيقاف') + ' بث ' + (is5G ? '5G' : '2.4G')));
				};

				return E('div', { class: 'radio-card' }, [
					E('div', { class: 'radio-header' }, [
						E('h4', { class: 'radio-title', style: 'color:' + cardColor }, bTitle),
						E('span', { style: 'font-size:12px; font-weight:700; color:' + (rData.disabled ? '#ef4444' : '#22c55e') }, rData.disabled ? '🔴 متوقف' : '🟢 يعمل')
					]),
					noiseDisplay,
					E('div', { class: 'radio-ops' }, [ btnRestart, btnToggle ]),
					E('div', { class: 'form-row' }, [
						E('div', { class: 'form-field' }, [ E('label', {}, 'اسم الشبكة (SSID):'), inSsid ]),
						E('div', { class: 'form-field' }, [ E('label', {}, 'كلمة السر:'), inPass ])
					]),
					E('div', { class: 'form-row' }, [
						E('div', { class: 'form-field' }, [ E('label', {}, 'القناة الحالية: ' + (rData.channel || 'Auto')), inChan ]),
						E('div', { class: 'form-field' }, [ E('label', {}, 'عرض القناة: ' + (rData.htmode || '-')), inHt ])
					]),
					btnSave
				]);
			}

			radiosGrid.appendChild(buildRadioCard(radio2g, false));
			radiosGrid.appendChild(buildRadioCard(radio5g, true));
			viewApDetail.appendChild(radiosGrid);

			// --- Section 2: Ethernet Ports Status & Wired Clients ---
			var portsSection = E('div', { class: 'glass-card' }, [
				E('h3', { style: 'margin-top:0; color:#38bdf8; font-size:17px; display:flex; align-items:center; gap:8px;' }, '🔌 منافذ اللان السلكية والأجهزة المتصلة كابل (Wired Ethernet Ports)'),
				E('p', { style: 'font-size:13px; color:#94a3b8; margin:0 0 16px 0;' }, 'مراقبة حالة كابلات اللان وسرعة المنافذ والتحكم في إيقاف أو تشغيل أي منفذ سلكي.')
			]);

			var portsGrid = E('div', { class: 'ports-grid' });
			if (portsList.length === 0) {
				portsGrid.appendChild(E('div', { style: 'color:#64748b; font-size:13px;' }, 'جاري قراءة منافذ اللان السلكية عبر HMP...'));
			} else {
				portsList.forEach(function(p) {
					var isUp = p.is_up;
					var pCard = E('div', { class: 'port-card' }, [
						E('div', { class: 'port-header' }, [
							E('span', { class: 'port-name' }, '🔌 ' + p.label),
							E('span', { class: isUp ? 'port-status-up' : 'port-status-down' }, isUp ? '🟢 ' + p.speed_str : '⚪ مفصول')
						])
					]);

					var btnPortToggle = E('button', { class: 'btn-sm-op', style: isUp ? 'background:rgba(239,68,68,0.2); color:#f87171;' : 'background:rgba(34,197,94,0.2); color:#4ade80;' }, isUp ? '📴 إيقاف المنفذ' : '✔️ تفعيل المنفذ');
					btnPortToggle.onclick = function() {
						var nState = isUp ? 'down' : 'up';
						fetch('/cgi-bin/horus_ap_action', { method: 'POST', body: JSON.stringify({ target_ap: apMac, action: 'port_state', port: p.port, state: nState }) });
						ui.addNotification(null, E('p', 'تم إرسال أمر ' + (nState === 'up' ? 'تفعيل' : 'إيقاف') + ' للمنفذ: ' + p.label));
					};
					pCard.appendChild(btnPortToggle);

					if (p.clients && p.clients.length > 0) {
						var cHtml = [];
						p.clients.forEach(function(cl) {
							var rUser = state.radiusMap[cl.mac] || {};
							var cName = rUser.name || rUser.username || cl.mac;
							cHtml.push(E('div', { style: 'margin-top:4px; padding:3px 6px; background:rgba(255,255,255,0.05); border-radius:4px;' }, [
								E('div', { style: 'color:#00e676; font-weight:700;' }, '💻 ' + cName),
								E('div', { style: 'color:#94a3b8; font-size:10px;' }, cl.mac + (cl.ip ? ' (' + cl.ip + ')' : ''))
							]));
						});
						pCard.appendChild(E('div', { class: 'port-clients-list' }, [
							E('div', { style: 'font-weight:700; color:#cbd5e1; margin-top:6px;' }, 'المتصلين (' + p.clients.length + '):'),
							E('div', {}, cHtml)
						]));
					}
					portsGrid.appendChild(pCard);
				});
			}
			portsSection.appendChild(portsGrid);
			viewApDetail.appendChild(portsSection);

			// --- Section 3: Wireless Connected Clients on this AP ---
			var clientsSection = E('div', { class: 'glass-card' }, [
				E('h3', { style: 'margin-top:0; color:#fbbf24; font-size:17px;' }, '👥 المشتركون المتصلون لاسلكياً على هذا الإكسس (' + clientsList.length + ')')
			]);

			var cTableRows = [];
			if (clientsList.length === 0) {
				cTableRows.push(E('tr', {}, E('td', { colspan: 7, style: 'text-align:center; padding:30px; color:#64748b; font-size:14px;' }, 'لا توجد أجهزة متصلة لاسلكياً على هذا الإكسس حالياً.')));
			} else {
				clientsList.forEach(function(c) {
					var cmac = (c.mac || '').toUpperCase();
					var rUser = state.radiusMap[cmac] || {};
					var isRegistered = !!(rUser.name || rUser.username);
					var dispName = rUser.name || rUser.username || 'مشترك محلي (غير مسجل)';
					var prof = rUser.profile ? '🪙 ' + rUser.profile : '';
					var quota = rUser.quota ? ' | 📊 متبقي: ' + rUser.quota : '';
					var uptimeStr = rUser.uptime ? ' | ⏱️ ' + rUser.uptime : '';

					var sigVal = parseInt(c.signal, 10) || -100;
					var sigBadgeColor = sigVal >= -65 ? 'background:rgba(34,197,94,0.18); color:#4ade80; border:1px solid rgba(34,197,94,0.4);' :
									   (sigVal >= -75 ? 'background:rgba(245,158,11,0.18); color:#fbbf24; border:1px solid rgba(245,158,11,0.4);' :
														'background:rgba(239,68,68,0.18); color:#f87171; border:1px solid rgba(239,68,68,0.4);');

					var btnSteer = E('button', { class: 'btn-ctrl btn-ctrl-steer', title: 'توجيه ذكي لإجبار الهاتف على الانتقال لأقوى إكسس' }, '⚡ توجيه');
					btnSteer.onclick = function() {
						if (confirm('توجيه العميل (' + cmac + ') لإجباره على الانتقال لإكسس أقرب وأقوى؟')) {
							fetch('/cgi-bin/horus_ap_action', { method: 'POST', body: JSON.stringify({ target_ap: apMac, action: 'steer_client', mac: cmac, ban_time: 3000 }) });
							ui.addNotification(null, E('p', '⚡ تم إرسال أمر التوجيه الذكي (802.11v BSS Transition & Kick) للعميل بنجاح!'));
						}
					};

					var btnKick = E('button', { class: 'btn-ctrl btn-ctrl-kick', title: 'فصل الاتصال مؤقتاً' }, '❌ فصل');
					btnKick.onclick = function() {
						if (confirm('فصل العميل (' + cmac + ')؟')) {
							fetch('/cgi-bin/horus_ap_action', { method: 'POST', body: JSON.stringify({ target_ap: apMac, action: 'kick', mac: cmac }) });
							ui.addNotification(null, E('p', 'تم فصل العميل'));
						}
					};

					var btnBan = E('button', { class: 'btn-ctrl btn-ctrl-ban', title: 'حظر الماك نهائياً على مستوى الهاردوير' }, '🚫 حظر');
					btnBan.onclick = function() {
						if (confirm('حظر هذا الماك (' + cmac + ') على جميع الإكسسات؟')) {
							fetch('/cgi-bin/horus_ban_action', { method: 'POST', body: JSON.stringify({ action: 'ban', mac: cmac, scope: 'all', duration: 0 }) });
							ui.addNotification(null, E('p', 'تم حظر الماك بنجاح'));
						}
					};

					var vIcon = c.vendor_icon || '📱';
					var vName = c.vendor || 'جهاز غير معروف';

					var radBadge = isRegistered ? 
						E('span', { style: 'background:rgba(34,197,94,0.2); color:#4ade80; border:1px solid rgba(34,197,94,0.4); padding:2px 6px; border-radius:4px; font-size:10px; font-weight:800;' }, '✔ SAS') :
						E('span', { style: 'background:rgba(148,163,184,0.15); color:#94a3b8; border:1px solid rgba(148,163,184,0.3); padding:2px 6px; border-radius:4px; font-size:10px;' }, 'غير مسجل');

					cTableRows.push(E('tr', {}, [
						// Col 1: MAC & Device Brand
						E('td', {}, [
							E('div', { style: 'font-family:monospace; font-weight:800; font-size:13px; color:#38bdf8;' }, cmac),
							E('div', { style: 'display:inline-flex; align-items:center; gap:4px; background:rgba(255,255,255,0.06); padding:2px 6px; border-radius:4px; font-size:11px; color:#cbd5e1; margin-top:4px;' }, [
								E('span', {}, vIcon),
								E('span', { style: 'font-weight:600;' }, vName)
							])
						]),
						// Col 2: Subscriber & Radius
						E('td', {}, [
							E('div', { style: 'display:flex; align-items:center; gap:8px;' }, [
								E('span', { style: 'color:#00e676; font-weight:800; font-size:14px;' }, dispName),
								radBadge
							]),
							(prof || quota) ? E('div', { style: 'font-size:11px; color:#94a3b8; margin-top:3px;' }, prof + quota + uptimeStr) : ''
						]),
						// Col 3: Live Speed Meter
						E('td', {}, [
							E('div', { class: 'speed-meter-box' }, [
								E('div', { class: 'speed-meter-row rx' }, [ E('span', {}, '⬇️ سحب:'), E('span', {}, c.rx_speed || '0 bps') ]),
								E('div', { class: 'speed-meter-row tx' }, [ E('span', {}, '⬆️ رفع:'), E('span', {}, c.tx_speed || '0 bps') ])
							])
						]),
						// Col 4: Session Total Data
						E('td', {}, [
							E('div', { class: 'session-data-box' }, [
								E('div', { style: 'color:#38bdf8;' }, '📥 ' + (c.total_rx || '-')),
								E('div', { style: 'color:#4ade80;' }, '📤 ' + (c.total_tx || '-'))
							])
						]),
						// Col 5: Wireless Signal & PHY Rate
						E('td', {}, [
							E('div', { class: 'wireless-health-box' }, [
								E('span', { style: 'padding:3px 8px; border-radius:6px; font-weight:800; font-size:12px;' + sigBadgeColor }, (c.signal || '-') + ' dBm'),
								E('span', { style: 'font-size:11px; color:#94a3b8; font-family:monospace;' }, '📶 ' + (c.link_rate || '-'))
							])
						]),
						// Col 6: IP & Interface
						E('td', {}, [
							E('div', { style: 'font-family:monospace; font-weight:700; color:#f8fafc; font-size:12px;' }, rUser.ip || '-'),
							E('div', { style: 'font-size:11px; color:#64748b;' }, c.iface || '-')
						]),
						// Col 7: Actions Group
						E('td', { style: 'text-align:center;' }, [
							E('div', { class: 'client-ctrl-group' }, [btnSteer, btnKick, btnBan])
						])
					]));
				});
			}

			clientsSection.appendChild(E('div', { class: 'table-box' }, [
				E('table', { class: 'custom-table' }, [
					E('thead', {}, [
						E('tr', {}, [
							E('th', {}, 'الماك وبصمة الجهاز'),
							E('th', {}, 'بيانات المشترك والريديس'),
							E('th', {}, 'السرعة اللحظية الحالية'),
							E('th', {}, 'إجمالي استهلاك الجلسة'),
							E('th', { style: 'text-align:center;' }, 'الإشارة ومعدل الربط'),
							E('th', {}, 'الشبكة (IP / Iface)'),
							E('th', { style: 'text-align:center;' }, 'إجراءات التحكم')
						])
					]),
					E('tbody', {}, cTableRows)
				])
			]));
			viewApDetail.appendChild(clientsSection);

			// --- Section 4: Remote IP & Admin Password Settings ---
			var inNewIp = E('input', { type: 'text', value: ap.ip !== '-' ? ap.ip : '', placeholder: '192.168.169.224' });
			var inNetmask = E('input', { type: 'text', value: '255.255.255.0', placeholder: '255.255.255.0' });
			var inGateway = E('input', { type: 'text', value: '192.168.169.1', placeholder: '192.168.169.1' });
			var inHostname = E('input', { type: 'text', value: ap.hostname || '', placeholder: 'اسم الإكسس الجديد' });
			var inApAdminPass = E('input', { type: 'password', placeholder: 'كلمة السر الجديدة للوحة التحكم' });

			var btnApplyIp = E('button', { class: 'btn-primary' }, '💾 تغيير عنوان الـ IP والاسم وباسورد الإكسس فوراً عبر HMP');
			btnApplyIp.onclick = function() {
				var newIp = inNewIp.value.trim();
				var newHost = inHostname.value.trim();
				var newPass = inApAdminPass.value.trim();

				if (!newIp && !newHost && !newPass) { alert('يرجى كتابة عنوان IP أو اسم أو كلمة سر جديدة.'); return; }

				btnApplyIp.disabled = true;
				var payload = { target_ap: apMac, action: 'set_ip', ip: newIp, netmask: inNetmask.value.trim(), gateway: inGateway.value.trim(), hostname: newHost };
				fetch('/cgi-bin/horus_ap_action', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				}).then(function(){
					if (newPass) {
						fetch('/cgi-bin/horus_ap_action', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ target_ap: apMac, action: 'admin_password', password: newPass })
						});
					}
					btnApplyIp.disabled = false;
					ui.addNotification(null, E('p', '✅ تم حفظ وتطبيق إعدادات الشبكة والباسورد على الإكسس بنجاح!'));
				}).catch(function(){ btnApplyIp.disabled = false; });
			};

			var ipSection = E('div', { class: 'glass-card' }, [
				E('h3', { style: 'margin-top:0; color:#a855f7; font-size:17px;' }, '🌐 إعدادات الشبكة وباسورد الإكسس عن بعد (Remote Static IP & Admin Password)'),
				E('div', { class: 'form-row' }, [
					E('div', { class: 'form-field' }, [ E('label', {}, 'اسم الإكسس (Hostname):'), inHostname ]),
					E('div', { class: 'form-field' }, [ E('label', {}, 'عنوان الـ IP الجديد:'), inNewIp ]),
					E('div', { class: 'form-field' }, [ E('label', {}, 'قناع الشبكة (Netmask):'), inNetmask ]),
					E('div', { class: 'form-field' }, [ E('label', {}, 'البوابة (Gateway):'), inGateway ]),
					E('div', { class: 'form-field' }, [ E('label', {}, 'كلمة سر لوحة التحكم (Admin Password):'), inApAdminPass ])
				]),
				btnApplyIp
			]);
			viewApDetail.appendChild(ipSection);
		}

		// ----------------------------------------------------
		// RENDER MAIN DASHBOARD TABLE & SELECTION LOGIC
		// ----------------------------------------------------
		function updateBulkBar() {
			if (state.selectedAps.size > 0) {
				bulkBar.classList.remove('hidden');
				bulkTitle.textContent = '🎯 تم تحديد (' + state.selectedAps.size + ') إكسس - الإجراءات الجماعية:';
			} else {
				bulkBar.classList.add('hidden');
			}
		}

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
						updateBulkBar();
					};

					var dot = E('span', { class: ap.isOnline ? 'status-dot status-online' : 'status-dot status-offline' });
					var wifiBadges = [];
					if (ap.wifi && ap.wifi.length > 0) {
						ap.wifi.forEach(function(w) {
							var bColor = (w.band_code === '5g' || w.band === '5GHz') ? '#38bdf8' : '#4ade80';
							var bText = (w.band === '2.4GHz' ? '2.4G' : (w.band === '5GHz' ? '5G' : w.band)) + ' (قناة ' + w.channel + ' - ' + w.htmode + '): ' + (w.ssid || '-');
							wifiBadges.push(E('div', { style: 'margin:2px 0; padding:2px 8px; border-radius:4px; background:rgba(255,255,255,0.06); color:' + bColor + '; font-size:11px; font-weight:700;' }, bText));
						});
					} else {
						wifiBadges.push(E('span', { style: 'color:#64748b; font-size:11px;' }, '-'));
					}

					var btnManage = E('button', { class: 'btn-action btn-manage' }, '🖥️ تحكم وإدارة شاملة');
					btnManage.onclick = function() { openApDetailView(ap.mac); };

					var btnReboot = E('button', { class: 'btn-action btn-reboot' }, '🔄 ريستارت');
					btnReboot.onclick = function() {
						if (confirm('إعادة تشغيل الإكسس (' + ap.mac + ')؟')) {
							fetch('/cgi-bin/horus_ap_action', { method: 'POST', body: JSON.stringify({ target_ap: ap.mac, action: 'reboot' }) });
							ui.addNotification(null, E('p', 'تم إرسال أمر إعادة التشغيل'));
						}
					};

					dom.content(tr, [
						E('td', { style: 'text-align:center;' }, rowCb),
						E('td', {}, [dot, ' ', ap.isOnline ? 'متصل' : 'مفصول']),
						E('td', { style: 'font-weight:700; color:#f8fafc;' }, ap.hostname),
						E('td', {}, [
							E('div', { style: 'color:#38bdf8; font-family:monospace; font-weight:700;' }, ap.ip),
							E('div', { style: 'font-family:monospace; font-size:11px; color:#94a3b8;' }, ap.mac)
						]),
						E('td', {}, [
							E('div', { style: 'color:#38bdf8; font-weight:700; font-size:12px;' }, '⬇️ ' + (ap.stats.rx_speed || '0 bps')),
							E('div', { style: 'color:#4ade80; font-weight:700; font-size:12px;' }, '⬆️ ' + (ap.stats.tx_speed || '0 bps'))
						]),
						E('td', {}, [
							E('div', { style: 'font-size:12px; color:#cbd5e1; font-weight:600;' }, '🧠 ' + (ap.stats.cpu_load || '0.0') + ((ap.stats.cpu_temp && ap.stats.cpu_temp !== '-') ? ' | 🌡️ ' + ap.stats.cpu_temp : '')),
							E('div', { style: 'font-size:11px; color:#94a3b8;' }, '💾 ' + (ap.stats.mem_pct || 0) + '% RAM')
						]),
						E('td', {}, [
							E('span', { style: 'background:rgba(251,191,36,0.15); color:#fbbf24; padding:2px 8px; border-radius:10px; font-weight:700; margin-left:4px;' }, '📶 ' + ap.clients),
							ap.wired > 0 ? E('span', { style: 'background:rgba(56,189,248,0.15); color:#38bdf8; padding:2px 8px; border-radius:10px; font-weight:700;' }, '🔌 ' + ap.wired) : ''
						]),
						E('td', {}, wifiBadges),
						E('td', { style: 'text-align: center;' }, [btnManage, btnReboot])
					]);
					rows.push(tr);
				});
			}
			dom.content(tableBody, rows);
			updateBulkBar();
		}

		// Render Groups
		function renderGroups() {
			var gRows = [];
			if (state.groups.length === 0) {
				gRows.push(E('tr', {}, E('td', { colspan: 5, style: 'text-align:center; padding: 20px; color:#64748b;' }, 'لا توجد مجموعات حتى الآن.')));
			} else {
				state.groups.forEach(function(g) {
					var count = 0;
					Object.keys(state.assignments).forEach(function(mac) {
						if (state.assignments[mac] === g.id) count++;
					});

					var btnDel = E('button', { class: 'btn-action btn-kick' }, 'حذف 🗑️');
					btnDel.onclick = function() {
						if (confirm('حذف مجموعة (' + g.name + ')؟')) {
							fetch('/cgi-bin/horus_groups', { method: 'POST', body: JSON.stringify({ action: 'delete_group', group_id: g.id }) }).then(fetchNetworkData);
						}
					};

					var bandLabel = g.band === '2g' ? '2.4GHz فقط' : (g.band === '5g' ? '5GHz فقط' : 'الترددين معاً');

					gRows.push(E('tr', {}, [
						E('td', { style: 'font-weight:700;' }, g.name),
						E('td', {}, g.ssid),
						E('td', {}, E('span', { style: 'background:rgba(255,255,255,0.08); padding:3px 8px; border-radius:4px;' }, bandLabel)),
						E('td', {}, E('span', { style: 'color:#00e676; font-weight:700;' }, count)),
						E('td', {}, btnDel)
					]));
				});
			}
			dom.content(gTableBody, gRows);
		}

		var btnCreate = groupForm.querySelector('#btn_create_group');
		btnCreate.onclick = function() {
			var n = groupForm.querySelector('#g_name').value.trim();
			var s = groupForm.querySelector('#g_ssid').value.trim();
			var p = groupForm.querySelector('#g_pass').value.trim();
			var b = groupForm.querySelector('#g_band').value;

			if (!n || !s) { alert('يرجى كتابة اسم المجموعة واسم الشبكة'); return; }

			fetch('/cgi-bin/horus_groups', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'create_group', name: n, ssid: s, password: p, band: b })
			}).then(function(){
				ui.addNotification(null, E('p', 'تم إنشاء المجموعة بنجاح!'));
				groupForm.querySelector('#g_name').value = '';
				groupForm.querySelector('#g_ssid').value = '';
				groupForm.querySelector('#g_pass').value = '';
				fetchNetworkData();
			});
		};

		searchInput.oninput = renderDashboard;
		filterSelect.onchange = renderDashboard;

		fetchNetworkData();
		setInterval(fetchNetworkData, 4000);

		return container;
	}
});
