'use strict';
'require view';
'require form';
'require ui';
'require dom';

return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	load: function() {
		return fetch('/cgi-bin/horus_map_data').then(function(res) {
			return res.json();
		}).catch(function() { return { aps: {} }; });
	},

	render: function(data) {
		var m = new form.JSONMap({}, '');
		var s = m.section(form.NamedSection, 'wifi_form', 'wifi', _('التحكم في الواي فاي (WiFi Remote Control)'), _('<span style="color:red">تحذير: تغيير الإعدادات سيؤدي إلى فصل جميع العملاء لمدة ثانيتين</span>'));

		var ap = s.option(form.ListValue, 'target_ap', _('اختيار الإكسس'));
		ap.value('ALL', _('الكل (تطبيق على جميع الإكسسات)'));
		
		if (data && data.aps) {
			Object.keys(data.aps).forEach(function(mac) {
				var info = data.aps[mac];
				ap.value(mac, (info.hostname || 'Unknown') + ' (' + mac + ')');
			});
		}

		var ssid = s.option(form.Value, 'ssid', _('New SSID (اسم الشبكة الجديد)'));
		var pwd = s.option(form.Value, 'password', _('New Password (الرقم السري)'));
		pwd.password = true;

		var ch = s.option(form.ListValue, 'channel', _('Channel (القناة)'));
		ch.value('', _('بدون تغيير'));
		for (var i = 1; i <= 13; i++) ch.value(i.toString());
		[36,40,44,48,149,153,157,161,165].forEach(function(c) {
			ch.value(c.toString());
		});
		
		var htmode = s.option(form.ListValue, 'htmode', _('عرض القناة (Channel Width)'));
		htmode.value('', _('بدون تغيير'));
		htmode.value('HT20', '20 MHz');
		htmode.value('HT40', '40 MHz');
		htmode.value('VHT80', '80 MHz');

		var wmode = s.option(form.ListValue, 'mode', _('وضع التشغيل (Wireless Mode)'));
		wmode.value('', _('بدون تغيير'));
		wmode.value('ap', 'Access Point (بث واي فاي)');
		wmode.value('sta', 'Client / Station (استقبال)');
		wmode.value('mesh', 'Mesh (802.11s)');
		wmode.value('monitor', 'Monitor (وضع المراقبة)');

		var enc = s.option(form.ListValue, 'encryption', _('Encryption (التشفير)'));
		enc.value('', _('بدون تغيير'));
		enc.value('none', 'بدون رقم سري (مفتوحة)');
		enc.value('psk2', 'WPA2-PSK');
		enc.value('psk2+ccmp', 'WPA2-PSK/CCMP');
		enc.value('sae', 'WPA3-SAE');

		var btn = s.option(form.Button, 'apply_btn', _('تطبيق التغييرات'));
		btn.inputstyle = 'apply';
		btn.onclick = function() {
			var form_ap = ap.formvalue('wifi_form');
			var form_ssid = ssid.formvalue('wifi_form');
			var form_pwd = pwd.formvalue('wifi_form');
			var form_ch = ch.formvalue('wifi_form');
			var form_ht = htmode.formvalue('wifi_form');
			var form_enc = enc.formvalue('wifi_form');
			var form_wmode = wmode.formvalue('wifi_form');

			if (!form_ap) {
				ui.addNotification(null, E('p', _('يرجى اختيار الإكسس أولاً')));
				return;
			}

			if (form_ssid) {
				fetch('/cgi-bin/horus_wifi_action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_ap: form_ap, iface: 'wlan0', action: 'set_ssid', value: form_ssid }) });
			}
			if (form_pwd) {
				fetch('/cgi-bin/horus_wifi_action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_ap: form_ap, iface: 'wlan0', action: 'set_password', value: form_pwd }) });
			}
			if (form_ch) {
				fetch('/cgi-bin/horus_wifi_action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_ap: form_ap, iface: 'wlan0', action: 'set_channel', value: form_ch }) });
			}
			if (form_ht) {
				fetch('/cgi-bin/horus_wifi_action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_ap: form_ap, iface: 'wlan0', action: 'set_htmode', value: form_ht }) });
			}
			if (form_enc) {
				fetch('/cgi-bin/horus_wifi_action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_ap: form_ap, iface: 'wlan0', action: 'set_encryption', value: form_enc }) });
			}
			if (form_wmode) {
				fetch('/cgi-bin/horus_wifi_action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_ap: form_ap, iface: 'wlan0', action: 'set_mode', value: form_wmode }) });
			}
			
			var apName = form_ap === 'ALL' ? _('جميع الإكسسات') : form_ap;
			ui.addNotification(null, E('p', _('تم إرسال أوامر التغيير إلى: ') + apName));
		};

		return m.render().then(function(node) {
			var wrapper = E('div', { 'class': 'cbi-map', 'dir': 'rtl' }, node);
			return wrapper;
		});
	}
});
