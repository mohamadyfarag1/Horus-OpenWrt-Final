'use strict';
'require view';
'require form';
'require uci';
'require fs';
'require ui';
'require poll';

/*
 * HAMax - long-range profile for the 5 GHz radio.
 *
 * The engine writes /tmp/hamax.json on every enable/disable/telemetry
 * call; this view only reads it. Capability flags in that file say
 * whether the running hostapd/mac80211 build actually supports airtime
 * fairness and vendor elements, so the UI reports what was applied
 * rather than what was requested.
 */

var S = {
	card:  'border-radius:10px; padding:14px 18px; margin-bottom:12px;',
	mono:  'font-family:monospace;',
	muted: 'color:#6b7280; font-size:12px;'
};

function badge(label, ok, okText, noText) {
	return E('span', {
		'style': 'display:inline-block; font-size:11px; font-weight:700; padding:3px 9px;' +
		         'border-radius:10px; margin:2px 4px 2px 0;' +
		         'background:' + (ok ? '#d1fae5' : '#fee2e2') + ';' +
		         'color:' + (ok ? '#065f46' : '#991b1b') + ';'
	}, [ label + ': ' + (ok ? okText : noText) ]);
}

function readState() {
	return L.resolveDefault(fs.read('/tmp/hamax.json'), '').then(function(raw) {
		try { return JSON.parse(raw); } catch (e) { return {}; }
	});
}

return view.extend({

	load: function() {
		return Promise.all([
			readState(),
			L.resolveDefault(fs.read('/tmp/hamax.log'), ''),
			uci.load('hamax'),
			uci.load('wireless')
		]);
	},

	/* ---------------------------------------------------------------- */

	buildStatusCard: function(st) {
		var enabled = (st.state === 'enabled');
		var caps    = st.caps || {};
		var role    = (st.role === 'client') ? 'محطة استقبال (Station / CPE)' : 'نقطة وصول (Access Point)';
		var profile = (st.profile === 'ptp') ? 'وصلة نقطة لنقطة (PtP)' : 'برج متعدد العملاء (PtMP)';

		var radioLine = st.radio
			? (st.radio + ' · قناة ' + (st.channel || '?') + ' · ' + (st.htmode || '?'))
			: '⚠ لم يتم العثور على راديو 5 جيجا في الإعدادات';

		return E('div', {
			'id': 'hamax-status-card',
			'style': S.card +
			         'background:' + (enabled ? '#ecfdf5' : '#f9fafb') + ';' +
			         'border:2px solid ' + (enabled ? '#10b981' : '#d1d5db') + ';'
		}, [
			E('div', { 'style': 'display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap;' }, [
				E('div', {}, [
					E('div', {
						'style': 'font-size:16px; font-weight:800; color:' + (enabled ? '#047857' : '#4b5563')
					}, [ enabled ? '⚡ ملف HAMax مطبَّق على راديو 5 جيجا' : '⏸ HAMax متوقف — راديو 5 جيجا بإعداداته الأصلية' ]),

					E('div', { 'style': 'font-size:13px; color:#374151; margin-top:6px;' }, [
						'الراديو: ', E('strong', {}, [ radioLine ])
					]),
					E('div', { 'style': 'font-size:13px; color:#374151; margin-top:2px;' }, [
						'الدور: ', E('strong', {}, [ role ]), ' · النمط: ', E('strong', {}, [ profile ])
					]),
					st.since
						? E('div', { 'style': S.muted + ' margin-top:2px;' }, [ 'مفعَّل منذ: ' + st.since ])
						: E('span', {}),

					E('div', { 'style': 'margin-top:10px;' }, [
						badge('عدالة الهواء (hostapd)', !!caps.airtime_hostapd, 'مدعوم', 'غير مدعوم'),
						badge('جدولة الهواء (kernel)', !!caps.airtime_kernel, 'مكتشَف', 'غير مكتشَف'),
						badge('بصمة HAMax IE', !!caps.vendor_ie, 'مدعوم', 'غير مدعوم')
					])
				]),

				E('div', { 'style': 'display:flex; gap:8px; flex-wrap:wrap;' }, [
					E('button', {
						'class': 'btn ' + (enabled ? 'btn-danger' : 'cbi-button-positive'),
						'style': 'padding:8px 18px; font-weight:700;',
						'click': ui.createHandlerFn(this, 'handleToggle', enabled)
					}, [ enabled ? '⏹ إيقاف HAMax' : '▶ تشغيل HAMax' ]),

					E('button', {
						'class': 'btn',
						'click': ui.createHandlerFn(this, 'handleCheck')
					}, [ '🔍 فحص الدعم' ])
				])
			]),

			E('div', {
				'style': 'margin-top:12px; padding:8px 12px; background:#eff6ff; border-right:4px solid #3b82f6;' +
				         'border-radius:4px; font-size:12px; color:#1e3a8a; line-height:1.7;'
			}, [
				E('div', {}, [ '📶 هذا الملف يعدّل راديو 5 جيجا فقط. راديو 2.4 جيجا لا يُقرأ ولا يُعدَّل ولا يُعاد تشغيله إطلاقاً.' ]),
				E('div', {}, [ '↩ عند الإيقاف تُستعاد كل قيمة إلى ما كانت عليه بالضبط قبل التفعيل (نسخة احتياطية في /etc/hamax/backup.uci).' ]),
				E('div', {}, [ '⚠ هذا ليس بروتوكول Ubiquiti AirMax ولا يتفاهم معه. AirMax جدولة TDMA داخل فيرموير مغلق؛ شريحة ath10k لا تملك مجدول شرائح زمنية، فالوصلة تبقى CSMA/CA. الإعدادات هنا تقلّل التزاحم ولا تلغيه.' ])
			])
		]);
	},

	buildLinksTable: function(st) {
		var isClient = (st.role === 'client');
		var links    = st.links || [];

		if (!links.length) {
			return E('div', {
				'style': 'padding:18px; background:#f9fafb; border-radius:8px; color:#9ca3af; text-align:center; font-size:13px;'
			}, [ isClient ? '🔍 لا توجد واجهة محطة نشطة على راديو 5 جيجا' : '📡 لا يوجد عملاء متصلون على راديو 5 جيجا' ]);
		}

		function th(t) { return E('th', { 'style': 'font-size:12px;' }, [ t ]); }

		if (isClient) {
			return E('table', { 'class': 'table', 'style': 'width:100%; font-size:13px;' }, [
				E('thead', {}, [ E('tr', {}, [
					th('الواجهة'), th('البرج (BSSID)'), th('SSID'), th('الإشارة'),
					th('إرسال TX'), th('استقبال RX'), th('التردد')
				]) ]),
				E('tbody', {}, links.map(function(l) {
					if (!l.connected) {
						return E('tr', {}, [
							E('td', {}, [ l.iface ]),
							E('td', { 'colspan': 6, 'style': 'color:#b45309;' }, [ '⏳ غير متصل — جارٍ البحث عن البرج' ])
						]);
					}
					return E('tr', {}, [
						E('td', { 'style': 'font-weight:600;' }, [ l.iface ]),
						E('td', { 'style': S.mono }, [ l.bssid || '—' ]),
						E('td', {}, [ l.ssid || '—' ]),
						E('td', { 'style': 'color:#059669; font-weight:700;' }, [ (l.signal || '—') + ' dBm' ]),
						E('td', {}, [ (l.tx_rate || '—') + ' Mb/s' ]),
						E('td', {}, [ (l.rx_rate || '—') + ' Mb/s' ]),
						E('td', {}, [ (l.freq || '—') + ' MHz' ])
					]);
				}))
			]);
		}

		return E('table', { 'class': 'table', 'style': 'width:100%; font-size:13px;' }, [
			E('thead', {}, [ E('tr', {}, [
				th('MAC'), th('الواجهة'), th('الإشارة'), th('TX'), th('RX'),
				th('إنتاجية متوقعة'), th('محاولات فاشلة'), th('حصة الهواء')
			]) ]),
			E('tbody', {}, links.map(function(s) {
				/* mac80211 airtime weights are relative, 256 is the default
				   weight, so show the raw value and a bar scaled to it. */
				var w   = parseInt(s.weight, 10);
				var pct = isNaN(w) ? 0 : Math.max(0, Math.min(100, Math.round(w / 5.12)));

				return E('tr', {}, [
					E('td', { 'style': S.mono + ' font-weight:700;' }, [ s.mac ]),
					E('td', {}, [ s.iface ]),
					E('td', { 'style': 'color:#059669; font-weight:700;' }, [
						(s.signal || '—') + ' dBm',
						s.signal_avg ? E('span', { 'style': S.muted }, [ ' (متوسط ' + s.signal_avg + ')' ]) : E('span', {})
					]),
					E('td', {}, [ (s.tx_rate || '—') + ' Mb/s' ]),
					E('td', {}, [ (s.rx_rate || '—') + ' Mb/s' ]),
					E('td', {}, [ s.expected || '—' ]),
					E('td', { 'style': (parseInt(s.tx_failed, 10) > 0 ? 'color:#b91c1c; font-weight:700;' : 'color:#6b7280;') }, [
						(s.tx_failed || '0') + ' / ' + (s.tx_retries || '0')
					]),
					E('td', { 'style': 'min-width:120px;' }, [
						isNaN(w)
							? E('span', { 'style': S.muted }, [ 'غير مفعَّل' ])
							: E('div', {}, [
								E('div', { 'style': 'background:#e5e7eb; border-radius:4px; height:7px; overflow:hidden;' }, [
									E('div', { 'style': 'background:#2563eb; height:100%; width:' + pct + '%;' }, [])
								]),
								E('span', { 'style': S.muted }, [ String(w) ])
							])
					])
				]);
			}))
		]);
	},

	/* ---------------------------------------------------------------- */

	handleToggle: function(enabled) {
		var self = this;

		return ui.showModal(enabled ? _('إيقاف HAMax') : _('تشغيل HAMax'), [
			E('p', {}, [
				enabled
					? _('سيتم إرجاع كل إعدادات راديو 5 جيجا إلى قيمها الأصلية.')
					: _('سيتم تطبيق ملف HAMax على راديو 5 جيجا فقط.')
			]),
			E('p', { 'style': 'color:#b45309; font-weight:600;' }, [
				_('⚠ سيُعاد تشغيل راديو 5 جيجا، وستنقطع الوصلات عليه لبضع ثوانٍ. راديو 2.4 جيجا لن يتأثر — إن كنت متصلاً عبر 5 جيجا فستفقد الاتصال مؤقتاً.')
			]),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn', 'click': ui.hideModal }, [ _('إلغاء') ]),
				' ',
				E('button', {
					'class': 'btn cbi-button-positive',
					'click': ui.createHandlerFn(self, function() {
						uci.set('hamax', 'settings', 'enabled', enabled ? '0' : '1');
						return uci.save()
							.then(function() { return uci.apply(); })
							.then(function() { return fs.exec('/usr/bin/hamax', [ enabled ? 'disable' : 'enable' ]); })
							.then(function(res) {
								ui.hideModal();
								ui.addNotification(null, E('p', [
									enabled ? _('تم إيقاف HAMax واستعادة إعدادات راديو 5 جيجا.')
									        : _('تم تطبيق ملف HAMax على راديو 5 جيجا.')
								]));
								if (res && res.code !== 0)
									ui.addNotification(null, E('pre', [ res.stderr || res.stdout || '' ]), 'warning');
							})
							.catch(function(err) {
								ui.hideModal();
								ui.addNotification(null, E('p', [ _('فشلت العملية: ') + err ]), 'error');
							});
					})
				}, [ _('تأكيد') ])
			])
		]);
	},

	handleCheck: function() {
		return fs.exec('/usr/bin/hamax', [ 'check' ]).then(function(res) {
			ui.showModal(_('تقرير دعم HAMax'), [
				E('pre', {
					'style': 'max-height:60vh; overflow:auto; background:#111827; color:#f3f4f6;' +
					         'padding:12px; border-radius:8px; font-size:12px; direction:ltr; text-align:left;'
				}, [ res.stdout || res.stderr || _('لا توجد مخرجات') ]),
				E('div', { 'class': 'right' }, [
					E('button', { 'class': 'btn', 'click': ui.hideModal }, [ _('إغلاق') ])
				])
			]);
		});
	},

	/* Persist the form, then let the engine re-apply it to the radio. */
	handleSaveApply: function(ev, mode) {
		return this.super('handleSaveApply', [ ev, mode ]).then(function() {
			return fs.exec('/usr/bin/hamax', [ 'apply' ]);
		}).then(function() {
			ui.addNotification(null, E('p', [ _('تم حفظ الإعدادات وإعادة تطبيقها على راديو 5 جيجا.') ]));
		});
	},

	/* ---------------------------------------------------------------- */

	render: function(data) {
		var st   = data[0] || {};
		var log0 = (data[1] || '').trim();
		var self = this;
		var m, s, o;

		m = new form.Map('hamax',
			_('ملف HAMax للوصلات بعيدة المدى — راديو 5 جيجا'),
			_('يضبط راديو 5 جيجا لوصلة نقطة-لنقطة أو برج متعدد العملاء باستخدام خصائص mac80211 / ath10k / hostapd الحقيقية: مسافة الوصلة، RTS، جسر WDS الشفاف، معدل البث المتعدد، عدالة توزيع الهواء، وبصمة HAMax في البيكون. راديو 2.4 جيجا يبقى كما هو.')
		);

		/* --- live dashboard ------------------------------------------ */
		s = m.section(form.NamedSection, 'settings', 'hamax');
		s.anonymous = true;

		o = s.option(form.DummyValue, '_dash');
		o.rawhtml = true;
		o.cfgvalue = function() {
			return E('div', { 'id': 'hamax-dash' }, [
				self.buildStatusCard(st),
				E('div', { 'style': 'background:#fff; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden;' }, [
					E('div', {
						'style': 'padding:10px 16px; background:#f9fafb; border-bottom:1px solid #e5e7eb;' +
						         'display:flex; justify-content:space-between; align-items:center;'
					}, [
						E('strong', { 'style': 'font-size:14px;' }, [
							st.role === 'client' ? '📡 حالة الوصلة بالبرج' : '📊 العملاء المتصلون على 5 جيجا'
						]),
						E('span', {
							'id': 'hamax-count',
							'style': 'font-size:12px; background:#e0e7ff; color:#3730a3; padding:2px 10px; border-radius:12px; font-weight:700;'
						}, [ String((st.links || []).length) ])
					]),
					E('div', { 'id': 'hamax-links', 'style': 'padding:12px;' }, [ self.buildLinksTable(st) ])
				])
			]);
		};

		/* --- settings ------------------------------------------------- */
		s = m.section(form.NamedSection, 'settings', 'hamax', _('إعدادات الملف'));
		s.anonymous = true;
		s.addremove = false;

		s.tab('general',  _('أساسي'));
		s.tab('link',     _('ضبط الوصلة (RF / Link)'));
		s.tab('airtime',  _('توزيع الهواء والبصمة'));
		s.tab('log',      _('السجل'));

		/* general */
		o = s.taboption('general', form.Flag, 'enabled', _('تفعيل HAMax عند الإقلاع'),
			_('يطبّق الملف تلقائياً على راديو 5 جيجا بعد كل إعادة تشغيل.'));
		o.rmempty = false;

		o = s.taboption('general', form.ListValue, 'profile', _('نمط الوصلة'),
			_('PtMP يفعّل RTS/CTS وعدالة توزيع الهواء لأن العملاء يتزاحمون ولا يسمع بعضهم بعضاً. PtP يعطّلهما لأن الطرف الآخر واحد فقط، فيرتفع الأداء ويقلّ التأخير.'));
		o.value('ptmp', _('برج متعدد العملاء (PtMP) — موصى به'));
		o.value('ptp',  _('وصلة نقطة لنقطة (PtP)'));
		o.default = 'ptmp';

		o = s.taboption('general', form.ListValue, 'mode', _('الدور'),
			_('"تلقائي" يقرأ الدور من إعداد واجهة 5 جيجا نفسها. HAMax يضبط الجهاز ولا يغيّر دوره.'));
		o.value('auto',   _('تلقائي (من إعدادات الواجهة)'));
		o.value('ap',     _('نقطة وصول (AP)'));
		o.value('client', _('محطة استقبال (Station / CPE)'));
		o.default = 'auto';

		o = s.taboption('general', form.Flag, 'wds', _('جسر WDS شفاف (4-Address)'),
			_('تمرير إطارات الإيثرنت بشفافية على المستوى الثاني عبر الوصلة اللاسلكية — المكافئ المفتوح لما تفعله أجهزة Ubiquiti و MikroTik.'));
		o.default = '1';
		o.rmempty = false;

		/* link */
		o = s.taboption('link', form.Value, 'distance', _('طول الوصلة (متر)'),
			_('أهم إعداد في الوصلات بعيدة المدى: يضبط مهلة انتظار ACK وزمن الشريحة (slot time) حسب زمن انتشار الموجة. قيمة أقل من المسافة الحقيقية تُسقط الإطارات؛ قيمة مبالغ فيها تهدر الهواء.'));
		o.datatype = 'range(0, 50000)';
		o.default = '5000';

		o = s.taboption('link', form.Value, 'rts', _('عتبة RTS/CTS (بايت)'),
			_('يعالج مشكلة العقدة المخفية في الأبراج متعددة العملاء (العميل A لا يسمع العميل B فيتصادمان). 0 = معطّل. يُفرض 0 تلقائياً في نمط PtP.'));
		o.datatype = 'range(0, 2347)';
		o.default = '512';
		o.depends('profile', 'ptmp');

		o = s.taboption('link', form.Value, 'mcast_rate', _('معدل البث المتعدد (kbps)'),
			_('يرفع البث المتعدد والعام عن أرضية 6 ميجابت. على برج فيه عدة عملاء هذه الإطارات تلتهم الهواء لأنها تُرسل بأبطأ معدل. 24000 = 24 ميجابت.'));
		o.datatype = 'uinteger';
		o.default = '24000';

		o = s.taboption('link', form.Value, 'beacon_int', _('الفاصل بين البيكونات (ms)'),
			_('100 هي القيمة القياسية وهي المناسبة لوصلة ثابتة. تقليلها يزيد عبء الإدارة على الهواء دون فائدة حقيقية للبيانات.'));
		o.datatype = 'range(15, 65535)';
		o.default = '100';

		o = s.taboption('link', form.Value, 'dtim_period', _('فترة DTIM'),
			_('1 = أقل تأخير، وهو المناسب لأجهزة CPE ثابتة لا تحتاج توفير طاقة.'));
		o.datatype = 'range(1, 255)';
		o.default = '1';

		o = s.taboption('link', form.Value, 'txpower', _('قدرة الإرسال (dBm)'),
			_('اتركه فارغاً للإبقاء على قدرة الراديو الحالية. القيمة النهائية تبقى محكومة بجدول التنظيم (regdb) للدولة المختارة.'));
		o.datatype = 'range(0, 30)';
		o.rmempty = true;

		o = s.taboption('link', form.Flag, 'short_gi', _('الفاصل الوقائي القصير (Short GI)'),
			_('يرفع الإنتاجية ~11%. قد يكون غير مستقر على الوصلات الطويلة جداً ذات الانعكاسات الكثيرة.'));
		o.default = '1';

		o = s.taboption('link', form.Flag, 'noscan', _('منع تخفيض عرض القناة (noscan)'),
			_('يمنع آلية التعايش 20/40 من تضييق القناة عند رصد شبكات مجاورة، فتبقى VHT80 كما اخترتها.'));
		o.default = '1';

		o = s.taboption('link', form.Flag, 'disable_legacy_rates', _('معدلات OFDM فقط'),
			_('يلغي المعدلات القديمة ويثبّت مجموعة معدلات أساسية عالية، فلا ينزلق الراديو إلى معدلات بطيئة تهدر الهواء.'));
		o.default = '1';

		/* airtime */
		o = s.taboption('airtime', form.Flag, 'airtime', _('عدالة توزيع الهواء (Airtime Fairness)'),
			_('أقرب مكافئ متاح لفكرة AirMax: يمنع العميل البطيء البعيد من ابتلاع وقت الهواء وخنق بقية العملاء. يحتاج hostapd الكامل — راجع "فحص الدعم" أعلاه. يُعطَّل تلقائياً في نمط PtP.'));
		o.default = '1';
		o.depends('profile', 'ptmp');

		o = s.taboption('airtime', form.ListValue, 'airtime_mode', _('آلية التوزيع'));
		o.value('1', _('1 — أوزان ثابتة (Static)'));
		o.value('2', _('2 — أوزان ديناميكية (Dynamic) — موصى به'));
		o.value('3', _('3 — حدود قصوى لكل عميل (Limit)'));
		o.default = '2';
		o.depends({ profile: 'ptmp', airtime: '1' });

		o = s.taboption('airtime', form.Value, 'airtime_update_interval', _('فترة إعادة الحساب (ms)'));
		o.datatype = 'range(50, 5000)';
		o.default = '200';
		o.depends({ profile: 'ptmp', airtime: '1' });

		o = s.taboption('airtime', form.Flag, 'vendor_ie', _('بث بصمة HAMax في البيكون'),
			_('عنصر Vendor IE قياسي (OUI 00:07:89) يعرّف الجهاز كعضو في شبكة HAMax. هو تعريف فقط ولا يغيّر طريقة الإرسال ولا ينشئ بروتوكولاً.'));
		o.default = '1';

		/* log */
		o = s.taboption('log', form.DummyValue, '_log');
		o.rawhtml = true;
		o.cfgvalue = function() {
			return E('div', {}, [
				E('div', { 'style': 'display:flex; justify-content:space-between; margin-bottom:8px;' }, [
					E('strong', {}, [ _('سجل أحداث HAMax') ]),
					E('button', {
						'class': 'btn btn-sm',
						'click': ui.createHandlerFn(self, function() {
							return fs.exec('/usr/bin/hamax', [ 'log-clear' ]).then(function() {
								var el = document.getElementById('hamax-log');
								if (el) el.textContent = _('تم تفريغ السجل.');
							});
						})
					}, [ '🗑 ' + _('مسح السجل') ])
				]),
				E('pre', {
					'id': 'hamax-log',
					'style': 'max-height:320px; overflow:auto; background:#111827; color:#f3f4f6;' +
					         'padding:12px; border-radius:8px; font-size:12px; line-height:1.5;' +
					         'direction:ltr; text-align:left;'
				}, [ log0 || _('لا توجد أحداث بعد.') ])
			]);
		};

		/* --- live refresh -------------------------------------------- */
		poll.add(function() {
			return fs.exec('/usr/bin/hamax', [ 'telemetry' ]).then(function() {
				return Promise.all([ readState(), L.resolveDefault(fs.read('/tmp/hamax.log'), '') ]);
			}).then(function(res) {
				var cur = res[0] || {};
				var lg  = (res[1] || '').trim();

				var card = document.getElementById('hamax-status-card');
				if (card) card.parentNode.replaceChild(self.buildStatusCard(cur), card);

				var count = document.getElementById('hamax-count');
				if (count) count.textContent = String((cur.links || []).length);

				var box = document.getElementById('hamax-links');
				if (box) {
					while (box.firstChild) box.removeChild(box.firstChild);
					box.appendChild(self.buildLinksTable(cur));
				}

				var logEl = document.getElementById('hamax-log');
				if (logEl && lg) logEl.textContent = lg.split('\n').slice(-60).join('\n');
			});
		}, 5);

		return m.render();
	}
});
