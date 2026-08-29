'use strict';
'require view';
'require ui';
'require dom';

return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	render: function() {
		var container = E('div', { class: 'horus-ap-container', style: 'direction:rtl; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;' });

		// Styles
		var styles = E('style', {}, `
			.ap-card { background: rgba(128,128,128,0.06); padding: 22px; border-radius: 8px; border: 1px solid rgba(128,128,128,0.2); box-shadow: 0 2px 5px rgba(0,0,0,0.1); margin-bottom: 22px; }
			.ap-card h3 { margin-top: 0; color: #00e676; border-bottom: 2px solid rgba(0,230,118,0.3); padding-bottom: 8px; font-size: 18px; }
			.ap-row { display: flex; gap: 15px; margin-bottom: 15px; flex-wrap: wrap; }
			.ap-field { flex: 1; min-width: 200px; display: flex; flex-direction: column; }
			.ap-field label { font-size: 13px; font-weight: bold; margin-bottom: 5px; opacity: 0.9; }
			.ap-field input, .ap-field select { padding: 9px 12px; background: rgba(128,128,128,0.1); color: inherit; border: 1px solid rgba(128,128,128,0.3); border-radius: 4px; font-size: 14px; outline: none; }
			.btn-ap { padding: 10px 22px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 14px; transition: 0.2s; }
			.btn-green { background: #00e676; color: #000; }
			.btn-green:hover { background: #00c853; }
			.btn-orange { background: #ff9800; color: #fff; }
			.btn-orange:hover { background: #e65100; }
			.btn-red { background: #dc3545; color: #fff; }
			.btn-red:hover { background: #bd2130; }
			.btn-blue { background: #007bff; color: #fff; }
			.btn-blue:hover { background: #0056b3; }
		`);
		container.appendChild(styles);

		var inTargetAp = E('select', {}, [
			E('option', { value: '' }, '-- اختر الإكسس للتحكم به --')
		]);

		// Card 1: Select AP
		var selectCard = E('div', { class: 'ap-card' }, [
			E('h3', {}, '🎯 اختيار الإكسس المستهدف (Target AP Selection)'),
			E('div', { class: 'ap-row' }, [
				E('div', { class: 'ap-field' }, [ E('label', {}, 'الإكسس المطلوب:'), inTargetAp ])
			])
		]);
		container.appendChild(selectCard);

		// Card 2: IP & Network
		var inNewIp = E('input', { type: 'text', placeholder: '192.168.169.224' });
		var inNetmask = E('input', { type: 'text', value: '255.255.255.0', placeholder: '255.255.255.0' });
		var inGateway = E('input', { type: 'text', value: '192.168.169.1', placeholder: '192.168.169.1' });
		var inHostname = E('input', { type: 'text', placeholder: 'مثال: AP-Floor2' });
		var inTxpower = E('input', { type: 'number', placeholder: 'مثال: 23' });

		var btnApplyNet = E('button', { class: 'btn-ap btn-green' }, '💾 تطبيق عنوان الـ IP والشبكة عبر HMP');

		var netCard = E('div', { class: 'ap-card' }, [
			E('h3', {}, '🌐 إعدادات الشبكة والـ IP عن بعد (Remote Network & Static IP)'),
			E('div', { class: 'ap-row' }, [
				E('div', { class: 'ap-field' }, [ E('label', {}, 'اسم الإكسس الجديد (Hostname):'), inHostname ]),
				E('div', { class: 'ap-field' }, [ E('label', {}, 'عنوان الـ IP الجديد (Static IP):'), inNewIp ])
			]),
			E('div', { class: 'ap-row' }, [
				E('div', { class: 'ap-field' }, [ E('label', {}, 'قناع الشبكة (Netmask):'), inNetmask ]),
				E('div', { class: 'ap-field' }, [ E('label', {}, 'البوابة الافتراضية (Gateway):'), inGateway ]),
				E('div', { class: 'ap-field' }, [ E('label', {}, 'قوة الإشارة (TxPower dBm):'), inTxpower ])
			]),
			btnApplyNet
		]);
		container.appendChild(netCard);

		// Card 3: Hardware Operations
		var btnReboot = E('button', { class: 'btn-ap btn-orange', style: 'margin:5px;' }, '🔄 إعادة تشغيل الإكسس (Reboot)');
		var btnWifiRestart = E('button', { class: 'btn-ap btn-blue', style: 'margin:5px;' }, '📶 إعادة تشغيل الواي فاي (Restart WiFi)');
		var btnRadioOff = E('button', { class: 'btn-ap btn-red', style: 'margin:5px;' }, '📴 إيقاف بث الواي فاي (Radio Off)');
		var btnRadioOn = E('button', { class: 'btn-ap btn-green', style: 'margin:5px;' }, '✔️ تشغيل بث الواي فاي (Radio On)');

		var opsCard = E('div', { class: 'ap-card' }, [
			E('h3', {}, '🛠️ عمليات الهاردوير المباشرة (Hardware Operations via Layer 2)'),
			E('div', { style: 'display:flex; flex-wrap:wrap; gap:10px;' }, [
				btnReboot, btnWifiRestart, btnRadioOff, btnRadioOn
			])
		]);
		container.appendChild(opsCard);

		function loadAPs() {
			fetch('/cgi-bin/horus_map_data?_=' + Date.now()).then(function(r){ return r.json(); }).then(function(data) {
				while (inTargetAp.options.length > 1) inTargetAp.remove(1);
				if (data && data.aps) {
					Object.keys(data.aps).forEach(function(mac) {
						var ap = data.aps[mac];
						var opt = E('option', { value: mac }, '📡 ' + (ap.hostname || 'AP') + ' (' + (ap.ip || mac) + ')');
						inTargetAp.appendChild(opt);
					});
				}
			}).catch(function(){});
		}

		inTargetAp.onchange = function() {
			var selectedMac = inTargetAp.value;
			if (!selectedMac) return;
			fetch('/cgi-bin/horus_map_data?_=' + Date.now()).then(function(r){ return r.json(); }).then(function(data) {
				if (data && data.aps && data.aps[selectedMac]) {
					var ap = data.aps[selectedMac];
					inHostname.value = ap.hostname || '';
					if (ap.ip && ap.ip !== '-') inNewIp.value = ap.ip;
				}
			});
		};

		btnApplyNet.onclick = function() {
			var targetAp = inTargetAp.value;
			if (!targetAp) { alert('الرجاء اختيار الإكسس المستهدف أولاً من القائمة الأعلى.'); return; }

			var newIp = inNewIp.value.trim();
			var newHost = inHostname.value.trim();
			var nm = inNetmask.value.trim();
			var gw = inGateway.value.trim();
			var tx = inTxpower.value.trim();

			if (!newIp && !newHost && !tx) { alert('الرجاء إدخال عنوان IP أو اسم جديد لتطبيقه.'); return; }

			if (confirm('تطبيق إعدادات الشبكة على الإكسس المختار عبر HMP؟')) {
				btnApplyNet.disabled = true;
				var payload = { target_ap: targetAp, action: 'set_ip' };
				if (newIp) payload.ip = newIp;
				if (nm) payload.netmask = nm;
				if (gw) payload.gateway = gw;
				if (newHost) payload.hostname = newHost;

				fetch('/cgi-bin/horus_ap_action', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				}).then(function(){
					if (tx) {
						fetch('/cgi-bin/horus_ap_action', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ target_ap: targetAp, action: 'tx_power', txpower: tx })
						});
					}
					btnApplyNet.disabled = false;
					ui.addNotification(null, E('p', '✅ تم إرسال أوامر ضبط الشبكة والـ IP إلى الإكسس بنجاح!'));
				}).catch(function(){
					btnApplyNet.disabled = false;
				});
			}
		};

		btnReboot.onclick = function() {
			var targetAp = inTargetAp.value;
			if (!targetAp) { alert('الرجاء اختيار الإكسس المستهدف أولاً.'); return; }
			if (confirm('إعادة تشغيل هذا الإكسس؟')) {
				fetch('/cgi-bin/horus_ap_action', { method: 'POST', body: JSON.stringify({ target_ap: targetAp, action: 'reboot' }) });
				ui.addNotification(null, E('p', 'تم إرسال أمر إعادة التشغيل'));
			}
		};

		btnWifiRestart.onclick = function() {
			var targetAp = inTargetAp.value;
			if (!targetAp) { alert('الرجاء اختيار الإكسس المستهدف أولاً.'); return; }
			fetch('/cgi-bin/horus_wifi_action', { method: 'POST', body: JSON.stringify({ target_ap: targetAp, action: 'restart_wifi' }) });
			ui.addNotification(null, E('p', 'تم إعادة تشغيل الوايرليس'));
		};

		btnRadioOff.onclick = function() {
			var targetAp = inTargetAp.value;
			if (!targetAp) { alert('الرجاء اختيار الإكسس المستهدف أولاً.'); return; }
			fetch('/cgi-bin/horus_ap_action', { method: 'POST', body: JSON.stringify({ target_ap: targetAp, action: 'wifi_radio', state: '1' }) });
			ui.addNotification(null, E('p', 'تم إيقاف بث الوايرليس'));
		};

		btnRadioOn.onclick = function() {
			var targetAp = inTargetAp.value;
			if (!targetAp) { alert('الرجاء اختيار الإكسس المستهدف أولاً.'); return; }
			fetch('/cgi-bin/horus_ap_action', { method: 'POST', body: JSON.stringify({ target_ap: targetAp, action: 'wifi_radio', state: '0' }) });
			ui.addNotification(null, E('p', 'تم تشغيل بث الوايرليس'));
		};

		loadAPs();

		return container;
	}
});
