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

		// Professional Glassmorphism Styles
		var styles = E('style', {}, `
			.horus-dashboard { color: #f8fafc; }
			.glass-card { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 20px; margin-bottom: 22px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4); }
			
			.horus-tabs { display: flex; border-bottom: 2px solid rgba(255,255,255,0.1); margin-bottom: 20px; gap: 8px; }
			.horus-tab { padding: 12px 24px; cursor: pointer; font-size: 15px; font-weight: 700; color: #94a3b8; background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255,255,255,0.08); border-bottom: none; border-radius: 10px 10px 0 0; transition: all 0.2s; }
			.horus-tab.active { background: rgba(30, 41, 59, 0.9); color: #00e676; border-color: rgba(0, 230, 118, 0.4); border-bottom: 2px solid #00e676; margin-bottom: -2px; }
			.horus-tab:hover:not(.active) { background: rgba(51, 65, 85, 0.5); color: #f8fafc; }
			
			.dash-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 22px; }
			.dash-card { background: rgba(30, 41, 59, 0.6); backdrop-filter: blur(10px); padding: 20px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.08); text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.2); transition: transform 0.2s; }
			.dash-card:hover { transform: translateY(-2px); }
			.dash-card h3 { margin: 0; font-size: 32px; font-weight: 800; }
			.dash-card p { margin: 6px 0 0 0; font-size: 13px; font-weight: 600; color: #94a3b8; }
			.dash-card.total h3 { color: #38bdf8; text-shadow: 0 0 15px rgba(56, 189, 248, 0.3); }
			.dash-card.online h3 { color: #4ade80; text-shadow: 0 0 15px rgba(74, 222, 128, 0.3); }
			.dash-card.offline h3 { color: #f87171; text-shadow: 0 0 15px rgba(248, 113, 113, 0.3); }
			.dash-card.clients h3 { color: #fbbf24; text-shadow: 0 0 15px rgba(251, 191, 36, 0.3); }
			
			.toolbar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 12px; background: rgba(30, 41, 59, 0.5); padding: 14px 18px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08); }
			.toolbar input, .toolbar select { padding: 9px 14px; background: rgba(15, 23, 42, 0.6); color: #f8fafc; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; outline: none; font-size: 13px; }
			.toolbar input { flex-grow: 1; min-width: 220px; }
			.toolbar input:focus { border-color: #00e676; }
			
			.table-box { background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; overflow-x: auto; margin-bottom: 20px; }
			.custom-table { width: 100%; border-collapse: collapse; text-align: right; }
			.custom-table th { background: rgba(30, 41, 59, 0.8); padding: 14px 16px; font-size: 13px; font-weight: 700; color: #94a3b8; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
			.custom-table td { padding: 14px 16px; font-size: 13px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); color: #e2e8f0; }
			.custom-table tr:hover td { background: rgba(255, 255, 255, 0.03); }
			
			.status-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-left: 6px; }
			.status-online { background: #22c55e; box-shadow: 0 0 8px #22c55e; }
			.status-offline { background: #ef4444; box-shadow: 0 0 8px #ef4444; }
			
			.btn-action { padding: 6px 14px; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 700; margin-left: 5px; transition: all 0.2s; }
			.btn-manage { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: #fff; box-shadow: 0 2px 8px rgba(2, 132, 199, 0.3); }
			.btn-manage:hover { background: #0284c7; transform: translateY(-1px); }
			.btn-reboot { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); }
			.btn-reboot:hover { background: #f59e0b; color: #000; }
			.btn-kick { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); }
			.btn-kick:hover { background: #ef4444; color: #fff; }
			.btn-primary { padding: 10px 22px; background: linear-gradient(135deg, #00e676 0%, #00b0ff 100%); color: #000; border: none; border-radius: 8px; font-weight: 800; cursor: pointer; font-size: 14px; }
			.btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 15px rgba(0, 230, 118, 0.3); }
			
			/* Modal Box */
			.modal-box { padding: 14px; direction: rtl; text-align: right; color: #f8fafc; }
			.modal-tabs { display: flex; border-bottom: 2px solid rgba(255,255,255,0.1); margin-bottom: 18px; gap: 8px; }
			.modal-tab { padding: 9px 18px; cursor: pointer; font-weight: 700; font-size: 13px; color: #94a3b8; border-radius: 8px 8px 0 0; }
			.modal-tab.active { color: #00e676; background: rgba(0,230,118,0.1); border-bottom: 2px solid #00e676; }
			.modal-section { margin-bottom: 16px; }
			.modal-row { display: flex; gap: 14px; margin-bottom: 14px; flex-wrap: wrap; }
			.modal-field { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 5px; }
			.modal-field label { font-size: 12px; font-weight: 700; color: #cbd5e1; }
			.modal-field input, .modal-field select { padding: 9px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15); background: rgba(15, 23, 42, 0.6); color: #f8fafc; font-size: 13px; }
			.modal-field input:focus, .modal-field select:focus { border-color: #00e676; outline: none; }
			
			.hidden { display: none !important; }
		`);
		container.appendChild(styles);

		// Navigation Tabs
		var tabsNav = E('div', { class: 'horus-tabs' });
		var tabDash = E('div', { class: 'horus-tab active' }, '📊 لوحة التحكم والإكسسات (Dashboard)');
		var tabGroups = E('div', { class: 'horus-tab' }, '📁 المجموعات والقوالب (AP Groups)');
		tabsNav.appendChild(tabDash);
		tabsNav.appendChild(tabGroups);
		container.appendChild(tabsNav);

		// Views Containers
		var viewDash = E('div', { id: 'view-dashboard' });
		var viewGroups = E('div', { id: 'view-groups', class: 'hidden' });
		container.appendChild(viewDash);
		container.appendChild(viewGroups);

		// Tab Switching
		tabDash.onclick = function() {
			tabDash.classList.add('active'); tabGroups.classList.remove('active');
			viewDash.classList.remove('hidden'); viewGroups.classList.add('hidden');
		};
		tabGroups.onclick = function() {
			tabGroups.classList.add('active'); tabDash.classList.remove('active');
			viewGroups.classList.remove('hidden'); viewDash.classList.add('hidden');
		};

		// Dashboard View Elements
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
						E('th', {}, 'العملاء'),
						E('th', {}, 'ترددات الواي فاي'),
						E('th', { style: 'text-align: center;' }, 'إجراءات وتحكم')
					])
				]),
				tableBody
			])
		]);
		viewDash.appendChild(tableWrapper);

		// Groups View Elements
		var groupForm = E('div', { class: 'glass-card', style: 'text-align:right;' }, [
			E('h3', { style: 'margin-top:0; color:#00e676; font-size:17px;' }, '➕ إنشاء قالب مجموعة وايرليس جديدة'),
			E('div', { class: 'modal-row' }, [
				E('div', { class: 'modal-field' }, [ E('label', {}, 'اسم المجموعة:'), E('input', { id: 'g_name', placeholder: 'مثال: الدور الأول' }) ]),
				E('div', { class: 'modal-field' }, [ E('label', {}, 'اسم الشبكة (SSID):'), E('input', { id: 'g_ssid', placeholder: 'RedaNet_WiFi' }) ]),
				E('div', { class: 'modal-field' }, [ E('label', {}, 'كلمة السر:'), E('input', { id: 'g_pass', type: 'password', placeholder: 'كلمة سر الوايفاي' }) ]),
				E('div', { class: 'modal-field' }, [
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
			searchQuery: '',
			filterMode: 'all'
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

				// Build Radius lookup map
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
			});
		}

		// Modal: AP Comprehensive Control & Settings
		function openApControlModal(apMac) {
			var ap = state.data.aps[apMac] || {};
			var wifiList = ap.wifi || [];
			var cur2gSsid = '', cur5gSsid = '', curCh2g = 'auto', curCh5g = 'auto';

			wifiList.forEach(function(w) {
				if (w.band === '2g' || w.channel <= 14) { cur2gSsid = w.ssid || ''; curCh2g = w.channel || 'auto'; }
				else { cur5gSsid = w.ssid || ''; curCh5g = w.channel || 'auto'; }
			});

			var modalContent = E('div', { class: 'modal-box' });

			// Header
			modalContent.appendChild(E('div', { style: 'border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; margin-bottom: 16px;' }, [
				E('h3', { style: 'margin:0; color:#00e676; font-size:18px;' }, '⚙️ تحكم وإدارة الإكسس: ' + (ap.hostname || 'Unknown')),
				E('div', { style: 'font-size:12px; color:#94a3b8; margin-top:4px;' }, 'MAC: ' + apMac + ' | IP: ' + (ap.ip || '-'))
			]));

			// Tabs
			var mNav = E('div', { class: 'modal-tabs' });
			var mTabWifi = E('div', { class: 'modal-tab active' }, '📶 إعدادات الوايرليس');
			var mTabIp = E('div', { class: 'modal-tab' }, '🌐 عنوان الـ IP والشبكة');
			var mTabClients = E('div', { class: 'modal-tab' }, '👥 المتصلين (' + (ap.clients ? ap.clients.length : 0) + ')');
			var mTabOps = E('div', { class: 'modal-tab' }, '🛠️ عمليات الهاردوير');

			mNav.appendChild(mTabWifi);
			mNav.appendChild(mTabIp);
			mNav.appendChild(mTabClients);
			mNav.appendChild(mTabOps);
			modalContent.appendChild(mNav);

			var mSecWifi = E('div', { class: 'modal-section' });
			var mSecIp = E('div', { class: 'modal-section hidden' });
			var mSecClients = E('div', { class: 'modal-section hidden' });
			var mSecOps = E('div', { class: 'modal-section hidden' });

			modalContent.appendChild(mSecWifi);
			modalContent.appendChild(mSecIp);
			modalContent.appendChild(mSecClients);
			modalContent.appendChild(mSecOps);

			function switchModalTab(activeTab, activeSec) {
				[mTabWifi, mTabIp, mTabClients, mTabOps].forEach(function(t){ t.classList.remove('active'); });
				[mSecWifi, mSecIp, mSecClients, mSecOps].forEach(function(s){ s.classList.add('hidden'); });
				activeTab.classList.add('active');
				activeSec.classList.remove('hidden');
			}

			mTabWifi.onclick = function() { switchModalTab(mTabWifi, mSecWifi); };
			mTabIp.onclick = function() { switchModalTab(mTabIp, mSecIp); };
			mTabClients.onclick = function() { switchModalTab(mTabClients, mSecClients); };
			mTabOps.onclick = function() { switchModalTab(mTabOps, mSecOps); };

			// 1. WiFi Settings
			var inSsid = E('input', { type: 'text', value: cur2gSsid || cur5gSsid || '', placeholder: 'اسم الشبكة الجديد' });
			var inPass = E('input', { type: 'password', placeholder: 'كلمة السر الجديدة (8 أحرف فأكثر)' });
			var inBand = E('select', {}, [
				E('option', { value: 'both' }, 'الترددين معاً (2.4GHz + 5GHz)'),
				E('option', { value: '2g' }, 'تردد 2.4GHz فقط'),
				E('option', { value: '5g' }, 'تردد 5GHz فقط')
			]);
			var inChannel = E('select', {}, [
				E('option', { value: '' }, 'بدون تغيير'),
				E('option', { value: 'auto' }, 'Auto (تلقائي)')
			]);
			for (var ch = 1; ch <= 13; ch++) inChannel.appendChild(E('option', { value: ch.toString() }, 'قناة ' + ch + ' (2.4G)'));
			[36, 40, 44, 48, 149, 153, 157, 161, 165].forEach(function(ch5) {
				inChannel.appendChild(E('option', { value: ch5.toString() }, 'قناة ' + ch5 + ' (5G)'));
			});

			var inEnc = E('select', {}, [
				E('option', { value: '' }, 'بدون تغيير'),
				E('option', { value: 'psk2' }, 'WPA2-PSK (آمن وموصى به)'),
				E('option', { value: 'none' }, 'مفتوحة (بدون كلمة سر)'),
				E('option', { value: 'sae' }, 'WPA3-SAE (أحدث حماية)')
			]);

			var btnApplyWifi = E('button', { class: 'btn-primary', style: 'margin-top:12px;' }, '🚀 تطبيق إعدادات الوايرليس فوراً');
			btnApplyWifi.onclick = function() {
				var ssid = inSsid.value.trim();
				var pass = inPass.value.trim();
				var band = inBand.value;
				var channel = inChannel.value;
				var enc = inEnc.value;

				btnApplyWifi.disabled = true;
				btnApplyWifi.textContent = 'جاري الإرسال عبر HMP...';

				fetch('/cgi-bin/horus_wifi_action', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						target_ap: apMac,
						action: 'apply_profile',
						band: band,
						ssid: ssid,
						password: pass,
						channel: channel,
						encryption: enc
					})
				}).then(function(){
					btnApplyWifi.disabled = false;
					btnApplyWifi.textContent = '🚀 تطبيق إعدادات الوايرليس فوراً';
					ui.addNotification(null, E('p', '✅ تم إرسال أوامر ضبط الوايرليس إلى الإكسس بنجاح!'));
				}).catch(function() {
					btnApplyWifi.disabled = false;
					btnApplyWifi.textContent = '🚀 تطبيق إعدادات الوايرليس فوراً';
				});
			};

			mSecWifi.appendChild(E('div', {}, [
				E('div', { class: 'modal-row' }, [
					E('div', { class: 'modal-field' }, [ E('label', {}, 'اسم شبكة الواي فاي (SSID):'), inSsid ]),
					E('div', { class: 'modal-field' }, [ E('label', {}, 'كلمة السر الجديدة:'), inPass ])
				]),
				E('div', { class: 'modal-row' }, [
					E('div', { class: 'modal-field' }, [ E('label', {}, 'التردد المستهدف:'), inBand ]),
					E('div', { class: 'modal-field' }, [ E('label', {}, 'القناة (Channel):'), inChannel ]),
					E('div', { class: 'modal-field' }, [ E('label', {}, 'التشفير (Encryption):'), inEnc ])
				]),
				btnApplyWifi
			]));

			// 2. Network & IP Settings
			var inNewIp = E('input', { type: 'text', value: ap.ip !== '-' ? ap.ip : '', placeholder: '192.168.169.224' });
			var inNetmask = E('input', { type: 'text', value: '255.255.255.0', placeholder: '255.255.255.0' });
			var inGateway = E('input', { type: 'text', value: '192.168.169.1', placeholder: '192.168.169.1' });
			var inHostname = E('input', { type: 'text', value: ap.hostname || '', placeholder: 'اسم الإكسس الجديد' });

			var btnApplyIp = E('button', { class: 'btn-primary', style: 'margin-top:12px;' }, '💾 تغيير عنوان الـ IP والاسم فوراً');
			btnApplyIp.onclick = function() {
				var newIp = inNewIp.value.trim();
				var newHost = inHostname.value.trim();
				if (!newIp) { alert('يرجى كتابة عنوان IP صالح'); return; }

				if (confirm('هل أنت متأكد من تغيير عنوان IP الإكسس إلى (' + newIp + ')؟')) {
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
						ui.addNotification(null, E('p', '✅ تم إرسال أمر تغيير الـ IP إلى الإكسس بنجاح!'));
					});
				}
			};

			mSecIp.appendChild(E('div', {}, [
				E('div', { class: 'modal-row' }, [
					E('div', { class: 'modal-field' }, [ E('label', {}, 'اسم الإكسس (Hostname):'), inHostname ]),
					E('div', { class: 'modal-field' }, [ E('label', {}, 'عنوان الـ IP الجديد:'), inNewIp ])
				]),
				E('div', { class: 'modal-row' }, [
					E('div', { class: 'modal-field' }, [ E('label', {}, 'قناع الشبكة (Netmask):'), inNetmask ]),
					E('div', { class: 'modal-field' }, [ E('label', {}, 'البوابة الافتراضية (Gateway):'), inGateway ])
				]),
				btnApplyIp
			]));

			// 3. Connected Clients on this AP
			var clientsList = ap.clients || [];
			var cRows = [];
			if (clientsList.length === 0) {
				cRows.push(E('tr', {}, E('td', { colspan: 5, style: 'text-align:center; padding:15px; color:#64748b;' }, 'لا توجد أجهزة متصلة على هذا الإكسس حالياً.')));
			} else {
				clientsList.forEach(function(c) {
					var cmac = (c.mac || '').toUpperCase();
					var rUser = state.radiusMap[cmac] || {};
					var dispName = rUser.name || rUser.username || 'عميل محلي';
					var prof = rUser.profile ? ' (' + rUser.profile + ')' : '';

					var btnKick = E('button', { class: 'btn-action btn-kick' }, 'فصل ❌');
					btnKick.onclick = function() {
						if (confirm('فصل هذا العميل (' + cmac + ')؟')) {
							fetch('/cgi-bin/horus_ap_action', { method: 'POST', body: JSON.stringify({ target_ap: apMac, action: 'kick', mac: cmac }) });
							ui.addNotification(null, E('p', 'تم فصل العميل'));
						}
					};

					var btnBan = E('button', { class: 'btn-action', style: 'background:#7c3aed; color:#fff;' }, 'حظر 🚫');
					btnBan.onclick = function() {
						if (confirm('حظر هذا الماك (' + cmac + ') على جميع الإكسسات؟')) {
							fetch('/cgi-bin/horus_ban_action', { method: 'POST', body: JSON.stringify({ action: 'ban', mac: cmac, scope: 'all', duration: 0 }) });
							ui.addNotification(null, E('p', 'تم إضافة الماك لقائمة الحظر'));
						}
					};

					cRows.push(E('tr', {}, [
						E('td', { style: 'font-family:monospace; font-weight:bold; color:#38bdf8;' }, cmac),
						E('td', {}, [E('span', { style: 'color:#00e676; font-weight:bold;' }, dispName), E('small', { style: 'color:#80deea;' }, prof)]),
						E('td', {}, (c.signal || '-') + ' dBm'),
						E('td', {}, c.iface || '-'),
						E('td', {}, [btnKick, btnBan])
					]));
				});
			}

			mSecClients.appendChild(E('div', { class: 'table-box' }, [
				E('table', { class: 'custom-table' }, [
					E('thead', {}, [
						E('tr', {}, [
							E('th', {}, 'الماك (MAC)'),
							E('th', {}, 'المشترك (Radius)'),
							E('th', {}, 'الإشارة'),
							E('th', {}, 'الواجهة'),
							E('th', {}, 'تحكم')
						])
					]),
					E('tbody', {}, cRows)
				])
			]));

			// 4. Hardware Operations
			var btnReboot = E('button', { class: 'btn-action btn-reboot', style: 'padding:10px 18px; font-size:13px; margin:5px;' }, '🔄 إعادة تشغيل الإكسس (Reboot)');
			btnReboot.onclick = function() {
				if (confirm('هل أنت متأكد من إعادة تشغيل الإكسس (' + apMac + ')؟')) {
					fetch('/cgi-bin/horus_ap_action', { method: 'POST', body: JSON.stringify({ target_ap: apMac, action: 'reboot' }) });
					ui.addNotification(null, E('p', 'تم إرسال أمر إعادة التشغيل'));
				}
			};

			var btnWifiRestart = E('button', { class: 'btn-action btn-manage', style: 'padding:10px 18px; font-size:13px; margin:5px;' }, '📶 إعادة تشغيل الواي فاي (Restart WiFi)');
			btnWifiRestart.onclick = function() {
				fetch('/cgi-bin/horus_wifi_action', { method: 'POST', body: JSON.stringify({ target_ap: apMac, action: 'restart_wifi' }) });
				ui.addNotification(null, E('p', 'تم إعادة تشغيل الوايرليس'));
			};

			var btnWifiOff = E('button', { class: 'btn-action btn-kick', style: 'padding:10px 18px; font-size:13px; margin:5px;' }, '📴 إيقاف بث الواي فاي (Radio Off)');
			btnWifiOff.onclick = function() {
				fetch('/cgi-bin/horus_ap_action', { method: 'POST', body: JSON.stringify({ target_ap: apMac, action: 'wifi_radio', state: '1' }) });
				ui.addNotification(null, E('p', 'تم إيقاف بث الوايرليس'));
			};

			var btnWifiOn = E('button', { class: 'btn-action btn-manage', style: 'background:#16a34a; padding:10px 18px; font-size:13px; margin:5px;' }, '✔️ تشغيل بث الواي فاي (Radio On)');
			btnWifiOn.onclick = function() {
				fetch('/cgi-bin/horus_ap_action', { method: 'POST', body: JSON.stringify({ target_ap: apMac, action: 'wifi_radio', state: '0' }) });
				ui.addNotification(null, E('p', 'تم تشغيل بث الوايرليس'));
			};

			mSecOps.appendChild(E('div', { style: 'display:flex; flex-wrap:wrap; gap:10px; padding:10px;' }, [
				btnReboot, btnWifiRestart, btnWifiOff, btnWifiOn
			]));

			ui.showModal(_('لوحة تحكم الإكسس'), [
				modalContent,
				E('div', { class: 'right', style: 'margin-top:15px;' }, [
					E('button', { class: 'btn', click: ui.hideModal }, _('إغلاق'))
				])
			]);
		}

		// Render Dashboard
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
							var bText = (w.band === '2g' ? '2.4G' : (w.band === '5g' ? '5G' : 'WiFi')) + ': ' + (w.ssid || '-');
							wifiBadges.push(E('span', { style: 'display:inline-block; margin:2px; padding:2px 8px; border-radius:4px; background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.3); font-size:11px; font-weight:600;' }, bText));
						});
					} else {
						wifiBadges.push(E('span', { style: 'color:#64748b; font-size:11px;' }, '-'));
					}

					var btnManage = E('button', { class: 'btn-action btn-manage' }, '⚙️ تحكم وإعدادات');
					btnManage.onclick = function() { openApControlModal(ap.mac); };

					var btnReboot = E('button', { class: 'btn-action btn-reboot' }, '🔄 إعادة تشغيل');
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
						E('td', {}, E('span', { style: 'background:rgba(251,191,36,0.15); color:#fbbf24; padding:2px 10px; border-radius:12px; font-weight:700;' }, ap.clients)),
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

		// Create Group
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
