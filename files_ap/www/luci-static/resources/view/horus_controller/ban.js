'use strict';
'require view';
'require ui';
'require dom';

return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	render: function() {
		var container = E('div', { class: 'horus-ban-container', style: 'direction:rtl; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;' });

		// Styles
		var styles = E('style', {}, `
			.ban-card { background: rgba(128,128,128,0.06); padding: 20px; border-radius: 8px; border: 1px solid rgba(128,128,128,0.2); box-shadow: 0 2px 5px rgba(0,0,0,0.1); margin-bottom: 22px; }
			.ban-card h3 { margin-top: 0; color: #00e676; border-bottom: 2px solid rgba(0,230,118,0.3); padding-bottom: 8px; font-size: 18px; }
			.ban-row { display: flex; gap: 15px; margin-bottom: 15px; flex-wrap: wrap; }
			.ban-field { flex: 1; min-width: 200px; display: flex; flex-direction: column; }
			.ban-field label { font-size: 13px; font-weight: bold; margin-bottom: 5px; opacity: 0.9; }
			.ban-field input, .ban-field select { padding: 9px 12px; background: rgba(128,128,128,0.1); color: inherit; border: 1px solid rgba(128,128,128,0.3); border-radius: 4px; font-size: 14px; outline: none; }
			.ban-btn { padding: 10px 22px; background: #dc3545; color: #fff; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 14px; transition: 0.2s; }
			.ban-btn:hover { background: #bd2130; }
			.unban-btn { padding: 5px 12px; background: #28a745; color: #fff; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 12px; }
			.unban-btn:hover { background: #218838; }
			.banned-table-wrapper { background: rgba(128,128,128,0.04); border-radius: 8px; overflow-x: auto; border: 1px solid rgba(128,128,128,0.2); }
			.banned-table-wrapper table { width: 100%; border-collapse: collapse; }
			.banned-table-wrapper th, .banned-table-wrapper td { padding: 12px 14px; text-align: right; border-bottom: 1px solid rgba(128,128,128,0.15); font-size: 13px; }
			.banned-table-wrapper th { background: rgba(128,128,128,0.12); font-weight: bold; }
		`);
		container.appendChild(styles);

		// Section 1: Manual Ban Form
		var inMac = E('input', { type: 'text', placeholder: 'مثال: AA:BB:CC:DD:EE:FF' });
		var inReason = E('input', { type: 'text', placeholder: 'مثال: حظر يدوي / انتهاك سياسة الشبكة' });
		var inScope = E('select', {}, [
			E('option', { value: 'all' }, '🌍 جميع الإكسسات في الشبكة (Broadcast All)'),
		]);
		var inDuration = E('select', {}, [
			E('option', { value: '0' }, 'دائم (Permanent)'),
			E('option', { value: '3600' }, 'ساعة واحدة (1 Hour)'),
			E('option', { value: '21600' }, '6 ساعات (6 Hours)'),
			E('option', { value: '86400' }, 'يوم كامل / 24 ساعة (1 Day)'),
			E('option', { value: '259200' }, '3 أيام (3 Days)'),
			E('option', { value: '604800' }, 'أسبوع كامل (7 Days)')
		]);

		var btnSubmitBan = E('button', { class: 'ban-btn' }, '🚫 تطبيق الحظر فوراً');

		var formCard = E('div', { class: 'ban-card' }, [
			E('h3', {}, '🛡️ إضافة جهاز للحظر اليدوي (Manual MAC Ban)'),
			E('div', { class: 'ban-row' }, [
				E('div', { class: 'ban-field' }, [ E('label', {}, 'عنوان الماك (MAC Address):'), inMac ]),
				E('div', { class: 'ban-field' }, [ E('label', {}, 'نطاق الحظر:'), inScope ])
			]),
			E('div', { class: 'ban-row' }, [
				E('div', { class: 'ban-field' }, [ E('label', {}, 'مدة الحظر:'), inDuration ]),
				E('div', { class: 'ban-field' }, [ E('label', {}, 'سبب الحظر (اختياري):'), inReason ])
			]),
			btnSubmitBan
		]);
		container.appendChild(formCard);

		// Section 2: Banned List Table
		var tableBody = E('tbody');
		var tableCard = E('div', { class: 'ban-card' }, [
			E('h3', {}, '📋 قائمة الأجهزة المحظورة حالياً (Banned MACs Registry)'),
			E('div', { class: 'banned-table-wrapper' }, [
				E('table', {}, [
					E('thead', {}, [
						E('tr', {}, [
							E('th', {}, 'عنوان الماك (MAC)'),
							E('th', {}, 'سبب الحظر'),
							E('th', {}, 'تاريخ ووقت الحظر'),
							E('th', {}, 'المدة المتبقية'),
							E('th', {}, 'النطاق'),
							E('th', { style: 'text-align: center;' }, 'إجراء')
						])
					]),
					tableBody
				])
			])
		]);
		container.appendChild(tableCard);

		// Populate APs in scope select
		function updateScopeAPs() {
			fetch('/cgi-bin/horus_map_data?_=' + Date.now()).then(function(r){ return r.json(); }).then(function(data) {
				while (inScope.options.length > 1) inScope.remove(1);
				if (data && data.aps) {
					Object.keys(data.aps).forEach(function(mac) {
						var ap = data.aps[mac];
						var opt = E('option', { value: mac }, '📡 إكسس: ' + (ap.hostname || 'AP') + ' (' + (ap.ip || mac) + ')');
						inScope.appendChild(opt);
					});
				}
				renderBannedTable(data ? data.banned : []);
			}).catch(function(){});
		}

		function renderBannedTable(bannedList) {
			var rows = [];
			if (!bannedList || bannedList.length === 0) {
				rows.push(E('tr', {}, E('td', { colspan: 6, style: 'text-align:center; padding: 25px; color:#888;' }, 'لا توجد أجهزة محظورة حالياً.')));
			} else {
				bannedList.forEach(function(b) {
					var unbanBtn = E('button', { class: 'unban-btn' }, '✅ فك الحظر');
					unbanBtn.onclick = function() {
						if (confirm('فك الحظر عن هذا الماك (' + b.mac + ')؟')) {
							fetch('/cgi-bin/horus_ban_action', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({ action: 'unban', mac: b.mac, scope: 'all' })
							}).then(function(){
								ui.addNotification(null, E('p', 'تم فك الحظر عن: ' + b.mac));
								updateScopeAPs();
							});
						}
					};

					var durText = (b.duration === 0 || !b.duration) ? 'دائم' : (b.duration + ' ثانية');
					var dateText = b.banned_at ? new Date(b.banned_at * 1000).toLocaleString('ar-EG') : '-';

					rows.push(E('tr', {}, [
						E('td', { style: 'font-family:monospace; font-weight:bold; color:#ff5252;' }, b.mac || '-'),
						E('td', {}, b.reason || 'حظر يدوي'),
						E('td', {}, dateText),
						E('td', {}, E('span', { style: 'background:rgba(255,82,82,0.15); color:#ff5252; padding:2px 8px; border-radius:4px; font-weight:bold;' }, durText)),
						E('td', {}, b.scope === 'all' ? 'جميع الإكسسات' : (b.scope || 'الكل')),
						E('td', { style: 'text-align: center;' }, unbanBtn)
					]));
				});
			}
			dom.content(tableBody, rows);
		}

		btnSubmitBan.onclick = function() {
			var rawMac = inMac.value.trim();
			var reason = inReason.value.trim() || 'حظر يدوي';
			var scope = inScope.value;
			var dur = parseInt(inDuration.value) || 0;

			var cleanMac = rawMac.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
			if (cleanMac.length !== 12) {
				alert('الرجاء إدخال ماك أدرس صحيح (12 خانة)');
				return;
			}
			var formattedMac = cleanMac.match(/.{1,2}/g).join(':');

			btnSubmitBan.disabled = true;
			fetch('/cgi-bin/horus_ban_action', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'ban', mac: formattedMac, reason: reason, scope: scope, duration: dur })
			}).then(function(){
				btnSubmitBan.disabled = false;
				ui.addNotification(null, E('p', '✅ تم إرسال أمر الحظر للجهاز: ' + formattedMac));
				inMac.value = '';
				inReason.value = '';
				updateScopeAPs();
			}).catch(function(){
				btnSubmitBan.disabled = false;
			});
		};

		updateScopeAPs();
		setInterval(updateScopeAPs, 4000);

		return container;
	}
});
