'use strict';
'require view';
'require form';
'require uci';
'require ui';
'require fs';

return view.extend({
	render: function() {
		var m, s, o;

		var horus_version = '1.0.26-14';
		m = new form.Map('horus_controller', _('إعدادات نظام حورس'), _('نظام الإدارة المركزي لشبكات الوايرليس (WLC) - الإصدار: ') + horus_version);

		s = m.section(form.NamedSection, 'main', 'settings', _('الإعدادات'));
		s.anonymous = true;
		s.addremove = false;

		s.tab('role', _('نظام التشغيل'));
		s.tab('radius', _('إعدادات الريديس'));

		// Tab: role
		o = s.taboption('role', form.ListValue, 'role', _('دور الجهاز'));
		o.value('standalone', _('مستقل (Standalone)'));
		o.value('root', _('رئيسي (Root)'));
		o.value('satellite', _('فرعي (Satellite)'));
		o.default = 'standalone';

		o = s.taboption('role', form.DummyValue, '_role_help', _('مساعدة'));
		o.rawhtml = true;
		o.cfgvalue = function(section_id) {
			var role = uci.get('horus_controller', section_id, 'role');
			var desc = '';
			if (role === 'root') desc = 'هذا الجهاز سيعمل كجهاز تحكم رئيسي يستقبل البيانات من الفروع.';
			else if (role === 'satellite') desc = 'هذا الجهاز سيعمل كجهاز فرعي يرسل بيانات المتصلين للرئيسي.';
			else desc = 'هذا الجهاز سيعمل بشكل مستقل.';
			return '<div class="cbi-value-description">' + desc + '</div>';
		};

		o = s.taboption('role', form.Value, 'hmp_secret', _('مفتاح الأمان (HMP Secret)'));
		o.password = true;
		o.description = _('يجب أن يكون موحداً في جميع الأجهزة (الرئيسي والفروع).');

		o = s.taboption('role', form.Value, 'grace_period', _('فترة السماح (ثواني)'));
		o.datatype = 'uinteger';
		o.placeholder = '30';
		o.depends('role', 'root');
		o.description = _('مدة انتظار الموبايل المتنقل قبل حظره (Anti-Spoofing).');

		o = s.taboption('role', form.Value, 'controller_ip', _('عنوان الرووت (Controller IP)'));
		o.datatype = 'ip4addr';
		o.placeholder = '192.168.1.1 أو 255.255.255.255';
		o.depends('role', 'satellite');
		o.description = _('عنوان IP الخاص بالجهاز الرئيسي (مهم جداً إذا كانت الإكسسات على VLANs مختلفة).');

		o = s.taboption('role', form.Flag, 'auto_ch_2g', _('إدارة القنوات التلقائية 2.4GHz (RRM)'));
		o.depends('role', 'root');
		o.description = _('تغيير ترددات الإكسسات الفرعية تلقائياً لأفضل قناة خالية من التشويش.');

		o = s.taboption('role', form.Flag, 'auto_ch_5g', _('إدارة القنوات التلقائية 5GHz (RRM)'));
		o.depends('role', 'root');
		o.description = _('تغيير ترددات 5GHz تلقائياً للإكسسات الفرعية.');

		// Tab: radius
		o = s.taboption('radius', form.Flag, 'enabled', _('تفعيل مزامنة الريديس'));
		o.rmempty = false;

		o = s.taboption('radius', form.ListValue, 'radius_type', _('نوع الريديس'));
		o.value('sas', 'SAS 4');
		o.value('dma', 'DMA Radius');
		o.value('adv', 'Advanced Radius');

		o = s.taboption('radius', form.Value, 'base_url', _('عنوان السيرفر (Base URL)'));
		o = s.taboption('radius', form.Value, 'username', _('اسم المستخدم (API User)'));
		o = s.taboption('radius', form.Value, 'password', _('كلمة المرور (API Pass)'));
		o.password = true;

		o = s.taboption('radius', form.Value, 'api_key', _('مفتاح API'));
		o.password = true;
		o.depends('radius_type', 'adv');
		o.depends('radius_type', 'dma');

		o = s.taboption('radius', form.Value, 'sync_interval', _('سرعة التحديث (ثواني)'));
		o.datatype = 'uinteger';
		o.default = '10';

		o = s.taboption('radius', form.DummyValue, '_status', _('حالة الاتصال'));
		o.rawhtml = true;
		o.cfgvalue = function(section_id) {
			var en = uci.get('horus_controller', section_id, 'enabled');
			var url = uci.get('horus_controller', section_id, 'base_url');
			if (en !== '1' || !url) {
				return '<span style="color:#e74c3c;font-weight:bold;padding:5px;background:#fadbd8;border-radius:3px;">🔴 غير مهيأ (تحقق من الإعدادات)</span>';
			}
			return '<span id="horus_auto_status" style="color:#f39c12;font-weight:bold;padding:5px;background:#fcf3cf;border-radius:3px;">⏳ جاري فحص الاتصال بالسيرفر...</span>' +
				'<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" style="display:none;" onload="'+
				'fetch(\'/cgi-bin/horus_test\').then(function(r){return r.json();}).then(function(d){' +
				'var el = document.getElementById(\'horus_auto_status\'); if(!el) return;' +
				'if(d.success){' +
				'el.innerHTML = \'🟢 متصل بنجاح ✓\';' +
				'el.style.color = \'#27ae60\'; el.style.background = \'#d5f5e3\';' +
				'} else {' +
				'if(d.message.indexOf(\'Timeout\') !== -1 || d.message.indexOf(\'لا يوجد رد\') !== -1){' +
				'el.innerHTML = \'🔴 غير متصل (السيرفر لا يرد)\';' +
				'el.style.color = \'#c0392b\'; el.style.background = \'#f2d7d5\';' +
				'} else {' +
				'el.innerHTML = \'🟡 متصل ولكن البيانات غير صحيحة\';' +
				'el.style.color = \'#d35400\'; el.style.background = \'#fae5d3\';' +
				'}' +
				'}' +
				'}).catch(function(){' +
				'var el = document.getElementById(\'horus_auto_status\'); if(!el) return;' +
				'el.innerHTML = \'🔴 خطأ في تنفيذ الفحص\';' +
				'el.style.color = \'#c0392b\'; el.style.background = \'#f2d7d5\';' +
				'});' +
				'">';
		};

		return m.render();
	}
});
