'use strict';
'require baseclass';
'require dom';
'require ui';

return baseclass.extend({
	buildGroupsSection: function(state, refreshCb, ui) {
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
		var currentHash = JSON.stringify({ g: state.groups, a: state.assignments });
		if (this.lastGroupsHash === currentHash) return;
		this.lastGroupsHash = currentHash;

		var gRows = [];
		if (!state.groups || state.groups.length === 0) {
			gRows.push(E('tr', {}, E('td', { colspan: 5, style: 'text-align:center; padding: 20px; color:#64748b;' }, 'لا توجد مجموعات حتى الآن.')));
		} else {
			state.groups.forEach(function(g) {
				var count = 0;
				if (state.assignments) {
					Object.keys(state.assignments).forEach(function(mac) {
						if (state.assignments[mac] === g.id) count++;
					});
				}

				var btnDel = E('button', { class: 'btn-ctrl btn-ctrl-ban', style: 'padding:5px 10px; font-size:11px;' }, 'حذف 🗑️');
				btnDel.onclick = function() {
					if (confirm('حذف مجموعة (' + g.name + ')؟')) {
						fetch('/cgi-bin/horus_groups', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ action: 'delete_group', group_id: g.id })
						}).then(function(){
							if (typeof refreshCb === 'function') refreshCb();
						});
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
});
