'use strict';
'require view';
'require ui';
'require dom';

return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	render: function() {
		var container = E('div', { class: 'horus-ban-view', style: 'direction:rtl; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;' });

		// Professional Dark/Glassmorphism Theme Styles
		var styles = E('style', {}, `
			.horus-ban-view { color: #f8fafc; }
			.glass-card { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 22px; margin-bottom: 22px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4); }
			.card-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 14px; margin-bottom: 20px; }
			.card-title { font-size: 18px; font-weight: 700; color: #00e676; margin: 0; display: flex; align-items: center; gap: 8px; }
			.card-desc { font-size: 13px; color: #94a3b8; margin: 4px 0 0 0; }
			
			.horus-tabs { display: flex; border-bottom: 2px solid rgba(255,255,255,0.1); margin-bottom: 20px; gap: 8px; }
			.horus-tab { padding: 12px 24px; cursor: pointer; font-size: 14px; font-weight: 700; color: #94a3b8; background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255,255,255,0.08); border-bottom: none; border-radius: 10px 10px 0 0; transition: all 0.2s; }
			.horus-tab.active { background: rgba(30, 41, 59, 0.9); color: #00e676; border-color: rgba(0, 230, 118, 0.4); border-bottom: 2px solid #00e676; margin-bottom: -2px; }
			.horus-tab:hover:not(.active) { background: rgba(51, 65, 85, 0.5); color: #f8fafc; }
			
			.form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 20px; }
			.form-group { display: flex; flex-direction: column; gap: 6px; }
			.form-label { font-size: 13px; font-weight: 600; color: #cbd5e1; display: flex; align-items: center; gap: 6px; }
			.form-control { background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 10px 14px; color: #f8fafc; font-size: 14px; outline: none; transition: all 0.2s; }
			.form-control:focus { border-color: #00e676; box-shadow: 0 0 0 3px rgba(0, 230, 118, 0.2); }
			.form-control option { background: #0f172a; color: #f8fafc; }
			
			/* AP Selection Grid */
			.ap-select-box { background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 16px; margin-bottom: 20px; }
			.ap-select-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px; }
			.ap-select-title { font-size: 14px; font-weight: bold; color: #38bdf8; display: flex; align-items: center; gap: 6px; }
			.ap-tools { display: flex; gap: 8px; }
			.btn-tool { padding: 4px 12px; font-size: 12px; font-weight: 600; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.05); color: #cbd5e1; cursor: pointer; transition: 0.2s; }
			.btn-tool:hover { background: rgba(255,255,255,0.15); color: #fff; }
			
			.ap-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; max-height: 220px; overflow-y: auto; padding: 4px; }
			.ap-tile { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; cursor: pointer; transition: all 0.2s; user-select: none; }
			.ap-tile:hover { background: rgba(51, 65, 85, 0.6); border-color: rgba(255, 255, 255, 0.25); transform: translateY(-1px); }
			.ap-tile.selected { background: rgba(0, 230, 118, 0.12); border-color: #00e676; box-shadow: 0 0 10px rgba(0, 230, 118, 0.15); }
			.ap-tile input[type="checkbox"] { width: 18px; height: 18px; accent-color: #00e676; cursor: pointer; }
			.ap-tile-info { display: flex; flex-direction: column; gap: 2px; }
			.ap-tile-name { font-size: 13px; font-weight: 700; color: #f8fafc; }
			.ap-tile-sub { font-size: 11px; color: #94a3b8; font-family: monospace; }
			
			/* Action Buttons */
			.btn-ban-submit { width: 100%; padding: 14px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3); transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; }
			.btn-ban-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(239, 68, 68, 0.45); }
			
			.btn-unban { padding: 6px 14px; background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.4); border-radius: 6px; font-weight: 700; font-size: 12px; cursor: pointer; transition: 0.2s; }
			.btn-unban:hover { background: #22c55e; color: #000; }
			
			/* Tables */
			.table-box { background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; overflow-x: auto; margin-top: 16px; }
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

		// Navigation Tabs
		var tabsNav = E('div', { class: 'horus-tabs' });
		var tabBanned = E('div', { class: 'horus-tab active' }, '🚫 إدارة الحظر وقائمة المحظورين');
		var tabSpoofLogs = E('div', { class: 'horus-tab' }, '🛡️ سجل رصد الماكات المكررة ومكافحة السرقة');
		var tabRoamLogs = E('div', { class: 'horus-tab' }, '📶 سجل تنقل الهواتف السلس (Fast Roaming)');
		tabsNav.appendChild(tabBanned);
		tabsNav.appendChild(tabSpoofLogs);
		tabsNav.appendChild(tabRoamLogs);
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

		// ----------------------------------------------------
		// 1. BANNED SECTION
		// ----------------------------------------------------
		var inMac = E('input', { class: 'form-control', type: 'text', placeholder: 'مثال: AA:BB:CC:DD:EE:FF', style: 'font-family: monospace; text-transform: uppercase;' });
		var inDuration = E('select', { class: 'form-control' }, [
			E('option', { value: '0' }, '🔒 دائم (Permanent Ban)'),
			E('option', { value: '3600' }, '⏳ ساعة واحدة'),
			E('option', { value: '86400' }, '⏳ 24 ساعة (يوم كامل)'),
			E('option', { value: '604800' }, '⏳ 7 أيام (أسبوع)')
		]);
		var inReason = E('input', { class: 'form-control', type: 'text', placeholder: 'مثال: حظر يدوي / انتهاك سياسة الشبكة' });

		var apGrid = E('div', { class: 'ap-grid' });
		var btnSelectAll = E('button', { class: 'btn-tool', type: 'button' }, '✅ تحديد الكل');
		var btnDeselectAll = E('button', { class: 'btn-tool', type: 'button' }, '❌ إلغاء التحديد');
		var selectedCountBadge = E('span', { style: 'color:#00e676; font-weight:bold; font-size:12px;' }, '(تم تحديد 0 إكسس)');

		var btnSubmit = E('button', { class: 'btn-ban-submit' }, [
			E('span', { style: 'font-size:18px;' }, '🚫'),
			E('span', {}, 'تطبيق أمر الحظر على الإكسسات المحددة فوراً')
		]);

		var banFormCard = E('div', { class: 'glass-card' }, [
			E('div', { class: 'card-header' }, [
				E('div', {}, [
					E('h3', { class: 'card-title' }, '🛡️ إضافة مستخدم للحظر اليدوي (Manual MAC Ban)'),
					E('p', { class: 'card-desc' }, 'قم بكتابة عنوان الماك واختيار الإكسسات التي ترغب في تطبيق الحظر عليها.')
				])
			]),
			E('div', { class: 'form-grid' }, [
				E('div', { class: 'form-group' }, [ E('label', { class: 'form-label' }, '📍 عنوان الماك (MAC Address):'), inMac ]),
				E('div', { class: 'form-group' }, [ E('label', { class: 'form-label' }, '⏳ مدة الحظر:'), inDuration ]),
				E('div', { class: 'form-group' }, [ E('label', { class: 'form-label' }, '📝 سبب الحظر (اختياري):'), inReason ])
			]),
			E('div', { class: 'ap-select-box' }, [
				E('div', { class: 'ap-select-header' }, [
					E('div', { class: 'ap-select-title' }, [
						E('span', {}, '🎯 اختيار الإكسسات المستهدفة للحظر:'),
						selectedCountBadge
					]),
					E('div', { class: 'ap-tools' }, [ btnSelectAll, btnDeselectAll ])
				]),
				apGrid
			]),
			btnSubmit
		]);
		secBanned.appendChild(banFormCard);

		var bannedTableBody = E('tbody');
		var bannedTableWrapper = E('div', { class: 'glass-card' }, [
			E('div', { class: 'card-header' }, [
				E('div', {}, [
					E('h3', { class: 'card-title', style: 'color:#fbbf24;' }, '📑 قائمة الأجهزة المحظورة حالياً (Banned MACs Registry)'),
					E('p', { class: 'card-desc' }, 'قائمة المشتركين المحظورين في الذاكرة الحية لشبكة حورس.')
				])
			]),
			E('div', { class: 'table-box' }, [
				E('table', { class: 'custom-table' }, [
					E('thead', {}, [
						E('tr', {}, [
							E('th', {}, 'عنوان الماك (MAC)'),
							E('th', {}, 'اسم المشترك (Radius)'),
							E('th', {}, 'سبب الحظر'),
							E('th', {}, 'تاريخ الحظر'),
							E('th', {}, 'المدة'),
							E('th', { style: 'text-align:center;' }, 'إجراء')
						])
					]),
					bannedTableBody
				])
			])
		]);
		secBanned.appendChild(bannedTableWrapper);

		// ----------------------------------------------------
		// 2. SPOOF DETECTION LOGS SECTION
		// ----------------------------------------------------
		var spoofTableBody = E('tbody');
		var spoofCard = E('div', { class: 'glass-card' }, [
			E('div', { class: 'card-header' }, [
				E('div', {}, [
					E('h3', { class: 'card-title', style: 'color:#f87171;' }, '🛡️ سجل رصد تكرار الماكات ومحاولات السرقة (Anti-Spoofing Audit)'),
					E('p', { class: 'card-desc' }, 'يرصد الكنترولر أي ماك يظهر على أكثر من إكسس في نفس الوقت، ويتعامل معه فورياً بعد مهلة السماح.')
				])
			]),
			E('div', { class: 'table-box' }, [
				E('table', { class: 'custom-table' }, [
					E('thead', {}, [
						E('tr', {}, [
							E('th', {}, 'التوقيت'),
							E('th', {}, 'عنوان الماك (MAC)'),
							E('th', {}, 'المشترك (Radius)'),
							E('th', {}, 'تفاصيل وموقع الرصد'),
							E('th', {}, 'نوع الحدث'),
							E('th', { style: 'text-align:center;' }, 'إجراء')
						])
					]),
					spoofTableBody
				])
			])
		]);
		secSpoofLogs.appendChild(spoofCard);

		// ----------------------------------------------------
		// 3. FAST ROAMING LOGS SECTION
		// ----------------------------------------------------
		var roamTableBody = E('tbody');
		var roamCard = E('div', { class: 'glass-card' }, [
			E('div', { class: 'card-header' }, [
				E('div', {}, [
					E('h3', { class: 'card-title', style: 'color:#38bdf8;' }, '📶 سجل تنقل الهواتف السلس بين الإكسسات (Fast Roaming Log)'),
					E('p', { class: 'card-desc' }, 'يوثق انتقال العملاء الطبيعي من إكسس لآخر بدون انقطاع.')
				])
			]),
			E('div', { class: 'table-box' }, [
				E('table', { class: 'custom-table' }, [
					E('thead', {}, [
						E('tr', {}, [
							E('th', {}, 'التوقيت'),
							E('th', {}, 'عنوان الماك (MAC)'),
							E('th', {}, 'المشترك (Radius)'),
							E('th', {}, 'مسار التنقل')
						])
					]),
					roamTableBody
				])
			])
		]);
		secRoamLogs.appendChild(roamCard);

		// ----------------------------------------------------
		// STATE & DATA SYNC
		// ----------------------------------------------------
		var state = {
			data: { aps: {}, clients: {}, banned: [], logs: [] },
			radiusMap: {},
			selectedAps: new Set(),
			knownAps: {}
		};

		function updateSelectedCount() {
			selectedCountBadge.textContent = '(تم تحديد ' + state.selectedAps.size + ' إكسس)';
		}

		btnSelectAll.onclick = function() {
			state.selectedAps.clear();
			Object.keys(state.knownAps).forEach(function(m){ state.selectedAps.add(m); });
			renderApGrid();
		};

		btnDeselectAll.onclick = function() {
			state.selectedAps.clear();
			renderApGrid();
		};

		function renderApGrid() {
			var tiles = [];
			var apKeys = Object.keys(state.knownAps);
			if (apKeys.length === 0) {
				tiles.push(E('div', { style: 'color:#94a3b8; font-size:13px; padding:10px;' }, 'جاري استكشاف الإكسسات عبر بروتوكول HMP...'));
			} else {
				apKeys.forEach(function(mac) {
					var ap = state.knownAps[mac];
					var isChecked = state.selectedAps.has(mac);
					var tile = E('div', { class: isChecked ? 'ap-tile selected' : 'ap-tile' });
					var cb = E('input', { type: 'checkbox' });
					cb.checked = isChecked;

					tile.onclick = function(e) {
						if (e.target !== cb) cb.checked = !cb.checked;
						if (cb.checked) state.selectedAps.add(mac);
						else state.selectedAps.delete(mac);
						tile.className = cb.checked ? 'ap-tile selected' : 'ap-tile';
						updateSelectedCount();
					};

					tile.appendChild(cb);
					tile.appendChild(E('div', { class: 'ap-tile-info' }, [
						E('span', { class: 'ap-tile-name' }, '📡 ' + (ap.hostname || 'AP')),
						E('span', { class: 'ap-tile-sub' }, (ap.ip || '-') + ' | ' + mac)
					]));
					tiles.push(tile);
				});
			}
			dom.content(apGrid, tiles);
			updateSelectedCount();
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
					var firstLoad = Object.keys(state.knownAps).length === 0;
					state.knownAps = mapData.aps;
					if (firstLoad) {
						Object.keys(state.knownAps).forEach(function(m){ state.selectedAps.add(m); });
					}
					renderApGrid();
				}

				renderBannedTable();
				renderLogs();
			});
		}

		function renderBannedTable() {
			var bannedList = state.data.banned || [];
			var rows = [];

			if (bannedList.length === 0) {
				rows.push(E('tr', {}, E('td', { colspan: 6, style: 'text-align:center; padding: 25px; color:#64748b;' }, 'لا توجد أجهزة محظورة حالياً.')));
			} else {
				bannedList.forEach(function(b) {
					var mac = (b.mac || '').toUpperCase();
					var rUser = state.radiusMap[mac] || {};
					var dispName = rUser.name || rUser.username || '-';

					var dateStr = b.banned_at ? new Date(b.banned_at * 1000).toLocaleString('ar-EG') : '-';
					var durStr = (b.duration === 0 || !b.duration) ? '🔒 دائم' : Math.round(b.duration / 3600) + ' ساعة';

					var btnUnban = E('button', { class: 'btn-unban' }, '🔓 فك الحظر بالكامل');
					btnUnban.onclick = function() {
						if (confirm('فك الحظر بالكامل عن الماك (' + mac + ') على جميع الإكسسات؟')) {
							fetch('/cgi-bin/horus_ban_action', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({ action: 'unban', mac: mac, scope: 'all' })
							}).then(function(){
								ui.addNotification(null, E('p', '✅ تم فك الحظر بنجاح عن ' + mac));
								loadData();
							});
						}
					};

					var btnAllowAp = E('button', { class: 'btn-unban', style: 'background:rgba(56,189,248,0.2); color:#38bdf8; border:1px solid rgba(56,189,248,0.4); margin-right:6px;' }, '🎯 السماح بإكسس منزله فقط');
					btnAllowAp.onclick = function() {
						var apKeys = Object.keys(state.knownAps);
						if (apKeys.length === 0) { alert('لا توجد إكسسات متاحة'); return; }
						var apOptions = apKeys.map(function(k, idx){
							return (idx + 1) + '. ' + (state.knownAps[k].hostname || 'AP') + ' (' + (state.knownAps[k].ip || k) + ')';
						}).join('\n');
						var selIdx = prompt('اختر رقم الإكسس المسموح للمشترك الأصلي بالعمل عليه (وحظره على باقي الشبكة):\n\n' + apOptions);
						if (selIdx) {
							var num = parseInt(selIdx, 10);
							if (num >= 1 && num <= apKeys.length) {
								var chosenAp = apKeys[num - 1];
								fetch('/cgi-bin/horus_ban_action', {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({ action: 'allow_on_ap', mac: mac, exempt_ap: chosenAp })
								}).then(function(){
									ui.addNotification(null, E('p', '✅ تم قفل المشترك على إكسسه الأصلي وحظره على باقي الشبكة بنجاح!'));
									loadData();
								});
							} else {
								alert('اختيار غير صحيح');
							}
						}
					};

					rows.push(E('tr', {}, [
						E('td', { style: 'font-family:monospace; font-weight:700; color:#f87171;' }, mac),
						E('td', { style: 'color:#00e676; font-weight:700;' }, dispName),
						E('td', {}, E('span', { class: 'badge badge-danger' }, b.reason || 'حظر يدوي')),
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
				var timeStr = l.timestamp ? new Date(l.timestamp * 1000).toLocaleTimeString('ar-EG') : '-';

				if (l.type === 'spoof_ban' || l.type === 'spoof_warning' || l.type === 'ban') {
					var bType = l.type === 'spoof_ban' ? E('span', { class: 'badge badge-danger' }, '🔴 حظر سرقة ماك') : (l.type === 'spoof_warning' ? E('span', { class: 'badge badge-warning' }, '🟡 اشتباه تكرار') : E('span', { class: 'badge badge-info' }, 'حظر'));
					
					var btnQuickBan = E('button', { class: 'btn-tool', style: 'background:rgba(239,68,68,0.2); color:#f87171;' }, '🚫 حظر');
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
				spoofRows.push(E('tr', {}, E('td', { colspan: 6, style: 'text-align:center; padding:20px; color:#64748b;' }, 'سجل مكافحة السرقة نظيف، لم يتم رصد أي تكرار للماكات حالياً.')));
			}
			if (roamRows.length === 0) {
				roamRows.push(E('tr', {}, E('td', { colspan: 4, style: 'text-align:center; padding:20px; color:#64748b;' }, 'لا توجد حركات تنقل مسجلة مؤخراً.')));
			}

			dom.content(spoofTableBody, spoofRows);
			dom.content(roamTableBody, roamRows);
		}

		btnSubmit.onclick = function() {
			var rawMac = inMac.value.trim();
			var cleanMac = rawMac.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
			if (cleanMac.length !== 12) {
				alert('الرجاء إدخال عنوان MAC صحيح مكون من 12 خانة (مثال: AA:BB:CC:DD:EE:FF).');
				return;
			}
			var mac = cleanMac.match(/.{1,2}/g).join(':');

			if (state.selectedAps.size === 0) {
				alert('الرجاء اختيار إكسس واحد على الأقل لتطبيق الحظر عليه.');
				return;
			}

			var dur = parseInt(inDuration.value, 10);
			var rsn = inReason.value.trim() || 'حظر يدوي من المدير';
			var targetList = Array.from(state.selectedAps);
			var isAll = (targetList.length === Object.keys(state.knownAps).length);

			btnSubmit.disabled = true;
			btnSubmit.textContent = 'جاري الإرسال عبر HMP...';

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
				btnSubmit.disabled = false;
				btnSubmit.innerHTML = '<span>🚫</span> <span>تطبيق أمر الحظر على الإكسسات المحددة فوراً</span>';
				inMac.value = '';
				inReason.value = '';
				ui.addNotification(null, E('p', '✅ تم إرسال أمر الحظر للماك ' + mac + ' بنجاح!'));
				loadData();
			}).catch(function(){
				btnSubmit.disabled = false;
				btnSubmit.innerHTML = '<span>🚫</span> <span>تطبيق أمر الحظر على الإكسسات المحددة فوراً</span>';
			});
		};

		loadData();
		setInterval(loadData, 4000);

		return container;
	}
});
