'use strict';
'require baseclass';
'require dom';
'require ui';
'require horus_controller.i18n as horusI18n';

return baseclass.extend({
	updateBulkBar: function(state, bulkBar, bulkTitle) {
		var count = state.selectedAps.size;
		if (count > 0) {
			bulkBar.classList.remove('hidden');
			bulkTitle.textContent = horusI18n.t('bulk_title', { n: count });
		} else {
			bulkBar.classList.add('hidden');
		}
	},

	runBulkHardware: function(actLabel, actName, state, ui, extraVal) {
		var targetList = Array.from(state.selectedAps);
		if (targetList.length === 0) return;
		if (confirm(actLabel + ' for (' + targetList.length + ') APs?')) {
			var payload = { action: actName, target_aps: targetList };
			if (extraVal !== undefined) payload.value = extraVal;
			fetch('/cgi-bin/horus_ap_action', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			}).then(function(){
				ui.addNotification(null, E('p', '✅ ' + actLabel + ' command dispatched.'));
			});
		}
	},

	openBulkWifiModal: function(state, ui) {
		var targetList = Array.from(state.selectedAps);
		if (targetList.length === 0) return;

		var inSsid = E('input', { type: 'text', placeholder: 'New SSID (Leave empty to keep)' });
		var inPass = E('input', { type: 'password', placeholder: 'New Password (Leave empty to keep)' });
		var inBand = E('select', {}, [
			E('option', { value: 'both' }, horusI18n.t('both_bands')),
			E('option', { value: '2g' }, horusI18n.t('only_2g')),
			E('option', { value: '5g' }, horusI18n.t('only_5g'))
		]);
		var inChan = E('select', {}, [
			E('option', { value: '' }, 'Auto / Keep Current'),
			E('option', { value: 'auto' }, 'Auto Channel'),
			E('option', { value: '1' }, '2.4G - Channel 1'),
			E('option', { value: '6' }, '2.4G - Channel 6'),
			E('option', { value: '11' }, '2.4G - Channel 11'),
			E('option', { value: '36' }, '5G - Channel 36'),
			E('option', { value: '44' }, '5G - Channel 44'),
			E('option', { value: '149' }, '5G - Channel 149'),
			E('option', { value: '157' }, '5G - Channel 157')
		]);

		var modalContent = E('div', { style: 'direction:' + horusI18n.getDir() + '; text-align:' + (horusI18n.getDir() === 'rtl' ? 'right' : 'left') + '; color:#f8fafc;' }, [
			E('h3', { style: 'color:#38bdf8; margin-top:0;' }, horusI18n.t('bulk_wifi_modal_title')),
			E('p', { style: 'font-size:13px; color:#cbd5e1;' }, 'Apply wireless settings across (' + targetList.length + ') selected Access Points simultaneously:'),
			E('div', { class: 'form-field', style: 'margin-bottom:12px;' }, [ E('label', {}, horusI18n.t('target_band')), inBand ]),
			E('div', { class: 'form-field', style: 'margin-bottom:12px;' }, [ E('label', {}, horusI18n.t('ssid_name')), inSsid ]),
			E('div', { class: 'form-field', style: 'margin-bottom:12px;' }, [ E('label', {}, horusI18n.t('new_password')), inPass ]),
			E('div', { class: 'form-field', style: 'margin-bottom:16px;' }, [ E('label', {}, horusI18n.t('current_channel')), inChan ])
		]);

		ui.showModal(horusI18n.t('bulk_wifi_modal_title'), [
			modalContent,
			E('div', { class: 'right', style: 'margin-top:18px; display:flex; gap:10px; justify-content:flex-end;' }, [
				E('button', { class: 'btn', click: ui.hideModal }, horusI18n.t('cancel')),
				E('button', {
					class: 'btn primary',
					style: 'background:linear-gradient(135deg, #00e676 0%, #00b0ff 100%); color:#000; border:none;',
					click: function() {
						var s = inSsid.value.trim();
						var p = inPass.value.trim();
						var b = inBand.value;
						var c = inChan.value;
						if (!s && !p && !c) {
							alert('Please provide SSID, password, or channel.');
							return;
						}
						ui.hideModal();
						fetch('/cgi-bin/horus_wifi_action', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								action: 'bulk_apply_profile',
								target_aps: targetList,
								band: b,
								ssid: s,
								password: p,
								channel: c
							})
						}).then(function(){
							ui.addNotification(null, E('p', '✅ Bulk WiFi profile dispatched.'));
						});
					}
				}, horusI18n.t('bulk_apply_btn'))
			])
		]);
	},

	openBulkPassModal: function(state, ui) {
		var targetList = Array.from(state.selectedAps);
		if (targetList.length === 0) return;

		var inPass = E('input', { type: 'password', placeholder: 'New Admin Password' });

		var modalContent = E('div', { style: 'direction:' + horusI18n.getDir() + '; text-align:' + (horusI18n.getDir() === 'rtl' ? 'right' : 'left') + '; color:#f8fafc;' }, [
			E('h3', { style: 'color:#fbbf24; margin-top:0;' }, horusI18n.t('bulk_pass_modal_title', { n: targetList.length })),
			E('p', { style: 'font-size:13px; color:#cbd5e1;' }, 'Update administrator LuCI/SSH password for all (' + targetList.length + ') selected APs:'),
			E('div', { class: 'form-field', style: 'margin-bottom:16px;' }, [ E('label', {}, horusI18n.t('admin_password')), inPass ])
		]);

		ui.showModal(horusI18n.t('bulk_pass_modal_title', { n: targetList.length }), [
			modalContent,
			E('div', { class: 'right', style: 'margin-top:18px; display:flex; gap:10px; justify-content:flex-end;' }, [
				E('button', { class: 'btn', click: ui.hideModal }, horusI18n.t('cancel')),
				E('button', {
					class: 'btn primary',
					style: 'background:linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color:#000; border:none;',
					click: function() {
						var p = inPass.value.trim();
						if (!p || p.length < 5) {
							alert('Please enter a valid password (at least 5 chars).');
							return;
						}
						ui.hideModal();
						fetch('/cgi-bin/horus_ap_action', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								action: 'bulk_admin_password',
								target_aps: targetList,
								password: p
							})
						}).then(function(){
							ui.addNotification(null, E('p', '✅ Bulk admin password updated.'));
						});
					}
				}, horusI18n.t('bulk_pass_apply_btn'))
			])
		]);
	}
});
