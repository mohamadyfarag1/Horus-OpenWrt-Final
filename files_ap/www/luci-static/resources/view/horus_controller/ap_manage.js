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
		
		// Section 1: Basic AP Management (IP/TxPower)
		var s = m.section(form.NamedSection, 'ap_form', 'ap', _('إدارة الإكسسات (AP Management)'), _('تحكم متقدم في الإكسسات التابعة (تغيير الـ IP، إعادة التشغيل، قوة البث)'));

		var ap = s.option(form.ListValue, 'target_ap', _('اختيار الإكسس'));
		ap.value('ALL', _('الكل (تطبيق على جميع الإكسسات)'));
		if (data && data.aps) {
			Object.keys(data.aps).forEach(function(mac) {
				var info = data.aps[mac];
				ap.value(mac, (info.hostname || 'Unknown') + ' (' + mac + ')');
			});
		}

		var ip = s.option(form.Value, 'ip', _('IP Address (الجديد)'));
		ip.datatype = 'ip4addr';
		
		var netmask = s.option(form.Value, 'netmask', _('Subnet Mask (الجديد)'));
		netmask.datatype = 'ip4addr';
		netmask.placeholder = '255.255.255.0';

		var gateway = s.option(form.Value, 'gateway', _('Gateway (الجديد)'));
		gateway.datatype = 'ip4addr';
		
		var txpower = s.option(form.Value, 'txpower', _('قوة الإشارة (TxPower dBm)'));
		txpower.datatype = 'uinteger';
		txpower.placeholder = '20';

		var btnIp = s.option(form.Button, 'apply_ip_btn', _('تطبيق الـ IP والشبكة'));
		btnIp.inputstyle = 'apply';
		btnIp.onclick = function() {
			var form_ap = ap.formvalue('ap_form');
			var form_ip = ip.formvalue('ap_form');
			var form_nm = netmask.formvalue('ap_form') || '255.255.255.0';
			var form_gw = gateway.formvalue('ap_form');
			var form_tx = txpower.formvalue('ap_form');

			if (!form_ap) {
				ui.addNotification(null, E('p', _('يرجى اختيار الإكسس أولاً')));
				return;
			}
			
			if (form_ip) {
				var payload = { target_ap: form_ap, action: 'set_ip', ip: form_ip, netmask: form_nm };
				if (form_gw) payload.gateway = form_gw;
				fetch('/cgi-bin/horus_ap_action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
			}
			
			if (form_tx) {
				fetch('/cgi-bin/horus_ap_action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_ap: form_ap, action: 'tx_power', txpower: form_tx }) });
			}
			
			var apName = form_ap === 'ALL' ? _('جميع الإكسسات') : form_ap;
			ui.addNotification(null, E('p', _('تم إرسال أوامر الإدارة إلى: ') + apName));
		};

		// Section 2: Advanced Control (Hostname, Radio, Ports)
		var s2 = m.section(form.NamedSection, 'adv_form', 'ap', _('التحكم العميق بالهاردوير (Layer 2)'), _('التحكم في اسم الإكسس وتشغيل/إطفاء منافذ اللان والواي فاي عبر HMP'));
		
		var hname = s2.option(form.Value, 'hostname', _('اسم الإكسس (Hostname)'));
		
		var radio = s2.option(form.ListValue, 'wifi_radio', _('حالة بث الواي فاي (Radio)'));
		radio.value('', _('بدون تغيير'));
		radio.value('0', _('تشغيل (Enable)'));
		radio.value('1', _('إطفاء (Disable)'));
		
		var portName = s2.option(form.Value, 'port_name', _('اسم منفذ اللان (مثال: lan1, lan2)'));
		portName.placeholder = 'lan1';
		
		var portState = s2.option(form.ListValue, 'port_state', _('حالة منفذ اللان'));
		portState.value('', _('بدون تغيير'));
		portState.value('up', _('تفعيل (Enable)'));
		portState.value('down', _('تعطيل (Disable)'));

		var btnAdv = s2.option(form.Button, 'apply_adv_btn', _('تطبيق أوامر الهاردوير'));
		btnAdv.inputstyle = 'apply';
		btnAdv.onclick = function() {
			var form_ap = ap.formvalue('ap_form');
			if (!form_ap) {
				ui.addNotification(null, E('p', _('يرجى اختيار الإكسس من القسم الأعلى أولاً')));
				return;
			}
			
			var h = hname.formvalue('adv_form');
			var r = radio.formvalue('adv_form');
			var pName = portName.formvalue('adv_form');
			var pState = portState.formvalue('adv_form');

			if (h) {
				fetch('/cgi-bin/horus_ap_action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_ap: form_ap, action: 'set_hostname', hostname: h }) });
			}
			if (r) {
				fetch('/cgi-bin/horus_ap_action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_ap: form_ap, action: 'wifi_radio', state: r }) });
			}
			if (pName && pState) {
				fetch('/cgi-bin/horus_ap_action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_ap: form_ap, action: 'port_state', port: pName, state: pState }) });
			}
			
			var apName = form_ap === 'ALL' ? _('جميع الإكسسات') : form_ap;
			ui.addNotification(null, E('p', _('تم إرسال الأوامر المتقدمة إلى: ') + apName));
		};

		// Section 3: Reboot
		var s3 = m.section(form.NamedSection, 'reboot_form', 'ap', _('إعادة التشغيل'));
		var btnReboot = s3.option(form.Button, 'reboot_btn', _('إعادة تشغيل (Reboot)'));
		btnReboot.inputstyle = 'remove';
		btnReboot.onclick = function() {
			var form_ap = ap.formvalue('ap_form');
			if (!form_ap) {
				ui.addNotification(null, E('p', _('يرجى اختيار الإكسس من القسم الأعلى أولاً')));
				return;
			}
			var msg = form_ap === 'ALL' ? _('هل أنت متأكد من إعادة تشغيل جميع الإكسسات المتصلة؟') : _('هل أنت متأكد من إعادة تشغيل الإكسس المختار؟');
			if (confirm(msg)) {
				fetch('/cgi-bin/horus_ap_action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_ap: form_ap, action: 'reboot' }) });
				var apName = form_ap === 'ALL' ? _('جميع الإكسسات') : form_ap;
				ui.addNotification(null, E('p', _('تم إرسال أمر إعادة التشغيل إلى: ') + apName));
			}
		};

		return m.render().then(function(node) {
			var wrapper = E('div', { 'class': 'cbi-map', 'dir': 'rtl' }, node);
			return wrapper;
		});
	}
});
