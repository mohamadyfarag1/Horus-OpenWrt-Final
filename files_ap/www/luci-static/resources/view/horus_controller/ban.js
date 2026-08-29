'use strict';
'require view';
'require ui';
'require form';
'require dom';
'require poll';

return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	render: function() {
		var m = new form.JSONMap({}, '');
		var s = m.section(form.NamedSection, 'ban_form', 'ban', _('إدارة الحظر (Ban Management)'), _('إضافة مستخدم للحظر يدوياً'));

		var mac = s.option(form.Value, 'mac', _('MAC Address'));
		mac.placeholder = '00:11:22:33:44:55';

		var scope = s.option(form.ListValue, 'scope', _('النطاق'));
		scope.value('all', _('كل الإكسسات'));

		var duration = s.option(form.ListValue, 'duration', _('المدة'));
		duration.value('0', _('دائم'));
		duration.value('3600', _('ساعة'));
		duration.value('86400', _('يوم'));

		var btn = s.option(form.Button, 'ban_btn', _('حظر'));
		btn.inputstyle = 'apply';
		btn.onclick = function() {
			var form_mac = mac.formvalue('ban_form');
			var form_scope = scope.formvalue('ban_form') || 'all';
			var form_dur = duration.formvalue('ban_form') || '0';

			if (!form_mac) {
				ui.addNotification(null, E('p', _('يرجى كتابة الماك أدرس أولاً')));
				return;
			}

			fetch('/cgi-bin/horus_ban_action', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'ban', mac: form_mac, scope: form_scope, duration: parseInt(form_dur) })
			}).then(function() {
				ui.addNotification(null, E('p', _('تم إرسال أمر الحظر: ') + form_mac));
			});
		};

		var banTable = E('div', { 'class': 'table' }, [
			E('div', { 'class': 'tr table-titles' }, [
				E('div', { 'class': 'th' }, _('MAC')),
				E('div', { 'class': 'th' }, _('السبب')),
				E('div', { 'class': 'th' }, _('وقت الحظر')),
				E('div', { 'class': 'th' }, _('المدة')),
				E('div', { 'class': 'th' }, _('إجراء'))
			])
		]);

		poll.add(function() {
			return fetch('/cgi-bin/horus_map_data').then(function(r){ return r.json(); }).then(function(data) {
				while (banTable.lastElementChild && banTable.lastElementChild !== banTable.firstElementChild) {
					banTable.removeChild(banTable.lastElementChild);
				}
				if (data && data.banned) {
					data.banned.forEach(function(b) {
						var unbanBtn = E('button', {
							'class': 'btn cbi-button cbi-button-remove',
							'click': function() {
								fetch('/cgi-bin/horus_ban_action', {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({ action: 'unban', mac: b.mac, scope: 'all' })
								});
							}
						}, _('فك الحظر'));

						banTable.appendChild(E('div', { 'class': 'tr' }, [
							E('div', { 'class': 'td' }, b.mac || '-'),
							E('div', { 'class': 'td' }, b.reason || '-'),
							E('div', { 'class': 'td' }, b.banned_at ? new Date(b.banned_at * 1000).toLocaleString() : '-'),
							E('div', { 'class': 'td' }, b.duration == 0 ? _('دائم') : b.duration + ' ' + _('ثانية')),
							E('div', { 'class': 'td' }, unbanBtn)
						]));
					});
				}
			}).catch(function() {});
		}, 5);

		return Promise.resolve(m.render()).then(function(formDOM) {
			return E('div', { 'class': 'cbi-map', 'dir': 'rtl' }, [
				formDOM,
				E('div', { 'class': 'cbi-section' }, [
					E('h3', _('قائمة الحظر (Banned MACs)')),
					banTable
				])
			]);
		});
	}
});
