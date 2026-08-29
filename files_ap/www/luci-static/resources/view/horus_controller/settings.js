'use strict';
'require view';
'require form';
'require uci';
'require ui';
'require fs';
'require horus_controller.i18n as horusI18n';

return view.extend({
	render: function() {
		var m, s, o;

		var horus_version = '1.0.26-36';
		m = new form.Map('horus_controller', horusI18n.t('settings'), _('Horus Wireless LAN Controller (WLC) - Build: ') + horus_version);

		s = m.section(form.NamedSection, 'main', 'settings', _('إعدادات النظام المركزية'));
		s.anonymous = false;
		s.addremove = false;

		s.tab('role', _('⚙️ نظام التشغيل والتحكم'));
		s.tab('roaming', _('🚀 التجوال الذكي (Smart Roaming)'));
		s.tab('radius', _('🌐 إعدادات الريديس (RADIUS)'));

		// Tab: role
		o = s.taboption('role', form.ListValue, 'role', _('دور الجهاز في الشبكة'));
		o.value('standalone', _('مستقل (Standalone)'));
		o.value('root', _('رئيسي (Root Controller)'));
		o.value('satellite', _('فرعي (Satellite AP)'));
		o.default = 'standalone';

		o = s.taboption('role', form.DummyValue, '_role_help', _('ملاحظة التشغيل'));
		o.rawhtml = true;
		o.cfgvalue = function(section_id) {
			var role = uci.get('horus_controller', section_id, 'role');
			var desc = '';
			if (role === 'root') desc = 'هذا الجهاز سيعمل كجهاز تحكم رئيسي (WLC Master) يستقبل بيانات كافة الإكسسات ويديرها مركزياً.';
			else if (role === 'satellite') desc = 'هذا الجهاز سيعمل كإكسس فرعي (Satellite) يرسل تقارير المتصلين والترافيك للرئيسي تلقائياً.';
			else desc = 'الجهاز يعمل بشكل مستقل بدون اتصال ببروتوكول HMP.';
			return '<div style="color:#00e676; font-weight:700; font-size:13px; padding:6px 12px; background:rgba(0,230,118,0.1); border-radius:6px; border:1px solid rgba(0,230,118,0.25);">' + desc + '</div>';
		};

		o = s.taboption('role', form.Value, 'hmp_secret', _('مفتاح الأمان (HMP Secret Key)'));
		o.password = true;
		o.description = _('مفتاح تشفير الاتصال بين الكنترولر والإكسسات (يجب أن يكون متطابقاً في جميع الأجهزة).');

		o = s.taboption('role', form.Value, 'grace_period', _('فترة السماح لمكافحة السرقة (ثواني)'));
		o.datatype = 'uinteger';
		o.placeholder = '30';
		o.depends('role', 'root');
		o.description = _('مدة انتظار الموبايل المتنقل قبل اعتباره ماك مسروق وحظره تلقائياً (Anti-Spoofing).');

		o = s.taboption('role', form.Value, 'controller_ip', _('عنوان الكنترولر (Controller IP)'));
		o.datatype = 'ip4addr';
		o.placeholder = '192.168.1.1';
		o.depends('role', 'satellite');
		o.description = _('عنوان IP الخاص بالكنترولر الرئيسي (مهم إذا كانت الإكسسات على شبكات أو VLANs مختلفة).');

		o = s.taboption('role', form.Flag, 'auto_ch_2g', _('إدارة ترددات 2.4GHz التلقائية (RRM)'));
		o.depends('role', 'root');
		o.description = _('فحص التشويش وتغيير ترددات الإكسسات الفرعية تلقائياً لأفضل قناة خالية.');

		o = s.taboption('role', form.Flag, 'auto_ch_5g', _('إدارة ترددات 5GHz التلقائية (RRM)'));
		o.depends('role', 'root');
		o.description = _('توزيع قنوات 5GHz تلقائياً لمنع تداخل الإشارات بين الإكسسات المتقاربة.');

		// Tab: roaming
		o = s.taboption('roaming', form.Flag, 'roaming_enabled', _('تفعيل التجوال الذكي (Enable Smart Roaming)'));
		o.default = '1';
		o.description = _('توجيه وطرد الهواتف ذات الإشارة الضعيفة تلقائياً للارتباط بأقرب إكسس ذي إشارة ممتازة.');

		o = s.taboption('roaming', form.Flag, 'enable_80211kv', _('بروتوكولات التنقل السريع (802.11k/v Fast Roaming)'));
		o.default = '1';
		o.description = _('إرسال تقارير الجيران (BSS Transition) لمساعدة الهواتف على التنقل اللحظي (<20ms) بدون قطع ألعاب أو مكالمات.');

		o = s.taboption('roaming', form.Value, 'min_rssi', _('عتبة الإشارة الدنيا لطرد العميل (Min-RSSI dBm)'));
		o.datatype = 'integer';
		o.placeholder = '-75';
		o.default = '-75';
		o.description = _('طرد الهاتف فوراً إذا هبطت إشارته عن هذا الحد (مثال: -75 dBm) لإجباره على الانتقال للإكسس الأقوى.');

		o = s.taboption('roaming', form.Flag, 'band_steering', _('التوجيه لتردد 5GHz السريع (Band Steering)'));
		o.default = '1';
		o.description = _('توجيه الهواتف الحديثة للاتصال بتردد 5GHz للحصول على أعلى سرعة إنترنت وتخفيف الضغط عن 2.4GHz.');

		o = s.taboption('roaming', form.Value, 'roam_diff', _('فارق الإشارة المطلوب للنقل (Signal Delta dBm)'));
		o.datatype = 'uinteger';
		o.placeholder = '10';
		o.default = '10';
		o.description = _('الحد الأدنى لفارق قوة الإشارة بين الإكسسين لبدء نقل الهاتف (مثال: 10 dBm).');

		// Tab: radius
		o = s.taboption('radius', form.Flag, 'enabled', _('تفعيل مزامنة بيانات الريديس'));
		o.rmempty = false;

		o = s.taboption('radius', form.ListValue, 'radius_type', _('نوع سيرفر الريديس'));
		o.value('sas', 'SAS 4');
		o.value('dma', 'DMA Radius');
		o.value('adv', 'Advanced Radius');

		o = s.taboption('radius', form.Value, 'base_url', _('عنوان السيرفر (Base URL)'));
		o = s.taboption('radius', form.Value, 'username', _('اسم المستخدم (API Username)'));
		o = s.taboption('radius', form.Value, 'password', _('كلمة المرور (API Password)'));
		o.password = true;

		o = s.taboption('radius', form.Value, 'api_key', _('مفتاح API'));
		o.password = true;
		o.depends('radius_type', 'adv');
		o.depends('radius_type', 'dma');

		o = s.taboption('radius', form.Value, 'sync_interval', _('معدل تكرار المزامنة (ثواني)'));
		o.datatype = 'uinteger';
		o.default = '10';

		o = s.taboption('radius', form.DummyValue, '_status', _('حالة الاتصال بالسيرفر'));
		o.rawhtml = true;
		o.cfgvalue = function(section_id) {
			var en = uci.get('horus_controller', section_id, 'enabled');
			var url = uci.get('horus_controller', section_id, 'base_url');
			if (en !== '1' || !url) {
				return '<span style="color:#e74c3c;font-weight:bold;padding:6px 12px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);border-radius:6px;">🔴 غير مهيأ (تحقق من إدخال الرابط والبيانات)</span>';
			}
			return '<span id="horus_auto_status" style="color:#fbbf24;font-weight:bold;padding:6px 12px;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);border-radius:6px;">⏳ جاري فحص الاتصال بالسيرفر...</span>' +
				'<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" style="display:none;" onload="'+
				'fetch(\'/cgi-bin/horus_test\').then(function(r){return r.json();}).then(function(d){' +
				'var el = document.getElementById(\'horus_auto_status\'); if(!el) return;' +
				'if(d.success){' +
				'el.innerHTML = \'🟢 متصل بالسيرفر بنجاح ✓\';' +
				'el.style.color = \'#4ade80\'; el.style.background = \'rgba(34,197,94,0.15)\'; el.style.borderColor = \'rgba(34,197,94,0.3)\';' +
				'} else {' +
				'if(d.message.indexOf(\'Timeout\') !== -1 || d.message.indexOf(\'لا يوجد رد\') !== -1){' +
				'el.innerHTML = \'🔴 غير متصل (السيرفر لا يرد)\';' +
				'el.style.color = \'#f87171\'; el.style.background = \'rgba(239,68,68,0.15)\'; el.style.borderColor = \'rgba(239,68,68,0.3)\';' +
				'} else {' +
				'el.innerHTML = \'🟡 متصل ولكن بيانات الدخول غير صحيحة\';' +
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
			var langBtn = horusI18n.buildLangBtn(function() {
				window.location.reload();
			});

			var topBar = E('div', { style: 'display:flex; justify-content:space-between; align-items:center; max-width:1050px; margin:0 auto 16px auto; padding:0 4px;' }, [
				E('div', {}, [
					E('h2', { style: 'margin:0; color:#f8fafc; font-size:20px; font-weight:800;' }, '⚙️ إعدادات نظام حورس (Horus WLC Settings)'),
					E('p', { style: 'margin:4px 0 0 0; color:#94a3b8; font-size:13px;' }, 'الإصدار: ' + horus_version + ' | إدارة التوجيه، التجوال الذكي، الريديس، وبروتوكول HMP')
				]),
				langBtn
			]);

			var wrapper = E('div', { class: 'horus-settings-view', style: 'direction:' + horusI18n.getDir() + '; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;' }, [
				E('style', {}, `
					#maincontent { max-width: 98% !important; width: 98% !important; margin: 0 auto !important; padding: 10px !important; }
					.horus-settings-view { width: 100% !important; box-sizing: border-box; }
					
					/* Hide LuCI Default Headers & Help Bubbles */
					.cbi-map > h2:first-child, .cbi-map > .cbi-map-descr, .cbi-value-help, .cbi-tooltip-container { display: none !important; }
					
					.cbi-map { max-width: 1050px !important; width: 100% !important; margin: 0 auto !important; color: #f8fafc; }
					.cbi-section { background: rgba(30, 41, 59, 0.75) !important; backdrop-filter: blur(14px) !important; -webkit-backdrop-filter: blur(14px) !important; border: 1px solid rgba(255, 255, 255, 0.12) !important; border-radius: 14px !important; padding: 24px 28px !important; margin-bottom: 22px !important; box-shadow: 0 15px 35px -5px rgba(0, 0, 0, 0.5) !important; }
					.cbi-section-node { background: transparent !important; border: none !important; padding: 0 !important; }
					
					/* Clean Modern Tabs */
					.cbi-tabmenu { border-bottom: 2px solid rgba(255,255,255,0.1) !important; margin-bottom: 24px !important; display: flex !important; gap: 10px !important; padding: 0 !important; }
					.cbi-tabmenu > li { margin: 0 !important; list-style: none !important; }
					.cbi-tabmenu > li > a { padding: 12px 22px !important; font-size: 14px !important; font-weight: 700 !important; border-radius: 10px 10px 0 0 !important; background: rgba(15, 23, 42, 0.5) !important; border: 1px solid rgba(255,255,255,0.08) !important; border-bottom: none !important; color: #94a3b8 !important; text-decoration: none !important; display: inline-block !important; transition: all 0.2s !important; }
					.cbi-tabmenu > li.cbi-tab > a { background: rgba(30, 41, 59, 0.95) !important; color: #00e676 !important; border-color: rgba(0, 230, 118, 0.4) !important; border-bottom: 2px solid #00e676 !important; margin-bottom: -2px !important; box-shadow: 0 -4px 10px rgba(0,230,118,0.1) !important; }
					.cbi-tabmenu > li > a:hover:not(.cbi-tab) { background: rgba(51, 65, 85, 0.6) !important; color: #f8fafc !important; }
					
					/* Perfectly Aligned 2-Column Form Rows */
					.cbi-value { border-bottom: 1px solid rgba(255,255,255,0.06) !important; padding: 16px 10px !important; display: flex !important; flex-direction: row !important; justify-content: space-between !important; align-items: flex-start !important; width: 100% !important; box-sizing: border-box !important; margin: 0 !important; }
					.cbi-value:hover { background: rgba(255,255,255,0.02) !important; border-radius: 8px; }
					
					.cbi-value-title { flex: 0 0 42% !important; max-width: 42% !important; font-weight: 700 !important; font-size: 14px !important; color: #f1f5f9 !important; text-align: right !important; padding: 8px 0 0 0 !important; margin: 0 !important; line-height: 1.5 !important; }
					.cbi-value-field { flex: 0 0 54% !important; max-width: 54% !important; text-align: right !important; padding: 0 !important; margin: 0 !important; }
					
					.cbi-value-field input[type="text"], .cbi-value-field input[type="password"], .cbi-value-field select { width: 100% !important; box-sizing: border-box !important; background: #0f172a !important; border: 1px solid rgba(255, 255, 255, 0.15) !important; border-radius: 8px !important; padding: 10px 14px !important; color: #f8fafc !important; font-size: 14px !important; outline: none !important; transition: all 0.2s !important; }
					.cbi-value-field input:focus, .cbi-value-field select:focus { border-color: #00e676 !important; box-shadow: 0 0 0 3px rgba(0, 230, 118, 0.2) !important; }
					.cbi-value-field input[type="checkbox"] { width: 22px !important; height: 22px !important; accent-color: #00e676 !important; cursor: pointer !important; margin-top: 6px !important; }
					
					.cbi-value-description { color: #94a3b8 !important; font-size: 12px !important; margin-top: 6px !important; line-height: 1.5 !important; }
					
					/* Action Buttons */
					.cbi-page-actions { display: flex !important; justify-content: flex-end !important; gap: 12px !important; background: rgba(15, 23, 42, 0.7) !important; border: 1px solid rgba(255,255,255,0.1) !important; border-radius: 12px !important; padding: 16px 24px !important; margin-top: 20px !important; }
					.cbi-button-apply, .cbi-button-save { background: linear-gradient(135deg, #00e676 0%, #00b0ff 100%) !important; color: #000 !important; font-weight: 800 !important; font-size: 14px !important; padding: 10px 24px !important; border: none !important; border-radius: 8px !important; cursor: pointer !important; box-shadow: 0 4px 14px rgba(0, 230, 118, 0.25) !important; transition: all 0.2s !important; }
					.cbi-button-apply:hover, .cbi-button-save:hover { transform: translateY(-1px) !important; box-shadow: 0 6px 18px rgba(0, 230, 118, 0.4) !important; }
					.cbi-button-reset { background: rgba(239, 68, 68, 0.15) !important; color: #f87171 !important; border: 1px solid rgba(239, 68, 68, 0.3) !important; font-weight: 700 !important; font-size: 14px !important; padding: 10px 20px !important; border-radius: 8px !important; cursor: pointer !important; }
				`),
				topBar,
				mapNode
			]);
			return wrapper;
		});
	}
});
