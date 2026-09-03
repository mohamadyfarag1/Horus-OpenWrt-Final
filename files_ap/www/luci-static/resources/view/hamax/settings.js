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
			L.resolveDefault(fs.read('/tmp/hamax.state'), ''),
			L.resolveDefault(fs.read('/tmp/hamax.stations'), ''),
			L.resolveDefault(fs.read('/tmp/hamax.log'), ''),
			uci.load('hamax'),
			uci.load('wireless')
		]);
	},

	parseState: function(raw) {
		var lines = (raw || '').trim().split('\n');
		return {
			status: (lines[0] || 'disabled').trim(),
			mode:   (lines[1] || 'ap').trim(),
			since:  (lines[2] || '').trim()
		};
	},

	parseTelemetry: function(raw) {
		var type = 'ap';
		var items = [];
		if (!raw) return { type: type, items: items };

		var lines = raw.split('\n');
		lines.forEach(function(line) {
			line = line.trim();
			if (!line) return;
			if (line.indexOf('# TYPE=CLIENT') !== -1) {
				type = 'client';
				return;
			}
			if (line.indexOf('# TYPE=AP') !== -1) {
				type = 'ap';
				return;
			}
			if (line.startsWith('#')) return;

			var parts = line.split('|');
			if (type === 'ap' && parts.length >= 5) {
				items.push({
					iface:  (parts[0] || '').trim(),
					mac:    (parts[1] || '').trim(),
					signal: (parts[2] || '').trim(),
					tx:     (parts[3] || '').trim(),
					rx:     (parts[4] || '').trim(),
					weight: (parts[5] || '').trim()
				});
			} else if (type === 'client' && parts.length >= 4) {
				items.push({
					iface:   (parts[0] || '').trim(),
					bssid:   (parts[1] || '').trim(),
					signal:  (parts[2] || '').trim(),
					bitrate: (parts[3] || '').trim(),
					freq:    (parts[4] || '').trim()
				});
			}
		});

		return { type: type, items: items };
	},

	buildStatusCard: function(stateObj) {
		var isEnabled = (stateObj.status === 'enabled');
		var color     = isEnabled ? '#047857' : '#4b5563';
		var bg        = isEnabled ? '#ecfdf5' : '#f9fafb';
		var border    = isEnabled ? '#10b981' : '#d1d5db';
		var icon      = isEnabled ? '⚡' : '⏸';
		var labelText = isEnabled ? 'بروتوكول HAMax مفعل ونشط' : 'بروتوكول HAMax متوقف (وضع 802.11 القياسي)';
		var modeText  = (stateObj.mode === 'client') ? 'وضع المحطة (Client WDS)' : 'وضع نقطة الوصول (AP WDS)';

		return E('div', {
			'id': 'hamax-status-card',
			'style': [
				'background:' + bg,
				'border:2px solid ' + border,
				'border-radius:12px',
				'padding:16px 20px',
				'display:flex',
				'align-items:center',
				'justify-content:space-between',
				'gap:16px',
				'flex-wrap:wrap',
				'margin-bottom:12px'
			].join(';')
		}, [
			E('div', { 'style': 'display:flex; align-items:center; gap:16px;' }, [
				E('div', {
					'style': 'font-size:28px; width:48px; height:48px; border-radius:50%; background:' + (isEnabled ? '#d1fae5' : '#e5e7eb') + '; display:flex; align-items:center; justify-content:center;'
				}, [ icon ]),
				E('div', {}, [
					E('div', { 'style': 'font-size:16px; font-weight:800; color:' + color }, [ labelText ]),
					E('div', { 'style': 'font-size:13px; color:#6b7280; margin-top:2px;' }, [
						_('وضع التشغيل: ') + '<strong>' + modeText + '</strong>'
						+ (stateObj.since ? (' · تاريخ التفعيل: ' + stateObj.since) : '')
					])
				])
			]),
			E('div', { 'style': 'display:flex; gap:10px; align-items:center;' }, [
				E('button', {
					'id': 'hamax-toggle-btn',
					'class': 'btn ' + (isEnabled ? 'btn-danger' : 'btn-primary'),
					'style': 'padding:8px 20px; font-size:14px; font-weight:700; border-radius:8px;',
					'click': function(ev) {
						ev.preventDefault();
						var btn = ev.target;
						btn.disabled = true;
						btn.textContent = '⏳ جاري المعالجة...';

						var nextVal = isEnabled ? '0' : '1';
						var nextCmd = isEnabled ? 'disable' : 'enable';

						uci.load('hamax').then(function() {
							uci.set('hamax', 'settings', 'enabled', nextVal);
							return uci.save();
						}).then(function() {
							return fs.exec('/usr/bin/hamax', [ nextCmd ]);
						}).then(function() {
							ui.addNotification(null, E('p', isEnabled
								? _('تم إيقاف بروتوكول HAMax والعودة للوضع القياسي بنجاح!')
								: _('تم تفعيل بروتوكول HAMax بنجاح!')
							));
						}).catch(function(err) {
							ui.addNotification(null, E('p', 'خطأ: ' + err));
						}).finally(function() {
							btn.disabled = false;
						});
					}
				}, [ isEnabled ? '⏹ إيقاف البروتوكول' : '▶ تشغيل البروتوكول' ]),

				E('button', {
					'class': 'btn',
					'style': 'padding:8px 14px; font-size:13px;',
					'click': function(ev) {
						ev.preventDefault();
						fs.exec('/usr/bin/hamax', [ 'apply' ]).then(function() {
							ui.addNotification(null, E('p', _('تمت إعادة تطبيق إعدادات HAMax')));
						});
					}
				}, [ '🔄 تحديث الإعدادات' ])
			])
		]);
	},

	buildTelemetryTable: function(telemetry) {
		var isClient = (telemetry.type === 'client');
		var items = telemetry.items || [];

		if (!items.length) {
			return E('div', {
				'style': 'padding:16px; background:#f9fafb; border-radius:8px; color:#9ca3af; text-align:center; font-size:13px;'
			}, [ isClient ? '🔍 جاري البحث عن برج أو نقطة وصول HAMax AP...' : '📡 لا يوجد أجهزة عملاء متصلة بالشبكة حالياً' ]);
		}

		if (isClient) {
			return E('table', { 'class': 'table', 'style': 'width:100%; font-size:13px;' }, [
				E('thead', {}, [
					E('tr', { 'style': 'background:#f3f4f6;' }, [
						E('th', {}, [ 'كرت الشبكة (Interface)' ]),
						E('th', {}, [ 'ماك البرج المتصل به (AP BSSID)' ]),
						E('th', {}, [ 'قوة الإشارة (Signal)' ]),
						E('th', {}, [ 'معدل النقل (Bitrate)' ]),
						E('th', {}, [ 'التردد (Frequency)' ])
					])
				]),
				E('tbody', {}, items.map(function(it) {
					return E('tr', {}, [
						E('td', { 'style': 'font-weight:600;' }, [ it.iface ]),
						E('td', { 'style': 'font-family:monospace;' }, [ it.bssid ]),
						E('td', { 'style': 'color:#059669; font-weight:700;' }, [ it.signal ]),
						E('td', {}, [ it.bitrate ]),
						E('td', {}, [ it.freq ])
					]);
				}))
			]);
		}

		// AP Mode Table
		return E('table', { 'class': 'table', 'style': 'width:100%; font-size:13px;' }, [
			E('thead', {}, [
				E('tr', { 'style': 'background:#f3f4f6;' }, [
					E('th', {}, [ 'الماك أدرس (MAC Address)' ]),
					E('th', {}, [ 'المنفذ (Interface)' ]),
					E('th', {}, [ 'قوة الإشارة (Signal)' ]),
					E('th', {}, [ 'إرسال (TX)' ]),
					E('th', {}, [ 'استقبال (RX)' ]),
					E('th', {}, [ 'حصة البث (Airtime Weight)' ])
				])
			]),
			E('tbody', {}, items.map(function(s) {
				var weightNum = parseInt(s.weight.replace('weight:', '')) || 0;
				var pct = Math.min(100, Math.round(weightNum / 2.56));
				return E('tr', {}, [
					E('td', { 'style': 'font-family:monospace; font-weight:700;' }, [ s.mac ]),
					E('td', {}, [ s.iface ]),
					E('td', { 'style': 'color:#059669; font-weight:700;' }, [ s.signal ]),
					E('td', { 'style': 'color:#6b7280;' }, [ s.tx ]),
					E('td', { 'style': 'color:#6b7280;' }, [ s.rx ]),
					E('td', { 'style': 'min-width:140px;' }, [
						E('div', { 'style': 'background:#e5e7eb; border-radius:4px; height:8px; overflow:hidden; margin-bottom:4px;' }, [
							E('div', { 'style': 'background:#2563eb; height:100%; width:' + pct + '%; border-radius:4px;' }, [])
						]),
						E('span', { 'style': 'font-size:11px; color:#4b5563;' }, [ s.weight ])
					])
				]);
			}))
		]);
	},

	render: function(data) {
		var initialState = this.parseState(data[0]);
		var initialTelem = this.parseTelemetry(data[1]);
		var initialLog   = (data[2] || '').trim();

		var self = this;
		var m, s, o;

		m = new form.Map('hamax',
			_('🚀 بروتوكول Horus AirMax (HAMax)'),
			_('بروتوكول البث اللاسلكي المتقدم المتوافق مع تقنية Ubiquiti AirMax AC لنقاط الوصول ومحطات الاستقبال (AP WDS / Client WDS) مع جدولة TDMA وحصص الهواء المتزامنة.')
		);

		// Section 1: Live Status Header
		s = m.section(form.NamedSection, 'settings', 'hamax', _('لوحة المراقبة والتحكم المباشر'));
		s.anonymous = true;

		var statusWidget = s.option(form.DummyValue, '_status_box');
		statusWidget.rawhtml = true;
		statusWidget.cfgvalue = function() {
			return E('div', {}, [
				self.buildStatusCard(initialState),
				E('div', {
					'style': 'background:#fff; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden; margin-top:10px;'
				}, [
					E('div', {
						'style': 'padding:10px 16px; background:#f9fafb; border-bottom:1px solid #e5e7eb; display:flex; justify-content:space-between; align-items:center;'
					}, [
						E('strong', { 'style': 'font-size:14px;' }, [
							initialTelem.type === 'client' ? '📡 بيانات الاتصال بالبرج (Link Telemetry)' : '📊 الأجهزة المتصلة وحصص الـ Airtime'
						]),
						E('span', {
							'id': 'hamax-count-badge',
							'style': 'font-size:12px; background:#e0e7ff; color:#3730a3; padding:2px 10px; border-radius:12px; font-weight:700;'
						}, [ initialTelem.items.length + (initialTelem.type === 'client' ? ' رابط' : ' عميل') ])
					]),
					E('div', { 'id': 'hamax-telemetry-container', 'style': 'padding:12px;' }, [
						self.buildTelemetryTable(initialTelem)
					])
				])
			]);
		};

		// Section 2: Configuration Tabs
		s = m.section(form.NamedSection, 'settings', 'hamax', _('إعدادات وخصائص البروتوكول'));
		s.anonymous = true;
		s.addremove = false;

		s.tab('general', _('الإعدادات الأساسية (Basic Settings)'));
		s.tab('advanced', _('الضبط المتقدم (TDMA / ATF Settings)'));
		s.tab('log', _('سجل الأحداث (Logs)'));

		// --- General Tab ---
		o = s.taboption('general', form.Flag, 'enabled', _('تفعيل البروتوكول (Enable HAMax)'),
			_('تشغيل بروتوكول HAMax تلقائياً عند إقلاع الراوتر.'));
		o.rmempty = false;

		o = s.taboption('general', form.ListValue, 'mode', _('وضع التشغيل (Operation Mode)'),
			_('اختر دور الجهاز في شبكة HAMax: نقطة وصول رئيسية ترسل الإشارة وتجدول الوقت، أو محطة عميل تستقبل الإشارة.'));
		o.value('ap', _('📡 نقطة وصول رئيسية (Access Point - AP WDS)'));
		o.value('client', _('📶 محطة استقبال / عميل (Station - Client WDS)'));
		o.default = 'ap';

		o = s.taboption('general', form.Flag, 'wds', _('تفعيل WDS (4-Address Frames)'),
			_('تمرير حزم الإيثرنت بشفافية تامة Layer 2 عبر الرابط اللاسلكي كما في أجهزة Ubiquiti و Mikrotik.'));
		o.default = '1';
		o.rmempty = false;

		// --- Advanced Tab ---
		o = s.taboption('advanced', form.Value, 'beacon_int', _('الفاصل الزمني للبيكون (Beacon Interval ms)'),
			_('الفاصل الزمني بين نبضات التزامن (الافتراضي في الواي فاي العادي 100ms، في HAMax موصى به 50ms لسرعة الاستجابة وتقليل التأخير).'));
		o.datatype = 'range(20, 100)';
		o.placeholder = '50';
		o.default = '50';

		o = s.taboption('advanced', form.Value, 'dtim_period', _('فترة DTIM (DTIM Period)'),
			_('عدد نبضات البيكون قبل تنبيه الأجهزة المجدولة (1 للحصول على أقل زمن تأخير).'));
		o.datatype = 'range(1, 5)';
		o.placeholder = '1';
		o.default = '1';

		o = s.taboption('advanced', form.ListValue, 'airtime_mode', _('وضع جدولة الهواء (ATF TDMA Mode)'),
			_('آلية الجدولة الزمنية لمنع تصادم الحزم (Collision Avoidance). الوضع 2 الديناميكي هو المكافئ لجدولة AirMax.'));
		o.value('0', _('0 - معطل (الواي فاي التقليدي)'));
		o.value('1', _('1 - أوزان ثابتة (Static ATF)'));
		o.value('2', _('2 - جدولة ذكية ديناميكية (Dynamic TDMA Scheduling - موصى به)'));
		o.default = '2';

		o = s.taboption('advanced', form.Value, 'airtime_update_interval', _('فترة تحديث الجدولة (Update Interval ms)'),
			_('السرعة التي يقوم بها المجدول بإعادة حساب حصص البث (200ms للحفاظ على ثبات البث).'));
		o.datatype = 'range(50, 1000)';
		o.placeholder = '200';
		o.default = '200';

		o = s.taboption('advanced', form.Flag, 'short_gi', _('الفاصل الزمني القصير (Short Guard Interval)'),
			_('زيادة معدل نقل البيانات بتقليص الفاصل الزمني بين الرموز اللاسلكية.'));
		o.default = '1';

		o = s.taboption('advanced', form.Flag, 'ampdu', _('تجميع الفريمات (A-MPDU Aggregation)'),
			_('تجميع حزم البيانات الكبيرة في إرسال واحد لزيادة الإنتاجية وتقليل الهدر الزمني.'));
		o.default = '1';

		// --- Log Tab ---
		var logOpt = s.taboption('log', form.DummyValue, '_log_view');
		logOpt.rawhtml = true;
		logOpt.cfgvalue = function() {
			return E('div', {}, [
				E('div', { 'style': 'display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;' }, [
					E('strong', {}, [ 'سجل أحداث تشغيل HAMax:' ]),
					E('button', {
						'class': 'btn btn-sm',
						'click': function(ev) {
							ev.preventDefault();
							fs.exec('/bin/sh', ['-c', '> /tmp/hamax.log']).then(function() {
								var el = document.getElementById('hamax-log-pre');
								if (el) el.textContent = 'تم تفريغ السجل.';
							});
						}
					}, [ '🗑 مسح السجل' ])
				]),
				E('pre', {
					'id': 'hamax-log-pre',
					'style': 'max-height:300px; overflow-y:auto; background:#111827; color:#f3f4f6; padding:12px; border-radius:8px; font-family:monospace; font-size:12px; line-height:1.4;'
				}, [ initialLog || _('لا توجد أحداث مسجلة بعد.') ])
			]);
		};

		// Polling loop for live telemetry updates every 3 seconds
		poll.add(function() {
			return Promise.all([
				L.resolveDefault(fs.read('/tmp/hamax.state'), ''),
				L.resolveDefault(fs.read('/tmp/hamax.stations'), ''),
				L.resolveDefault(fs.read('/tmp/hamax.log'), '')
			]).then(function(res) {
				var st = self.parseState(res[0]);
				var tm = self.parseTelemetry(res[1]);
				var lg = (res[2] || '').trim();

				var card = document.getElementById('hamax-status-card');
				if (card) {
					var newCard = self.buildStatusCard(st);
					card.parentNode.replaceChild(newCard, card);
				}

				var badge = document.getElementById('hamax-count-badge');
				if (badge) {
					badge.textContent = tm.items.length + (tm.type === 'client' ? ' رابط' : ' عميل');
				}

				var container = document.getElementById('hamax-telemetry-container');
				if (container) {
					while (container.firstChild) container.removeChild(container.firstChild);
					container.appendChild(self.buildTelemetryTable(tm));
				}

				var logEl = document.getElementById('hamax-log-pre');
				if (logEl && lg) {
					logEl.textContent = lg.split('\n').slice(-40).join('\n');
					logEl.scrollTop = logEl.scrollHeight;
				}
			});
		}, 3);

		return m.render();
	}
});
