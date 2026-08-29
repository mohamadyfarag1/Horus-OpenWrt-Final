'use strict';
'require baseclass';
'require dom';
'require ui';
'require horus_controller.i18n as horusI18n';

return baseclass.extend({
	buildGroupsSection: function(state, refreshCb, ui) {
		var groupForm = E('div', { class: 'glass-card', style: 'margin-bottom: 20px;' }, [
			E('h3', { style: 'margin-top:0; color:#00e676; font-size:18px; display:flex; align-items:center; gap:8px;' }, horusI18n.t('groups_create_title')),
			E('div', { class: 'form-row' }, [
				E('div', { class: 'form-field' }, [ E('label', {}, horusI18n.t('group_name')), E('input', { type: 'text', id: 'g_name', placeholder: horusI18n.t('group_name_ph') }) ]),
				E('div', { class: 'form-field' }, [ E('label', {}, horusI18n.t('ssid_name')), E('input', { type: 'text', id: 'g_ssid', placeholder: 'SSID' }) ]),
				E('div', { class: 'form-field' }, [ E('label', {}, horusI18n.t('new_password')), E('input', { type: 'password', id: 'g_pass', placeholder: 'Password' }) ]),
				E('div', { class: 'form-field' }, [
					E('label', {}, horusI18n.t('target_band')),
					E('select', { id: 'g_band' }, [
						E('option', { value: 'both' }, horusI18n.t('both_bands')),
						E('option', { value: '2g' }, horusI18n.t('only_2g')),
						E('option', { value: '5g' }, horusI18n.t('only_5g'))
					])
				])
			]),
			E('button', { class: 'btn-primary', id: 'btn_create_group', style: 'margin-top:10px;' }, horusI18n.t('save_create_group'))
		]);

		var gTableBody = E('tbody');
		var gTableWrapper = E('div', { class: 'glass-card' }, [
			E('h3', { style: 'margin-top:0; color:#38bdf8; font-size:18px;' }, horusI18n.t('groups_list_title')),
			E('div', { class: 'table-box' }, [
				E('table', { class: 'custom-table' }, [
					E('thead', {}, [
						E('tr', {}, [
							E('th', {}, horusI18n.t('group_name')),
							E('th', {}, horusI18n.t('ssid_name')),
							E('th', {}, horusI18n.t('target_band')),
							E('th', {}, horusI18n.t('assigned_aps_count')),
							E('th', { style: 'text-align:center;' }, horusI18n.t('actions'))
						])
					]),
					gTableBody
				])
			])
		]);

		groupForm.querySelector('#btn_create_group').onclick = function() {
			var n = groupForm.querySelector('#g_name').value.trim();
			var s = groupForm.querySelector('#g_ssid').value.trim();
			var p = groupForm.querySelector('#g_pass').value.trim();
			var b = groupForm.querySelector('#g_band').value;

			if (!n || !s) {
				alert('Please enter group name and SSID.');
				return;
			}

			fetch('/cgi-bin/horus_groups', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'create_group', name: n, ssid: s, password: p, band: b })
			}).then(function(){
				ui.addNotification(null, E('p', '✅ Group created successfully.'));
				groupForm.querySelector('#g_name').value = '';
				groupForm.querySelector('#g_ssid').value = '';
				groupForm.querySelector('#g_pass').value = '';
				if (typeof refreshCb === 'function') refreshCb();
			});
		};

		return {
			formEl: groupForm,
			tableEl: gTableWrapper,
			tbodyEl: gTableBody
		};
	},

	lastGroupsHash: '',

	renderGroupsTable: function(state, gTableBody, refreshCb) {
		var currentHash = JSON.stringify({ g: state.groups, a: state.assignments, lang: horusI18n.getLang() });
		if (this.lastGroupsHash === currentHash) return;
		this.lastGroupsHash = currentHash;

		var gRows = [];
		if (!state.groups || state.groups.length === 0) {
			gRows.push(E('tr', {}, E('td', { colspan: 5, style: 'text-align:center; padding: 20px; color:#64748b;' }, horusI18n.t('no_groups_yet'))));
		} else {
			state.groups.forEach(function(g) {
				var count = 0;
				if (state.assignments) {
					Object.keys(state.assignments).forEach(function(mac) {
						if (state.assignments[mac] === g.id) count++;
					});
				}

				var btnDel = E('button', { class: 'btn-ctrl btn-ctrl-ban', style: 'padding:5px 10px; font-size:11px;' }, horusI18n.t('delete_group'));
				btnDel.onclick = function() {
					if (confirm(horusI18n.t('delete_group_confirm', { name: g.name }))) {
						fetch('/cgi-bin/horus_groups', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ action: 'delete_group', group_id: g.id })
						}).then(function(){
							if (typeof refreshCb === 'function') refreshCb();
						});
					}
				};

				var bandLabel = g.band === '2g' ? horusI18n.t('only_2g') : (g.band === '5g' ? horusI18n.t('only_5g') : horusI18n.t('both_bands'));

				gRows.push(E('tr', {}, [
					E('td', { style: 'font-weight:700;' }, g.name),
					E('td', { style: 'color:#00e676; font-weight:700;' }, g.ssid),
					E('td', {}, bandLabel),
					E('td', {}, E('span', { class: 'pill-wifi' }, '📡 ' + count)),
					E('td', { style: 'text-align:center;' }, btnDel)
				]));
			});
		}
		dom.content(gTableBody, gRows);
	}
});
