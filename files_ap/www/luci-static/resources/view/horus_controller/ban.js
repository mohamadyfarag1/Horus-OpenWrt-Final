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
			.glass-card { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4); }
			.card-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 14px; margin-bottom: 20px; }
			.card-title { font-size: 18px; font-weight: 700; color: #00e676; margin: 0; display: flex; align-items: center; gap: 8px; }
			.card-desc { font-size: 13px; color: #94a3b8; margin: 4px 0 0 0; }
			
			.form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 20px; }
			.form-group { display: flex; flex-direction: column; gap: 6px; }
			.form-label { font-size: 13px; font-weight: 600; color: #cbd5e1; display: flex; align-items: center; gap: 6px; }
			.form-control { background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 10px 14px; color: #f8fafc; font-size: 14px; outline: none; transition: all 0.2s; }
			.form-control:focus { border-color: #00e676; box-shadow: 0 0 0 3px rgba(0, 230, 118, 0.2); }
			.form-control option { background: #0f172a; color: #f8fafc; }
			
			/* AP Selection Grid */
			.ap-select-box { background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 16px; margin-bottom: 22px; }
			.ap-select-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px; }
			.ap-select-title { font-size: 14px; font-weight: bold; color: #38bdf8; display: flex; align-items: center; gap: 6px; }
			.ap-tools { display: flex; gap: 8px; }
			.btn-tool { padding: 4px 12px; font-size: 12px; font-weight: 600; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.05); color: #cbd5e1; cursor: pointer; transition: 0.2s; }
			.btn-tool:hover { background: rgba(255,255,255,0.15); color: #fff; }
			
			.ap-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; max-height: 240px; overflow-y: auto; padding: 4px; }
			.ap-tile { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; cursor: pointer; transition: all 0.2s; user-select: none; }
			.ap-tile:hover { background: rgba(51, 65, 85, 0.6); border-color: rgba(255, 255, 255, 0.25); transform: translateY(-1px); }
			.ap-tile.selected { background: rgba(0, 230, 118, 0.12); border-color: #00e676; box-shadow: 0 0 10px rgba(0, 230, 118, 0.15); }
			.ap-tile input[type="checkbox"] { width: 18px; height: 18px; accent-color: #00e676; cursor: pointer; }
			.ap-tile-info { display: flex; flex-direction: column; gap: 2px; }
			.ap-tile-name { font-size: 13px; font-weight: 700; color: #f8fafc; }
			.ap-tile-sub { font-size: 11px; color: #94a3b8; font-family: monospace; }
			
			/* Action Buttons */
			.btn-ban-submit { width: 100%; padding: 14px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3); transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; }
			.btn-ban-submit:hover:not(:disabled) { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); transform: translateY(-1px); box-shadow: 0 6px 20px rgba(239, 68, 68, 0.4); }
			.btn-ban-submit:disabled { opacity: 0.6; cursor: not-allowed; }
			
			/* Banned Table */
			.table-box { background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; overflow-x: auto; }
			.custom-table { width: 100%; border-collapse: collapse; text-align: right; }
			.custom-table th { background: rgba(30, 41, 59, 0.8); padding: 14px 16px; font-size: 13px; font-weight: 700; color: #94a3b8; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
			.custom-table td { padding: 14px 16px; font-size: 13px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); color: #e2e8f0; }
			.custom-table tr:hover td { background: rgba(255, 255, 255, 0.03); }
			
			.badge-mac { font-family: monospace; font-weight: 700; color: #f87171; background: rgba(239, 68, 68, 0.15); padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.3); }
			.badge-time { background: rgba(245, 158, 11, 0.15); color: #fbbf24; padding: 3px 8px; border-radius: 6px; font-weight: 600; font-size: 12px; }
			.btn-unban { padding: 6px 14px; background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.4); border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; transition: 0.2s; }
			.btn-unban:hover { background: #22c55e; color: #000; }
		`);
		container.appendChild(styles);

		// Card 1: Add Ban
		var inMac = E('input', { class: 'form-control', type: 'text', placeholder: 'مثال: AA:BB:CC:DD:EE:FF' });
		var inReason = E('input', { class: 'form-control', type: 'text', placeholder: 'مثال: حظر يدوي / انتهاك سياسة الشبكة' });
		var inDuration = E('select', { class: 'form-control' }, [
			E('option', { value: '0' }, '🔒 دائم (Permanent Ban)'),
			E('option', { value: '3600' }, '⏱️ ساعة واحدة (1 Hour)'),
			E('option', { value: '21600' }, '⏱️ 6 ساعات (6 Hours)'),
			E('option', { value: '86400' }, '⏱️ يوم كامل (24 Hours)'),
			E('option', { value: '259200' }, '⏱️ 3 أيام (3 Days)'),
			E('option', { value: '604800' }, '⏱️ أسبوع كامل (7 Days)')
		]);

		var apGrid = E('div', { class: 'ap-grid' });
		var btnSelectAll = E('button', { class: 'btn-tool', type: 'button' }, '✅ تحديد الكل');
		var btnDeselectAll = E('button', { class: 'btn-tool', type: 'button' }, '❌ إلغاء التحديد');
		var selectedCountBadge = E('span', { style: 'color:#00e676; font-weight:bold; font-size:12px;' }, '(تم تحديد 0 إكسس)');

		var btnSubmit = E('button', { class: 'btn-ban-submit' }, [
			E('span', { style: 'font-size:18px;' }, '🚫'),
			E('span', {}, 'تطبيق أمر الحظر على الإكسسات المحددة فوراً')
		]);

		var cardForm = E('div', { class: 'glass-card' }, [
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
		container.appendChild(cardForm);

		// Card 2: Banned List
		var tableBody = E('tbody');
		var cardTable = E('div', { class: 'glass-card' }, [
			E('div', { class: 'card-header' }, [
				E('div', {}, [
					E('h3', { class: 'card-title', style: 'color:#f87171;' }, '📋 قائمة الأجهزة المحظورة حالياً (Banned MACs Registry)'),
					E('p', { class: 'card-desc' }, 'قائمة المشتركين المحظورين في الذاكرة الحية لشبكة حورس.')
				])
			]),
			E('div', { class: 'table-box' }, [
				E('table', { class: 'custom-table' }, [
					E('thead', {}, [
						E('tr', {}, [
							E('th', {}, 'عنوان الماك (MAC)'),
							E('th', {}, 'سبب الحظر'),
							E('th', {}, 'تاريخ الحظر'),
							E('th', {}, 'المدة'),
							E('th', {}, 'النطاق'),
							E('th', { style: 'text-align: center;' }, 'إجراء')
						])
					]),
					tableBody
				])
			])
		]);
		container.appendChild(cardTable);

		// State & Logic
		var knownAps = {};
		var selectedAps = new Set();

		function updateSelectedCount() {
			selectedCountBadge.textContent = '(تم تحديد ' + selectedAps.size + ' إكسس)';
		}

		btnSelectAll.onclick = function() {
			selectedAps.clear();
			Object.keys(knownAps).forEach(function(m){ selectedAps.add(m); });
			renderApGrid();
		};

		btnDeselectAll.onclick = function() {
			selectedAps.clear();
			renderApGrid();
		};

		function renderApGrid() {
			var tiles = [];
			var apKeys = Object.keys(knownAps);
			if (apKeys.length === 0) {
				tiles.push(E('div', { style: 'color:#94a3b8; font-size:13px; padding:10px;' }, 'جاري استكشاف الإكسسات عبر بروتوكول HMP...'));
			} else {
				apKeys.forEach(function(mac) {
					var ap = knownAps[mac];
					var isChecked = selectedAps.has(mac);
					var tile = E('div', { class: isChecked ? 'ap-tile selected' : 'ap-tile' });
					var cb = E('input', { type: 'checkbox' });
					cb.checked = isChecked;

					tile.onclick = function(e) {
						if (e.target !== cb) cb.checked = !cb.checked;
						if (cb.checked) selectedAps.add(mac);
						else selectedAps.delete(mac);
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
			fetch('/cgi-bin/horus_map_data?_=' + Date.now()).then(function(r){ return r.json(); }).then(function(data) {
				if (data && data.aps) {
					var firstLoad = Object.keys(knownAps).length === 0;
					knownAps = data.aps;
					if (firstLoad) {
						// Select all by default on first load
						Object.keys(knownAps).forEach(function(m){ selectedAps.add(m); });
					}
					renderApGrid();
				}
				renderBannedList(data ? data.banned : []);
			}).catch(function(){});
		}

		function renderBannedList(banned) {
			var rows = [];
			if (!banned || banned.length === 0) {
				rows.push(E('tr', {}, E('td', { colspan: 6, style: 'text-align:center; padding: 25px; color:#64748b;' }, 'لا توجد أجهزة محظورة حالياً.')));
			} else {
				banned.forEach(function(b) {
					var btnUnban = E('button', { class: 'btn-unban' }, '✅ فك الحظر');
					btnUnban.onclick = function() {
						if (confirm('فك الحظر عن الماك (' + b.mac + ')؟')) {
							fetch('/cgi-bin/horus_ban_action', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({ action: 'unban', mac: b.mac, scope: 'all' })
							}).then(function(){
								ui.addNotification(null, E('p', 'تم فك الحظر عن: ' + b.mac));
								loadData();
							});
						}
					};

					var durLabel = (b.duration === 0 || !b.duration) ? 'دائم' : (b.duration + ' ثانية');
					var dateLabel = b.banned_at ? new Date(b.banned_at * 1000).toLocaleString('ar-EG') : '-';

					rows.push(E('tr', {}, [
						E('td', {}, E('span', { class: 'badge-mac' }, b.mac || '-')),
						E('td', {}, b.reason || 'حظر يدوي'),
						E('td', {}, dateLabel),
						E('td', {}, E('span', { class: 'badge-time' }, durLabel)),
						E('td', {}, b.scope === 'all' ? 'جميع الإكسسات' : (b.scope || 'محدد')),
						E('td', { style: 'text-align: center;' }, btnUnban)
					]));
				});
			}
			dom.content(tableBody, rows);
		}

		btnSubmit.onclick = function() {
			var rawMac = inMac.value.trim();
			var reason = inReason.value.trim() || 'حظر يدوي';
			var dur = parseInt(inDuration.value) || 0;

			var clean = rawMac.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
			if (clean.length !== 12) {
				alert('الرجاء إدخال عنوان ماك صحيح مكون من 12 خانة (مثال: AA:BB:CC:DD:EE:FF)');
				return;
			}
			var macFormatted = clean.match(/.{1,2}/g).join(':');

			if (selectedAps.size === 0) {
				alert('الرجاء تحديد إكسس واحد على الأقل لتطبيق الحظر عليه.');
				return;
			}

			var targetList = Array.from(selectedAps);
			var isAll = (targetList.length === Object.keys(knownAps).length);

			btnSubmit.disabled = true;
			fetch('/cgi-bin/horus_ban_action', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'ban',
					mac: macFormatted,
					reason: reason,
					duration: dur,
					target_aps: isAll ? 'all' : targetList,
					scope: isAll ? 'all' : targetList.join(',')
				})
			}).then(function(){
				btnSubmit.disabled = false;
				ui.addNotification(null, E('p', '✅ تم إرسال أمر الحظر للماك: ' + macFormatted + ' على (' + targetList.length + ') إكسس.'));
				inMac.value = '';
				inReason.value = '';
				loadData();
			}).catch(function(){
				btnSubmit.disabled = false;
			});
		};

		loadData();
		setInterval(loadData, 4000);

		return container;
	}
});
