'use strict';
'require view';
'require form';
'require uci';
'require fs';
'require ui';
'require poll';

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(fs.read('/tmp/cloud.status'), '🔴 الخدمة متوقفة (Offline)'),
			L.resolveDefault(fs.read('/tmp/cloud.url'), ''),
			L.resolveDefault(fs.read('/tmp/cloud.log'), ''),
			uci.load('cloud')
		]);
	},

	render: function(data) {
		var initialStatus = (data[0] || '').trim(),
		    initialUrl = (data[1] || '').trim(),
		    initialLog = (data[2] || '').trim();

		var m, s, o;

		m = new form.Map('cloud', _('الوصول السحابي (Cloudflare Zero-Trust Tunnel)'),
			_('إدارة الوصول الآمن والتحكم عن بُعد في الراوتر وأجهزة الشبكة الداخلية دون الحاجة لعنوان IP عام أو فتح منافذ بالجدار الناري.'));

		// --- Section 1: Live Status Header Card ---
		s = m.section(form.NamedSection, 'main', 'settings', _('حالة الاتصال المباشرة'));
		s.anonymous = true;

		var statusBadge = E('span', {
			'id': 'cloud-status-badge',
			'style': 'display:inline-flex; align-items:center; gap:6px; font-size:13px; font-weight:700; padding:6px 14px; border-radius:6px; background:#f3f4f6; color:#374151; border:1px solid #e5e7eb;'
		}, [ initialStatus ]);

		var urlContainer = E('div', {
			'id': 'cloud-url-box',
			'style': 'margin-top:10px; display:' + (initialUrl ? 'flex' : 'none') + '; align-items:center; gap:10px; flex-wrap:wrap;'
		}, [
			E('strong', { 'style': 'font-size:13px;' }, _('رابط الدخول السحابي:')),
			E('a', {
				'id': 'cloud-url-link',
				'href': initialUrl,
				'target': '_blank',
				'style': 'font-size:14px; font-weight:700; color:#0066cc; text-decoration:underline;'
			}, [ initialUrl ]),
			E('button', {
				'class': 'btn btn-primary',
				'style': 'padding:3px 10px; font-size:12px;',
				'click': function(ev) {
					ev.preventDefault();
					var link = document.getElementById('cloud-url-link').href;
					if (link) {
						navigator.clipboard.writeText(link);
						ui.addNotification(null, E('p', _('تم نسخ رابط الدخول بنجاح!')));
					}
				}
			}, [ _('📋 نسخ الرابط') ]),
			E('a', {
				'id': 'cloud-url-open',
				'href': initialUrl,
				'target': '_blank',
				'class': 'btn',
				'style': 'padding:3px 10px; font-size:12px; text-decoration:none;'
			}, [ _('فتح ↗') ])
		]);

		var statusWidget = s.option(form.DummyValue, '_status_card', _('حالة النفق'));
		statusWidget.rawhtml = true;
		statusWidget.cfgvalue = function() {
			return E('div', { 'class': 'cbi-value-field', 'style': 'padding:6px 0;' }, [
				statusBadge,
				urlContainer
			]);
		};

		// Poll for Live Status Updates every 3 seconds
		poll.add(function() {
			return Promise.all([
				L.resolveDefault(fs.read('/tmp/cloud.status'), ''),
				L.resolveDefault(fs.read('/tmp/cloud.url'), ''),
				L.resolveDefault(fs.read('/tmp/cloud.log'), '')
			]).then(function(res) {
				var st = (res[0] || '').trim();
				var ur = (res[1] || '').trim();
				var lg = (res[2] || '').trim();

				var elBadge = document.getElementById('cloud-status-badge');
				if (elBadge && st) {
					elBadge.textContent = st;
					if (st.indexOf('Online') !== -1 || st.indexOf('متصل') !== -1) {
						elBadge.style.background = '#def7ec';
						elBadge.style.color = '#03543f';
						elBadge.style.border = '1px solid #31c48d';
					} else if (st.indexOf('Offline') !== -1 || st.indexOf('خطأ') !== -1) {
						elBadge.style.background = '#fde8e8';
						elBadge.style.color = '#9b1c1c';
						elBadge.style.border = '1px solid #f98080';
					} else {
						elBadge.style.background = '#fef08a';
						elBadge.style.color = '#713f12';
						elBadge.style.border = '1px solid #facc15';
					}
				}

				var elUrlBox = document.getElementById('cloud-url-box');
				var elUrlLink = document.getElementById('cloud-url-link');
				var elUrlOpen = document.getElementById('cloud-url-open');
				if (elUrlBox && elUrlLink) {
					if (ur) {
						elUrlBox.style.display = 'flex';
						elUrlLink.href = ur;
						elUrlLink.textContent = ur;
						if (elUrlOpen) elUrlOpen.href = ur;
					} else {
						elUrlBox.style.display = 'none';
					}
				}

				var elLog = document.getElementById('cloud-live-log');
				if (elLog && lg) {
					elLog.textContent = lg.split('\n').slice(-30).join('\n');
				}
			});
		}, 3);

		// --- Section 2: Tabbed Configuration Section ---
		s = m.section(form.NamedSection, 'main', 'settings', _('خيارات وإعدادات الخدمة'));
		s.anonymous = true;
		s.addremove = false;

		s.tab('general', _('الإعدادات العامة (General)'));
		s.tab('devices', _('توجيه الأجهزة (Forwarded Devices)'));
		s.tab('log', _('سجل الأحداث (Logs)'));

		// --- General Tab Options ---
		o = s.taboption('general', form.Flag, 'enabled', _('تفعيل الخدمة (Enable)'),
			_('تشغيل نفق كلاود فلير للوصول للراوتر عن بعد.'));
		o.rmempty = false;

		o = s.taboption('general', form.ListValue, 'mode', _('وضع التشغيل (Connection Mode)'),
			_('اختر طريقة الربط بنفق كلاود فلير.'));
		o.value('token', _('رمز النفق المباشر (Direct Tunnel Token - موصى به)'));
		o.value('api', _('الربط التلقائي عبر الـ API (Custom Domain & Cloudflare API)'));
		o.default = 'token';

		// Direct Token Field
		o = s.taboption('general', form.Value, 'cf_tunnel_token', _('رمز النفق (Tunnel Token)'),
			_('ألصق رمز النفق (Token) المولد من لوحة تحكم Cloudflare Zero-Trust Tunnels مباشرة.'));
		o.depends('mode', 'token');
		o.password = true;
		o.rmempty = true;

		// API Mode Fields
		o = s.taboption('general', form.Value, 'cf_domain', _('اسم النطاق (Domain Name)'),
			_('اسم الدومين الخاص بك المسجل على Cloudflare (مثال: opsegypt.com).'));
		o.depends('mode', 'api');
		o.placeholder = 'opsegypt.com';

		o = s.taboption('general', form.Value, 'cf_account', _('معرّف الحساب (Account ID)'),
			_('معرّف حسابك في Cloudflare (نجده في صفحة النطاق الرئيسية أسفل اليمين).'));
		o.depends('mode', 'api');

		o = s.taboption('general', form.Value, 'cf_zone', _('معرّف النطاق (Zone ID)'),
			_('معرّف النطاق في Cloudflare.'));
		o.depends('mode', 'api');

		o = s.taboption('general', form.Value, 'cf_token', _('رمز الوصول للـ API (API Token)'),
			_('رمز وصول Cloudflare API يمتلك صلاحية (Zone.DNS:Edit و Account.Cloudflare Tunnel:Edit).'));
		o.depends('mode', 'api');
		o.password = true;

		// --- Log Tab ---
		var logView = s.taboption('log', form.DummyValue, '_logs');
		logView.rawhtml = true;
		logView.cfgvalue = function() {
			return E('pre', {
				'id': 'cloud-live-log',
				'style': 'max-height:300px; overflow-y:auto; background:#1e293b; color:#f8fafc; padding:12px; border-radius:6px; font-family:monospace; font-size:12px; line-height:1.4;'
			}, [ initialLog ? initialLog.split('\n').slice(-30).join('\n') : _('لا توجد سجلات حالياً.') ]);
		};

		// --- Section 3: Forwarded Devices Grid Section ---
		var d = m.section(form.GridSection, 'device', _('توجيه الأجهزة الداخلية (Forwarded Devices)'),
			_('يمكنك إضافة أجهزة الشبكة المحلية (مثل أجهزة DVR، كاميرات المراقبة، المايكروتك) للوصول إليها عبر أسماء فرعية سحابية.'));
		d.addremove = true;
		d.anonymous = true;

		var nameOpt = d.option(form.Value, 'name', _('الاسم الفرعي (Subdomain)'));
		nameOpt.placeholder = 'dvr1';
		nameOpt.rmempty = false;
		nameOpt.datatype = 'hostname';

		var protoOpt = d.option(form.ListValue, 'proto', _('البروتوكول (Protocol)'));
		protoOpt.value('http', 'HTTP (Web)');
		protoOpt.value('https', 'HTTPS');
		protoOpt.value('tcp', 'TCP (Winbox / DVR)');
		protoOpt.value('ssh', 'SSH');
		protoOpt.default = 'http';

		var ipOpt = d.option(form.Value, 'ip', _('العنوان الداخلي والبورت (IP[:Port])'));
		ipOpt.placeholder = '192.168.100.10:8000';
		ipOpt.rmempty = false;

		var linkCol = d.option(form.DummyValue, '_link', _('رابط الدخول المباشر'));
		linkCol.rawhtml = true;
		linkCol.cfgvalue = function(section_id) {
			var name = uci.get('cloud', section_id, 'name');
			var domain = uci.get('cloud', 'main', 'cf_domain') || 'opsegypt.com';
			if (name) {
				var url = 'https://' + name + '.' + domain;
				return E('a', {
					'href': url,
					'target': '_blank',
					'style': 'color:#0066cc; font-weight:700; text-decoration:underline;'
				}, [ url ]);
			}
			return E('span', { 'style': 'color:#9ca3af;' }, [ _('احفظ التغييرات أولاً') ]);
		};

		return m.render();
	}
});
