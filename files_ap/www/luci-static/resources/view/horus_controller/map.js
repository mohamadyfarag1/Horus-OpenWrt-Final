'use strict';
'require view';
'require dom';
'require ui';

return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	render: function() {
		var container = E('div', { class: 'horus-dashboard', id: 'horus-dashboard-container' });

		// 1. Theme-Adaptive Modern Dark/Light Styles
		var styles = E('style', {}, `
			.horus-dashboard { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; direction: rtl; color: inherit; }
			.horus-tabs { display: flex; border-bottom: 2px solid rgba(128,128,128,0.3); margin-bottom: 20px; }
			.horus-tab { padding: 10px 22px; cursor: pointer; font-size: 15px; font-weight: bold; color: inherit; opacity: 0.7; background: rgba(128,128,128,0.06); border: 1px solid transparent; border-bottom: none; border-radius: 8px 8px 0 0; margin-left: 6px; transition: 0.2s; }
			.horus-tab.active { background: rgba(0, 123, 255, 0.15); opacity: 1; color: #00e676; border-color: rgba(0, 230, 118, 0.4); border-bottom-color: transparent; margin-bottom: -2px; }
			.horus-tab:hover:not(.active) { background: rgba(128,128,128,0.12); opacity: 0.95; }
			
			.dash-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
			.dash-card { background: rgba(128,128,128,0.06); padding: 18px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); border: 1px solid rgba(128,128,128,0.2); text-align: center; color: inherit; }
			.dash-card h3 { margin: 0; font-size: 30px; font-weight: bold; color: inherit; }
			.dash-card p { margin: 5px 0 0 0; opacity: 0.85; font-size: 14px; font-weight: 500; }
			.dash-card.total { border-bottom: 4px solid #007bff; }
			.dash-card.online { border-bottom: 4px solid #00e676; }
			.dash-card.offline { border-bottom: 4px solid #ff5252; }
			.dash-card.clients { border-bottom: 4px solid #ffd54f; }
			
			.toolbar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; margin-bottom: 15px; gap: 10px; background: rgba(128,128,128,0.06); padding: 14px; border-radius: 8px; border: 1px solid rgba(128,128,128,0.2); }
			.toolbar input, .toolbar select { padding: 8px 12px; background: rgba(128,128,128,0.1); color: inherit; border: 1px solid rgba(128,128,128,0.3); border-radius: 4px; outline: none; font-size: 14px; }
			.toolbar input { flex-grow: 1; min-width: 200px; }
			
			.table-wrapper { background: rgba(128,128,128,0.04); border-radius: 8px; overflow-x: auto; border: 1px solid rgba(128,128,128,0.2); margin-bottom: 20px; }
			.table-wrapper table { width: 100%; border-collapse: collapse; }
			.table-wrapper th, .table-wrapper td { padding: 12px 14px; text-align: right; border-bottom: 1px solid rgba(128,128,128,0.15); font-size: 13px; }
			.table-wrapper th { background: rgba(128,128,128,0.12); font-weight: bold; border-bottom: 2px solid rgba(128,128,128,0.25); }
			.table-wrapper tr:hover { background: rgba(128,128,128,0.08); }
			
			.status-dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-left: 6px; }
			.status-online { background: #00e676; box-shadow: 0 0 6px #00e676; }
			.status-offline { background: #ff5252; box-shadow: 0 0 6px #ff5252; }
			
			.btn-action { padding: 5px 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold; margin-left: 4px; transition: 0.2s; }
			.btn-manage { background: #007bff; color: #fff; }
			.btn-manage:hover { background: #0056b3; }
			.btn-reboot { background: #ff9800; color: #fff; }
			.btn-reboot:hover { background: #e65100; }
			.btn-kick { background: #dc3545; color: #fff; }
			.btn-kick:hover { background: #bd2130; }
			.btn-primary { padding: 9px 18px; background: #00e676; color: #000; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 14px; }
			.btn-primary:hover { background: #00c853; }
			
			.modal-box { padding: 10px; direction: rtl; text-align: right; }
			.modal-tabs { display: flex; border-bottom: 1px solid rgba(128,128,128,0.3); margin-bottom: 15px; }
			.modal-tab { padding: 8px 16px; cursor: pointer; font-weight: bold; font-size: 13px; opacity: 0.7; border-bottom: 2px solid transparent; }
			.modal-tab.active { opacity: 1; color: #00e676; border-bottom-color: #00e676; }
			.modal-section { margin-bottom: 15px; }
			.modal-row { display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
			.modal-field { flex: 1; min-width: 180px; display: flex; flex-direction: column; }
			.modal-field label { font-size: 12px; font-weight: bold; margin-bottom: 4px; opacity: 0.85; }
			.modal-field input, .modal-field select { padding: 8px 10px; border-radius: 4px; border: 1px solid rgba(128,128,128,0.3); background: rgba(128,128,128,0.1); color: inherit; font-size: 13px; }
			
			.hidden { display: none !important; }
		`);
		container.appendChild(styles);

		// 2. Navigation Tabs
		var tabsNav = E('div', { class: 'horus-tabs' });
		var tabDash = E('div', { class: 'horus-tab active' }, '📊 لوحة التحكم والإكسسات (Dashboard)');
		var tabGroups = E('div', { class: 'horus-tab' }, '📁 المجموعات والقوالب (AP Groups)');
		tabsNav.appendChild(tabDash);
		tabsNav.appendChild(tabGroups);
		container.appendChild(tabsNav);

		// 3. Views Containers
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

		// 4. Dashboard View Elements
		var cardsDiv = E('div', { class: 'dash-cards' });
		viewDash.appendChild(cardsDiv);

		var toolbar = E('div', { class: 'toolbar' });
		var searchInput = E('input', { type: 'text', placeholder: '🔍 بحث بالاسم، الآي بي، أو الماك...' });
		var filterSelect = E('select', {}, [
			E('option', { value: 'all' }, 'جميع الإكسسات'),
			E('option', { value: 'online' }, 'المتصلة فقط 🟢'),
			E('option', { value: 'offline' }, 'المفصولة فقط 🔴')
		]);
		toolbar.appendChild(searchInput);
		toolbar.appendChild(filterSelect);
		viewDash.appendChild(toolbar);

		var tableBody = E('tbody');
		var tableWrapper = E('div', { class: 'table-wrapper' }, [
			E('table', {}, [
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

		// 5. Groups View Elements
		var groupForm = E('div', { class: 'dash-card', style: 'text-align:right; margin-bottom:20px;' }, [
			E('h4', { style: 'margin-top:0; color:#00e676;' }, '➕ إنشاء قالب مجموعة وايرليس جديدة'),
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
		var gTableWrapper = E('div', { class: 'table-wrapper' }, [
			E('table', {}, [
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

		// ----------------------------------------------------
		// STATE & DATA MANAGEMENT
		// ----------------------------------------------------
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

		// ----------------------------------------------------
		// MODAL: AP COMPREHENSIVE CONTROL & SETTINGS
		// ----------------------------------------------------
		function openApControlModal(apMac) {
			var ap = state.data.aps[apMac] || {};
			var wifiList = ap.wifi || [];
			var cur2gSsid = '', cur5gSsid = '', curCh2g = 'auto', curCh5g = 'auto';

			wifiList.forEach(function(w) {
				if (w.band === '2g' || w.channel <= 14) { cur2gSsid = w.ssid || ''; curCh2g = w.channel || 'auto'; }
				else { cur5gSsid = w.ssid || ''; curCh5g = w.channel || 'auto'; }
			});

			var modalContent = E('div', { class: 'modal-box' });

			// Modal Header
			modalContent.appendChild(E('div', { style: 'border-bottom: 2px solid rgba(0,230,118,0.4); padding-bottom: 8px; margin-bottom: 15px;' }, [
				E('h3', { style: 'margin:0; color:#00e676;' }, '⚙️ تحكم وإدارة الإكسس: ' + (ap.hostname || 'Unknown')),
				E('div', { style: 'font-size:12px; color:#b0bec5; margin-top:4px;' }, 'MAC: ' + apMac + ' | IP: ' + (ap.ip || '-'))
			]));

			// Modal Tabs Nav
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

			// Modal Tab Sections
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

			// --- Section 1: WiFi Settings ---
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

			var btnApplyWifi = E('button', { class: 'btn-primary', style: 'margin-top:10px;' }, '🚀 تطبيق إعدادات الوايرليس فوراً');
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
				}).then(function(r){ return r.json(); }).then(function(res) {
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

			// --- Section 2: Network & IP Settings ---
			var inNewIp = E('input', { type: 'text', value: ap.ip !== '-' ? ap.ip : '', placeholder: '192.168.169.224' });
			var inNetmask = E('input', { type: 'text', value: '255.255.255.0', placeholder: '255.255.255.0' });
			var inGateway = E('input', { type: 'text', value: '192.168.169.1', placeholder: '192.168.169.1' });
			var inHostname = E('input', { type: 'text', value: ap.hostname || '', placeholder: 'اسم الإكسس الجديد' });

			var btnApplyIp = E('button', { class: 'btn-primary', style: 'margin-top:10px;' }, '💾 تغيير عنوان الـ IP والاسم فوراً');
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

			// --- Section 3: Connected Clients on this AP ---
			var clientsList = ap.clients || [];
			var cRows = [];
			if (clientsList.length === 0) {
				cRows.push(E('tr', {}, E('td', { colspan: 5, style: 'text-align:center; padding:15px;' }, 'لا توجد أجهزة متصلة على هذا الإكسس حالياً.')));
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

					var btnBan = E('button', { class: 'btn-action', style: 'background:#6a1b9a; color:#fff;' }, 'حظر 🚫');
					btnBan.onclick = function() {
						if (confirm('حظر هذا الماك (' + cmac + ') على جميع الإكسسات؟')) {
							fetch('/cgi-bin/horus_ban_action', { method: 'POST', body: JSON.stringify({ action: 'ban', mac: cmac, scope: 'all', duration: 0 }) });
							ui.addNotification(null, E('p', 'تم إضافة الماك لقائمة الحظر'));
						}
					};

					cRows.push(E('tr', {}, [
						E('td', { style: 'font-family:monospace; font-weight:bold;' }, cmac),
						E('td', {}, [E('span', { style: 'color:#00e676; font-weight:bold;' }, dispName), E('small', { style: 'color:#80deea;' }, prof)]),
						E('td', {}, (c.signal || '-') + ' dBm'),
						E('td', {}, c.iface || '-'),
						E('td', {}, [btnKick, btnBan])
					]));
				});
			}

			mSecClients.appendChild(E('div', { class: 'table-wrapper' }, [
				E('table', {}, [
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

			// --- Section 4: Hardware Operations ---
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

			var btnWifiOn = E('button', { class: 'btn-action btn-manage', style: 'background:#00c853; padding:10px 18px; font-size:13px; margin:5px;' }, '✔️ تشغيل بث الواي فاي (Radio On)');
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

		// ----------------------------------------------------
		// RENDER DASHBOARD
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
				rows.push(E('tr', {}, E('td', { colspan: 8, style: 'text-align:center; padding: 25px; color: #888;' }, 'لا توجد إكسسات مطابقة.')));
			} else {
				filtered.forEach(function(ap) {
					var dot = E('span', { class: ap.isOnline ? 'status-dot status-online' : 'status-dot status-offline' });
					var wifiBadges = [];
					if (ap.wifi && ap.wifi.length > 0) {
						ap.wifi.forEach(function(w) {
							var bText = (w.band === '2g' ? '2.4G' : (w.band === '5g' ? '5G' : 'WiFi')) + ': ' + (w.ssid || '-');
							wifiBadges.push(E('span', { style: 'display:inline-block; margin:2px; padding:2px 6px; border-radius:3px; background:rgba(0,230,118,0.1); border:1px solid rgba(0,230,118,0.3); font-size:11px;' }, bText));
						});
					} else {
						wifiBadges.push(E('span', { style: 'color:#888; font-size:11px;' }, '-'));
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
						E('td', { style: 'font-weight:bold;' }, ap.hostname),
						E('td', { style: 'color:#80deea; font-family:monospace;' }, ap.ip),
						E('td', { style: 'font-family:monospace;' }, ap.mac),
						E('td', { style: 'color:#007bff; font-weight:bold;' }, ap.group),
						E('td', {}, E('span', { style: 'background:rgba(255,213,79,0.15); color:#ffd54f; padding:2px 8px; border-radius:10px; font-weight:bold;' }, ap.clients)),
						E('td', {}, wifiBadges),
						E('td', { style: 'text-align: center;' }, [btnManage, btnReboot])
					]));
				});
			}
			dom.content(tableBody, rows);
		}

		// ----------------------------------------------------
		// RENDER GROUPS
		// ----------------------------------------------------
		function renderGroups() {
			var gRows = [];
			if (state.groups.length === 0) {
				gRows.push(E('tr', {}, E('td', { colspan: 5, style: 'text-align:center; padding: 20px;' }, 'لا توجد مجموعات حتى الآن.')));
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
						E('td', { style: 'font-weight:bold;' }, g.name),
						E('td', {}, g.ssid),
						E('td', {}, E('span', { style: 'background:rgba(128,128,128,0.15); padding:2px 6px; border-radius:3px;' }, bandLabel)),
						E('td', {}, E('span', { style: 'color:#00e676; font-weight:bold;' }, count)),
						E('td', {}, btnDel)
					]));
				});
			}
			dom.content(gTableBody, gRows);
		}

		// Create Group Action
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
