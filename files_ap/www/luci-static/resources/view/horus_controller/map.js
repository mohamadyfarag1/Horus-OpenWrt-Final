'use strict';
'require view';
'require dom';
'require ui';

return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	render: function() {
		var container = E('div', { class: 'horus-dashboard', id: 'horus-dashboard-container', style: 'direction:rtl; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;' });

		// Professional Modern Dark Palette
		var styles = E('style', {}, `
			.horus-dashboard { color: #f8fafc; }
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
			
			.toolbar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 12px; background: rgba(30, 41, 59, 0.5); padding: 14px 18px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08); }
			.toolbar input, .toolbar select { padding: 9px 14px; background: rgba(15, 23, 42, 0.6); color: #f8fafc; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; outline: none; font-size: 13px; }
			.toolbar input { flex-grow: 1; min-width: 220px; }
			
			.table-box { background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; overflow-x: auto; margin-bottom: 20px; }
			.custom-table { width: 100%; border-collapse: collapse; text-align: right; }
			.custom-table th { background: rgba(30, 41, 59, 0.8); padding: 14px 16px; font-size: 13px; font-weight: 700; color: #94a3b8; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
			.custom-table td { padding: 14px 16px; font-size: 13px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); color: #e2e8f0; }
			.custom-table tr:hover td { background: rgba(255, 255, 255, 0.03); }
			
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
			
			/* Full Dedicated AP Management View */
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
			
			.hidden { display: none !important; }
		`);
		container.appendChild(styles);

		// Navigation Tabs
		var tabsNav = E('div', { class: 'horus-tabs' });
		var tabDash = E('div', { class: 'horus-tab active' }, '📊 لوحة التحكم والإكسسات (Overview)');
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

		// Tab Switching
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

		var tableBody = E('tbody');
		var tableWrapper = E('div', { class: 'table-box' }, [
			E('table', { class: 'custom-table' }, [
				E('thead', {}, [
					E('tr', {}, [
						E('th', {}, 'الحالة'),
						E('th', {}, 'اسم الإكسس / Hostname'),
						E('th', {}, 'عنوان الـ IP'),
						E('th', {}, 'الماك (MAC)'),
						E('th', {}, 'المجموعة'),
						E('th', {}, 'العملاء (واي فاي / كابل)'),
						E('th', {}, 'ترددات وقنوات الواي فاي'),
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

			// --- Section 1: Independent Radios (2.4GHz & 5GHz) ---
			var radiosGrid = E('div', { class: 'radios-grid' });

			// Filter or find 2.4G and 5G radios
			var radio2g = wifiList.find(function(w){ return w.band_code === '2g' || w.band === '2.4GHz' || w.channel <= 14; }) || { band: '2.4GHz', band_code: '2g', channel: '1', htmode: 'HT20', ssid: 'RedaNet LG', disabled: false };
			var radio5g = wifiList.find(function(w){ return w.band_code === '5g' || w.band === '5GHz' || w.channel >= 36; }) || { band: '5GHz', band_code: '5g', channel: '157', htmode: 'VHT80', ssid: 'ras2ac', disabled: false };

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

					// Toggle Button
					var btnPortToggle = E('button', { class: 'btn-sm-op', style: isUp ? 'background:rgba(239,68,68,0.2); color:#f87171;' : 'background:rgba(34,197,94,0.2); color:#4ade80;' }, isUp ? '📴 إيقاف المنفذ' : '✔️ تفعيل المنفذ');
					btnPortToggle.onclick = function() {
						var nState = isUp ? 'down' : 'up';
						fetch('/cgi-bin/horus_ap_action', { method: 'POST', body: JSON.stringify({ target_ap: apMac, action: 'port_state', port: p.port, state: nState }) });
						ui.addNotification(null, E('p', 'تم إرسال أمر ' + (nState === 'up' ? 'تفعيل' : 'إيقاف') + ' للمنفذ: ' + p.label));
					};
					pCard.appendChild(btnPortToggle);

					// Wired Clients list on this port
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
				cTableRows.push(E('tr', {}, E('td', { colspan: 6, style: 'text-align:center; padding:20px; color:#64748b;' }, 'لا توجد أجهزة متصلة لاسلكياً على هذا الإكسس حالياً.')));
			} else {
				clientsList.forEach(function(c) {
					var cmac = (c.mac || '').toUpperCase();
					var rUser = state.radiusMap[cmac] || {};
					var dispName = rUser.name || rUser.username || 'مشترك محلي';
					var prof = rUser.profile ? ' (' + rUser.profile + ')' : '';
					var quota = rUser.quota ? ' | متبقي: ' + rUser.quota : '';

					var btnKick = E('button', { class: 'btn-action btn-kick' }, 'فصل ❌');
					btnKick.onclick = function() {
						if (confirm('فصل العميل (' + cmac + ')؟')) {
							fetch('/cgi-bin/horus_ap_action', { method: 'POST', body: JSON.stringify({ target_ap: apMac, action: 'kick', mac: cmac }) });
							ui.addNotification(null, E('p', 'تم فصل العميل'));
						}
					};

					var btnBan = E('button', { class: 'btn-action', style: 'background:#7c3aed; color:#fff;' }, 'حظر 🚫');
					btnBan.onclick = function() {
						if (confirm('حظر هذا الماك (' + cmac + ') على جميع الإكسسات؟')) {
							fetch('/cgi-bin/horus_ban_action', { method: 'POST', body: JSON.stringify({ action: 'ban', mac: cmac, scope: 'all', duration: 0 }) });
							ui.addNotification(null, E('p', 'تم حظر الماك'));
						}
					};

					cTableRows.push(E('tr', {}, [
						E('td', { style: 'font-family:monospace; font-weight:700; color:#38bdf8;' }, cmac),
						E('td', {}, [
							E('span', { style: 'color:#00e676; font-weight:700;' }, dispName),
							E('small', { style: 'color:#80deea;' }, prof + quota)
						]),
						E('td', {}, (c.signal || '-') + ' dBm'),
						E('td', {}, c.iface || '-'),
						E('td', {}, rUser.ip || '-'),
						E('td', { style: 'text-align:center;' }, [btnKick, btnBan])
					]));
				});
			}

			clientsSection.appendChild(E('div', { class: 'table-box' }, [
				E('table', { class: 'custom-table' }, [
					E('thead', {}, [
						E('tr', {}, [
							E('th', {}, 'الماك (MAC)'),
							E('th', {}, 'المشترك (Radius Details)'),
							E('th', {}, 'قوة الإشارة'),
							E('th', {}, 'الواجهة'),
							E('th', {}, 'عنوان الآي بي'),
							E('th', { style: 'text-align:center;' }, 'تحكم')
						])
					]),
					E('tbody', {}, cTableRows)
				])
			]));
			viewApDetail.appendChild(clientsSection);

			// --- Section 4: Remote IP & Hostname Settings ---
			var inNewIp = E('input', { type: 'text', value: ap.ip !== '-' ? ap.ip : '', placeholder: '192.168.169.224' });
			var inNetmask = E('input', { type: 'text', value: '255.255.255.0', placeholder: '255.255.255.0' });
			var inGateway = E('input', { type: 'text', value: '192.168.169.1', placeholder: '192.168.169.1' });
			var inHostname = E('input', { type: 'text', value: ap.hostname || '', placeholder: 'اسم الإكسس الجديد' });

			var btnApplyIp = E('button', { class: 'btn-primary' }, '💾 تغيير عنوان الـ IP والاسم فوراً عبر HMP');
			btnApplyIp.onclick = function() {
				var newIp = inNewIp.value.trim();
				var newHost = inHostname.value.trim();
				if (!newIp) { alert('يرجى كتابة عنوان IP صالح'); return; }

				if (confirm('تغيير عنوان IP الإكسس إلى (' + newIp + ')؟')) {
					btnApplyIp.disabled = true;
					fetch('/cgi-bin/horus_ap_action', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							target_ap: apMac,
							action: 'set_ip',
							ip: newIp,
							netmask: inNetmask.value.trim(),
							gateway: inGateway.value.trim(),
							hostname: newHost
						})
					}).then(function(){
						btnApplyIp.disabled = false;
						ui.addNotification(null, E('p', '✅ تم إرسال أمر ضبط الـ IP بنجاح!'));
					});
				}
			};

			var ipSection = E('div', { class: 'glass-card' }, [
				E('h3', { style: 'margin-top:0; color:#a855f7; font-size:17px;' }, '🌐 إعدادات الشبكة وعنوان الـ IP عن بعد (Remote Static IP)'),
				E('div', { class: 'form-row' }, [
					E('div', { class: 'form-field' }, [ E('label', {}, 'اسم الإكسس (Hostname):'), inHostname ]),
					E('div', { class: 'form-field' }, [ E('label', {}, 'عنوان الـ IP الجديد:'), inNewIp ]),
					E('div', { class: 'form-field' }, [ E('label', {}, 'قناع الشبكة (Netmask):'), inNetmask ]),
					E('div', { class: 'form-field' }, [ E('label', {}, 'البوابة (Gateway):'), inGateway ])
				]),
				btnApplyIp
			]);
			viewApDetail.appendChild(ipSection);
		}

		// ----------------------------------------------------
		// RENDER MAIN DASHBOARD TABLE
		// ----------------------------------------------------
		function renderDashboard() {
			var aps = state.data.aps || {};
			var apKeys = Object.keys(aps);
			var total = apKeys.length;
			var online = 0, offline = 0, totalClients = 0;
			var now = Math.floor(Date.now() / 1000);
			var processed = [];

			apKeys.forEach(function(mac) {
				var ap = aps[mac];
				var isOnline = (now - (ap.last_seen || 0)) < 35;
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
					wifi: ap.wifi || []
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
				rows.push(E('tr', {}, E('td', { colspan: 8, style: 'text-align:center; padding: 25px; color: #64748b;' }, 'لا توجد إكسسات مطابقة.')));
			} else {
				filtered.forEach(function(ap) {
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

					rows.push(E('tr', {}, [
						E('td', {}, [dot, ' ', ap.isOnline ? 'متصل' : 'مفصول']),
						E('td', { style: 'font-weight:700; color:#f8fafc;' }, ap.hostname),
						E('td', { style: 'color:#38bdf8; font-family:monospace;' }, ap.ip),
						E('td', { style: 'font-family:monospace; color:#94a3b8;' }, ap.mac),
						E('td', { style: 'color:#a855f7; font-weight:700;' }, ap.group),
						E('td', {}, [
							E('span', { style: 'background:rgba(251,191,36,0.15); color:#fbbf24; padding:2px 8px; border-radius:10px; font-weight:700; margin-left:4px;' }, '📶 ' + ap.clients),
							ap.wired > 0 ? E('span', { style: 'background:rgba(56,189,248,0.15); color:#38bdf8; padding:2px 8px; border-radius:10px; font-weight:700;' }, '🔌 ' + ap.wired) : ''
						]),
						E('td', {}, wifiBadges),
						E('td', { style: 'text-align: center;' }, [btnManage, btnReboot])
					]));
				});
			}
			dom.content(tableBody, rows);
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
