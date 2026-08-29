'use strict';
'require baseclass';
'require dom';
'require ui';

return baseclass.singleton({
	runBulkHardware: function(actName, actParam, state, ui, val) {
		if (!state.selectedAps || state.selectedAps.size === 0) return;
		var targetList = Array.from(state.selectedAps);
		if (confirm('هل أنت متأكد من تنفيذ (' + actName + ') على (' + targetList.length + ') إكسس؟')) {
			var p = { target_ap: targetList, action: actParam };
			if (val !== undefined) p.state = val;
			fetch('/cgi-bin/horus_ap_action', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(p)
			}).then(function(){
				ui.addNotification(null, E('p', '✅ تم إرسال أمر ' + actName + ' إلى الأجهزة المحددة بنجاح!'));
			});
		}
	},

	updateBulkBar: function(state, bulkBar, bulkTitle) {
		if (!bulkBar || !bulkTitle) return;
		if (state.selectedAps && state.selectedAps.size > 0) {
			bulkBar.classList.remove('hidden');
			bulkTitle.textContent = '🎯 تم تحديد (' + state.selectedAps.size + ') إكسس - الإجراءات الجماعية:';
		} else {
			bulkBar.classList.add('hidden');
		}
	},

	openBulkWifiModal: function(state, ui) {
		if (!state.selectedAps || state.selectedAps.size === 0) return;
		var targetList = Array.from(state.selectedAps);

		var inBand = E('select', {}, [
			E('option', { value: 'both' }, 'الترددين معاً (2.4GHz + 5GHz)'),
			E('option', { value: '2g' }, 'تردد 2.4GHz فقط'),
			E('option', { value: '5g' }, 'تردد 5GHz فقط')
		]);
		var inSsid = E('input', { type: 'text', placeholder: 'اسم الشبكة الجديد (SSID)' });
		var inPass = E('input', { type: 'password', placeholder: 'كلمة السر الجديدة (8 أحرف فأكثر)' });
		var inChannel = E('select', {}, [
			E('option', { value: '' }, 'بدون تغيير (الحالي)'),
			E('option', { value: 'auto' }, 'Auto (تلقائي)')
		]);
		for (var c = 1; c <= 13; c++) inChannel.appendChild(E('option', { value: c.toString() }, 'قناة ' + c));
		[36, 40, 44, 48, 149, 153, 157, 161, 165].forEach(function(c5){ inChannel.appendChild(E('option', { value: c5.toString() }, 'قناة ' + c5)); });

		var modalBox = E('div', { style: 'direction:rtl; text-align:right; color:#f8fafc;' }, [
			E('h3', { style: 'color:#00e676; margin-top:0;' }, '⚡ تطبيق إعدادات الوايرليس على (' + targetList.length + ') إكسس'),
			E('p', { style: 'font-size:13px; color:#cbd5e1;' }, 'سيتم إرسال إعدادات الواي فاي وتطبيقها فوراً عبر بروتوكول HMP:'),
			E('div', { class: 'form-row' }, [
				E('div', { class: 'form-field' }, [ E('label', {}, 'التردد المستهدف:'), inBand ]),
				E('div', { class: 'form-field' }, [ E('label', {}, 'اسم الشبكة (SSID):'), inSsid ])
			]),
			E('div', { class: 'form-row' }, [
				E('div', { class: 'form-field' }, [ E('label', {}, 'كلمة السر الجديدة (اختياري):'), inPass ]),
				E('div', { class: 'form-field' }, [ E('label', {}, 'القناة:'), inChannel ])
			])
		]);

		ui.showModal('تعديل إعدادات الواي فاي الجماعي', [
			modalBox,
			E('div', { class: 'right', style: 'margin-top:18px; display:flex; gap:10px; justify-content:flex-end;' }, [
				E('button', { class: 'btn', click: ui.hideModal }, 'إلغاء'),
				E('button', {
					class: 'btn primary',
					click: function() {
						var ssidVal = inSsid.value.trim();
						var passVal = inPass.value.trim();
						if (!ssidVal && !passVal && !inChannel.value) {
							alert('يرجى إدخال اسم شبكة أو كلمة سر أو اختيار قناة.');
							return;
						}
						ui.hideModal();
						fetch('/cgi-bin/horus_wifi_action', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								target_ap: targetList,
								action: 'apply_profile',
								band: inBand.value,
								ssid: ssidVal,
								password: passVal,
								channel: inChannel.value
							})
						}).then(function(){
							ui.addNotification(null, E('p', '✅ تم إرسال أمر تعديل الواي فاي الجماعي بنجاح!'));
						});
					}
				}, '🚀 تطبيق فوري على الأجهزة')
			])
		]);
	},

	openBulkPassModal: function(state, ui) {
		if (!state.selectedAps || state.selectedAps.size === 0) return;
		var targetList = Array.from(state.selectedAps);
		var inNewAdminPass = E('input', { type: 'password', placeholder: 'كلمة السر الجديدة للوحة التحكم' });

		var modalBox = E('div', { style: 'direction:rtl; text-align:right; color:#f8fafc;' }, [
			E('h3', { style: 'color:#8b5cf6; margin-top:0;' }, '🔐 تغيير باسورد لوحة التحكم لـ (' + targetList.length + ') إكسس'),
			E('p', { style: 'font-size:13px; color:#cbd5e1;' }, 'سيتم تغيير كلمة سر الـ Root للإكسسات المحددة وتحديث HMP Secret فوراً:'),
			E('div', { class: 'form-row' }, [
				E('div', { class: 'form-field' }, [ E('label', {}, 'كلمة السر الجديدة:'), inNewAdminPass ])
			])
		]);

		ui.showModal('تغيير باسورد الإكسسات الجماعي', [
			modalBox,
			E('div', { class: 'right', style: 'margin-top:18px; display:flex; gap:10px; justify-content:flex-end;' }, [
				E('button', { class: 'btn', click: ui.hideModal }, 'إلغاء'),
				E('button', {
					class: 'btn primary',
					click: function() {
						var pass = inNewAdminPass.value.trim();
						if (!pass || pass.length < 5) {
							alert('يرجى إدخال كلمة سر صالحة لا تقل عن 5 أحرف.');
							return;
						}
						ui.hideModal();
						fetch('/cgi-bin/horus_ap_action', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								target_ap: targetList,
								action: 'admin_password',
								password: pass
							})
						}).then(function(){
							ui.addNotification(null, E('p', '✅ تم إرسال أمر تحديث الباسورد الجماعي للإكسسات بنجاح!'));
						});
					}
				}, '🔐 تحديث الباسورد فوراً')
			])
		]);
	}
});
