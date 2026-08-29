'use strict';
'require view';
'require form';
'require uci';
'require ui';
'require fs';

return view.extend({
	render: function() {
		var m, s, o;

		var horus_version = '1.0.26-34';
		m = new form.Map('horus_controller', _('إعدادات نظام حورس'), _('نظام الإدارة المركزي لشبكات الوايرليس (WLC) - الإصدار: ') + horus_version);

		s = m.section(form.NamedSection, 'main', 'settings', _('الإعدادات العامة والتشغيل'));
		s.anonymous = false;
		s.addremove = false;

		s.tab('role', _('نظام التشغيل'));
		s.tab('roaming', _('التجوال الذكي والتوجيه (Smart Roaming)'));
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
			return '<div class="cbi-value-description" style="color:#00e676; font-weight:600;">' + desc + '</div>';
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

		// Tab: roaming
		o = s.taboption('roaming', form.Flag, 'roaming_enabled', _('تفعيل التجوال والتوجيه الذكي (Enable Smart Roaming)'));
		o.default = '1';
		o.description = _('نقل وطرد الهواتف ذات الإشارة الضعيفة تلقائياً للإكسس الأقرب بدون انقطاع.');

		o = s.taboption('roaming', form.Flag, 'enable_80211kv', _('تفعيل بروتوكولات 802.11k/v (Fast BSS Transition)'));
		o.default = '1';
		o.description = _('إرسال تقارير الجيران ومساعدة الهواتف الحديثة على التنقل فائق السرعة (<20ms).');

		o = s.taboption('roaming', form.Value, 'min_rssi', _('عتبة الإشارة الدنيا لطرد العميل (Min-RSSI dBm)'));
		o.datatype = 'integer';
		o.placeholder = '-75';
		o.default = '-75';
		o.description = _('طرد الهاتف فوراً إذا انخفضت إشارته عن هذا الحد (مثال: -75 dBm) لإجباره على الارتباط بالإكسس الأقوى.');

		o = s.taboption('roaming', form.Flag, 'band_steering', _('التوجيه التلقائي لتردد 5GHz عالي السرعة (Band Steering)'));
		o.default = '1';
		o.description = _('توجيه الهواتف ذات الإشارة القوية للاتصال بتردد 5GHz للحصول على أعلى سرعة إنترنت.');

		o = s.taboption('roaming', form.Value, 'roam_diff', _('فارق قوة الإشارة المطلوب للنقل (Signal Delta dBm)'));
		o.datatype = 'uinteger';
		o.placeholder = '10';
		o.default = '10';
		o.description = _('الحد الأدنى لفارق الإشارة بين الإكسسين لبدء توجيه الهاتف.');

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
				return '<span style="color:#e74c3c;font-weight:bold;padding:5px 10px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);border-radius:6px;">🔴 غير مهيأ (تحقق من الإعدادات)</span>';
			}
			return '<span id="horus_auto_status" style="color:#fbbf24;font-weight:bold;padding:5px 10px;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);border-radius:6px;">⏳ جاري فحص الاتصال بالسيرفر...</span>' +
				'<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" style="display:none;" onload="'+
				'fetch(\'/cgi-bin/horus_test\').then(function(r){return r.json();}).then(function(d){' +
				'var el = document.getElementById(\'horus_auto_status\'); if(!el) return;' +
				'if(d.success){' +
				'el.innerHTML = \'🟢 متصل بنجاح ✓\';' +
				'el.style.color = \'#4ade80\'; el.style.background = \'rgba(34,197,94,0.15)\'; el.style.borderColor = \'rgba(34,197,94,0.3)\';' +
				'} else {' +
				'if(d.message.indexOf(\'Timeout\') !== -1 || d.message.indexOf(\'لا يوجد رد\') !== -1){' +
				'el.innerHTML = \'🔴 غير متصل (السيرفر لا يرد)\';' +
				'el.style.color = \'#f87171\'; el.style.background = \'rgba(239,68,68,0.15)\'; el.style.borderColor = \'rgba(239,68,68,0.3)\';' +
				'} else {' +
				'el.innerHTML = \'🟡 متصل ولكن البيانات غير صحيحة\';' +
				'el.style.color = \'#fbbf24\'; el.style.background = \'rgba(245,158,11,0.15)\'; el.style.borderColor = \'rgba(245,158,11,0.3)\';' +
				'}' +
				'}' +
				'}).catch(function(){' +
				'var el = document.getElementById(\'horus_auto_status\'); if(!el) return;' +
				'el.innerHTML = \'🔴 خطأ في تنفيذ الفحص\';' +
				'el.style.color = \'#f87171\'; el.style.background = \'rgba(239,68,68,0.15)\'; el.style.borderColor = \'rgba(239,68,68,0.3)\';' +
				'});' +
				'">';
		};

		return m.render().then(function(mapNode) {
			var wrapper = E('div', { class: 'horus-settings-view', style: 'direction:rtl; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;' }, [
				E('style', {}, `
					#maincontent { max-width: 98% !important; width: 98% !important; margin: 0 auto !important; padding: 10px !important; }
					.horus-settings-view { width: 100% !important; max-width: 100% !important; box-sizing: border-box; }
					.cbi-map { width: 100% !important; max-width: 100% !important; color: #f8fafc; }
					.cbi-map-descr { color: #94a3b8 !important; font-size: 13px !important; margin-bottom: 20px !important; }
					.cbi-section { background: rgba(30, 41, 59, 0.7) !important; backdrop-filter: blur(12px) !important; border: 1px solid rgba(255, 255, 255, 0.1) !important; border-radius: 12px !important; padding: 24px !important; margin-bottom: 22px !important; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4) !important; }
					.cbi-section-node { background: transparent !important; border: none !important; padding: 0 !important; }
					
					.cbi-tabmenu { border-bottom: 2px solid rgba(255,255,255,0.1) !important; margin-bottom: 22px !important; display: flex !important; gap: 8px !important; padding: 0 !important; }
					.cbi-tabmenu > li { margin: 0 !important; list-style: none !important; }
					.cbi-tabmenu > li > a { padding: 12px 24px !important; font-size: 14px !important; font-weight: 700 !important; border-radius: 10px 10px 0 0 !important; background: rgba(15, 23, 42, 0.4) !important; border: 1px solid rgba(255,255,255,0.08) !important; border-bottom: none !important; color: #94a3b8 !important; text-decoration: none !important; display: inline-block !important; transition: all 0.2s !important; }
					.cbi-tabmenu > li.cbi-tab > a { background: rgba(30, 41, 59, 0.9) !important; color: #00e676 !important; border-color: rgba(0, 230, 118, 0.4) !important; border-bottom: 2px solid #00e676 !important; margin-bottom: -2px !important; }
					.cbi-tabmenu > li > a:hover:not(.cbi-tab) { background: rgba(51, 65, 85, 0.5) !important; color: #f8fafc !important; }
					
					.cbi-value { border-bottom: 1px solid rgba(255,255,255,0.06) !important; padding: 16px 0 !important; display: flex !important; flex-wrap: wrap !important; align-items: center !important; }
					.cbi-value-title { font-weight: 700 !important; font-size: 14px !important; color: #cbd5e1 !important; min-width: 260px !important; text-align: right !important; }
					.cbi-value-field { flex: 1 !important; min-width: 280px !important; }
					.cbi-value-field input[type="text"], .cbi-value-field input[type="password"], .cbi-value-field select { background: rgba(15, 23, 42, 0.6) !important; border: 1px solid rgba(255, 255, 255, 0.15) !important; border-radius: 8px !important; padding: 10px 14px !important; color: #f8fafc !important; font-size: 14px !important; min-width: 300px !important; outline: none !important; transition: all 0.2s !important; }
					.cbi-value-field input:focus, .cbi-value-field select:focus { border-color: #00e676 !important; box-shadow: 0 0 0 3px rgba(0, 230, 118, 0.2) !important; }
					.cbi-value-description { color: #94a3b8 !important; font-size: 12px !important; margin-top: 6px !important; }
					.cbi-page-actions { background: rgba(15, 23, 42, 0.6) !important; border: 1px solid rgba(255,255,255,0.1) !important; border-radius: 10px !important; padding: 16px !important; margin-top: 20px !important; }
					.cbi-button-apply, .cbi-button-save { background: linear-gradient(135deg, #00e676 0%, #00b0ff 100%) !important; color: #000 !important; font-weight: 800 !important; border-radius: 8px !important; padding: 8px 20px !important; }
					.cbi-button-reset { background: rgba(239, 68, 68, 0.2) !important; color: #f87171 !important; border: 1px solid rgba(239, 68, 68, 0.4) !important; border-radius: 8px !important; padding: 8px 20px !important; font-weight: 700 !important; }
				`),
				mapNode
			]);
			return wrapper;
		});
	}
});
