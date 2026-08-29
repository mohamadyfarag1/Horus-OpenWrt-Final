'use strict';
'require view';
'require ui';
'require dom';

return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	render: function() {
		var container = E('div', { class: 'horus-wifi-container', style: 'direction:rtl; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;' });

		// Styles
		var styles = E('style', {}, `
			.wifi-card { background: rgba(128,128,128,0.06); padding: 22px; border-radius: 8px; border: 1px solid rgba(128,128,128,0.2); box-shadow: 0 2px 5px rgba(0,0,0,0.1); margin-bottom: 22px; }
			.wifi-card h3 { margin-top: 0; color: #00e676; border-bottom: 2px solid rgba(0,230,118,0.3); padding-bottom: 8px; font-size: 18px; }
			.wifi-row { display: flex; gap: 15px; margin-bottom: 15px; flex-wrap: wrap; }
			.wifi-field { flex: 1; min-width: 220px; display: flex; flex-direction: column; }
			.wifi-field label { font-size: 13px; font-weight: bold; margin-bottom: 5px; opacity: 0.9; }
			.wifi-field input, .wifi-field select { padding: 10px 12px; background: rgba(128,128,128,0.1); color: inherit; border: 1px solid rgba(128,128,128,0.3); border-radius: 4px; font-size: 14px; outline: none; }
			.wifi-btn { padding: 12px 28px; background: #00e676; color: #000; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 15px; transition: 0.2s; }
			.wifi-btn:hover { background: #00c853; }
			.wifi-alert { background: rgba(255,82,82,0.1); border: 1px solid rgba(255,82,82,0.3); color: #ff5252; padding: 10px 15px; border-radius: 6px; font-size: 13px; font-weight: 500; margin-bottom: 15px; }
		`);
		container.appendChild(styles);

		var inTargetAp = E('select', {}, [
			E('option', { value: 'ALL' }, '🌍 جميع الإكسسات في الشبكة (Broadcast to All APs)')
		]);

		var inBand = E('select', {}, [
			E('option', { value: 'both' }, 'الترددين معاً (2.4GHz + 5GHz)'),
			E('option', { value: '2g' }, 'تردد 2.4GHz فقط'),
			E('option', { value: '5g' }, 'تردد 5GHz فقط')
		]);

		var inSsid = E('input', { type: 'text', placeholder: 'مثال: Horus_Fast_WiFi' });
		var inPass = E('input', { type: 'password', placeholder: 'كلمة السر الجديدة (8 أحرف فأكثر)' });

		var inChannel = E('select', {}, [
			E('option', { value: '' }, 'بدون تغيير (تلقائي/الحالي)'),
			E('option', { value: 'auto' }, 'Auto (تلقائي)')
		]);
		for (var ch = 1; ch <= 13; ch++) inChannel.appendChild(E('option', { value: ch.toString() }, 'قناة ' + ch + ' (2.4GHz)'));
		[36, 40, 44, 48, 149, 153, 157, 161, 165].forEach(function(ch5) {
			inChannel.appendChild(E('option', { value: ch5.toString() }, 'قناة ' + ch5 + ' (5GHz)'));
		});

		var inHtmode = E('select', {}, [
			E('option', { value: '' }, 'بدون تغيير'),
			E('option', { value: 'HT20' }, '20 MHz (أفضل توافق وأقل تداخل)'),
			E('option', { value: 'HT40' }, '40 MHz (سرعة مضاعفة)'),
			E('option', { value: 'VHT80' }, '80 MHz (أقصى سرعة 5GHz)')
		]);

		var inEnc = E('select', {}, [
			E('option', { value: '' }, 'بدون تغيير'),
			E('option', { value: 'psk2' }, 'WPA2-PSK (موصى به لجميع الأجهزة)'),
			E('option', { value: 'psk2+ccmp' }, 'WPA2-PSK / AES CCMP'),
			E('option', { value: 'none' }, 'بدون رقم سري (شبكة مفتوحة)'),
			E('option', { value: 'sae' }, 'WPA3-SAE (تشفير متطور)')
		]);

		var btnApply = E('button', { class: 'wifi-btn' }, '🚀 تطبيق إعدادات الوايرليس عبر HMP');

		var card = E('div', { class: 'wifi-card' }, [
			E('h3', {}, '📶 التحكم الشامل بالواي فاي (WiFi Remote Control)'),
			E('div', { class: 'wifi-alert' }, '⚠️ تنبيه: تغيير إعدادات الواي فاي سيقوم بإعادة تشغيل راديو الإكسسات المحددة وتطبيق الإعدادات فوراً.'),
			E('div', { class: 'wifi-row' }, [
				E('div', { class: 'wifi-field' }, [ E('label', {}, 'الإكسس المستهدف (Target AP):'), inTargetAp ]),
				E('div', { class: 'wifi-field' }, [ E('label', {}, 'التردد المستهدف (Band):'), inBand ])
			]),
			E('div', { class: 'wifi-row' }, [
				E('div', { class: 'wifi-field' }, [ E('label', {}, 'اسم شبكة الواي فاي الجديد (SSID):'), inSsid ]),
				E('div', { class: 'wifi-field' }, [ E('label', {}, 'الرقم السري الجديد (Password):'), inPass ])
			]),
			E('div', { class: 'wifi-row' }, [
				E('div', { class: 'wifi-field' }, [ E('label', {}, 'القناة (Channel):'), inChannel ]),
				E('div', { class: 'wifi-field' }, [ E('label', {}, 'عرض القناة (Channel Width):'), inHtmode ]),
				E('div', { class: 'wifi-field' }, [ E('label', {}, 'نوع التشفير (Encryption):'), inEnc ])
			]),
			E('div', { style: 'margin-top: 15px;' }, [ btnApply ])
		]);
		container.appendChild(card);

		// Populate APs
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

		btnApply.onclick = function() {
			var targetAp = inTargetAp.value;
			var band = inBand.value;
			var ssid = inSsid.value.trim();
			var pass = inPass.value.trim();
			var ch = inChannel.value;
			var ht = inHtmode.value;
			var enc = inEnc.value;

			if (!ssid && !pass && !ch && !ht && !enc) {
				alert('الرجاء إدخال اسم شبكة أو رقم سري أو تغيير قناة لتطبيقها.');
				return;
			}

			btnApply.disabled = true;
			btnApply.textContent = 'جاري الإرسال عبر بروتوكول HMP...';

			fetch('/cgi-bin/horus_wifi_action', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					target_ap: targetAp,
					action: 'apply_profile',
					band: band,
					ssid: ssid,
					password: pass,
					channel: ch,
					htmode: ht,
					encryption: enc
				})
			}).then(function(){
				btnApply.disabled = false;
				btnApply.textContent = '🚀 تطبيق إعدادات الوايرليس عبر HMP';
				var targetName = targetAp === 'ALL' ? 'جميع الإكسسات' : targetAp;
				ui.addNotification(null, E('p', '✅ تم إرسال وتطبيق إعدادات الواي فاي بنجاح إلى: ' + targetName));
			}).catch(function(){
				btnApply.disabled = false;
				btnApply.textContent = '🚀 تطبيق إعدادات الوايرليس عبر HMP';
			});
		};

		loadAPs();

		return container;
	}
});
