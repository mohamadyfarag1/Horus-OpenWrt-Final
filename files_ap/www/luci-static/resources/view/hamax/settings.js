'use strict';
'require view';
'require form';
'require uci';
'require fs';
'require ui';
'require poll';

/*
 * HAMax - High-Performance Wireless Bridge Profile for 5 GHz Radio.
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

/*
 * Link quality, computed from live telemetry.
 */
function linkQuality(sta, survey) {
    var q = { snr: null, retry: null, score: null };

    var sig   = parseInt(sta.signal, 10);
    var noise = survey ? parseInt(survey.noise, 10) : NaN;
    if (!isNaN(sig) && !isNaN(noise)) q.snr = sig - noise;

    var r = parseInt(sta.tx_retries, 10);
    var p = parseInt(sta.tx_packets, 10);
    if (!isNaN(r) && !isNaN(p) && (r + p) > 0) q.retry = (100 * r) / (r + p);

    if (q.snr !== null) {
        var s = Math.max(0, Math.min(100, ((q.snr - 10) / 25) * 100));
        if (q.retry !== null) s = s * (1 - Math.min(0.5, q.retry / 40));
        q.score = Math.round(s);
    }
    return q;
}

function qualityColor(score) {
    if (score === null)  return '#9ca3af';
    if (score >= 75)     return '#059669';
    if (score >= 50)     return '#d97706';
    return '#dc2626';
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
			uci.load('wireless'),
			L.resolveDefault(fs.exec('/usr/bin/hamax', [ 'channels' ]), {}).then(function(r) {
				try { return JSON.parse(r.stdout || '{}').channels || []; }
				catch (e) { return []; }
			})
		]);
	},

	/* ---------------------------------------------------------------- */

	buildStatusCard: function(st) {
		var enabled = (st.state === 'enabled');
		var caps    = st.caps || {};
		var role    = (st.role === 'client') ? 'محطة استقبال (Station / CPE)' : 'نقطة وصول (Access Point)';
		var profile = (st.profile === 'ptp') ? 'وصلة نقطة لنقطة (PtP)' : 'برج متعدد المحطات (PtMP)';

		var radioLine = st.radio
			? (st.radio + ' · قناة ' + (st.channel || '?') +
			   (st.freq ? ' (' + st.freq + ' MHz)' : '') + ' · ' + (st.htmode || '?'))
			: '⚠ لم يتم العثور على راديو 5 جيجا في الإعدادات';

		var visBadge = st.radio
			? E('span', {
				'style': 'display:inline-block; font-size:11px; font-weight:700; padding:3px 9px;' +
				         'border-radius:10px; margin-inline-start:8px;' +
				         'background:' + (st.offgrid ? '#ede9fe' : '#fef3c7') + ';' +
				         'color:' + (st.offgrid ? '#5b21b6' : '#92400e') + ';'
			  }, [ st.offgrid ? '🛡 تردد مخصص محمي (Off-Grid)'
			                  : '📡 تردد قياسي عام' ])
			: E('span', {});

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
					}, [ enabled ? '⚡ بروتوكول HAMax مفعّل على راديو 5 جيجا' : '⏸ بروتوكول HAMax متوقف — راديو 5 جيجا بالوضع القياسي' ]),

					E('div', { 'style': 'font-size:13px; color:#374151; margin-top:6px;' }, [
						'الراديو: ', E('strong', {}, [ radioLine ]), visBadge
					]),
					E('div', { 'style': 'font-size:13px; color:#374151; margin-top:2px;' }, [
						'الدور: ', E('strong', {}, [ role ]), ' · النمط: ', E('strong', {}, [ profile ])
					]),
					st.since
						? E('div', { 'style': S.muted + ' margin-top:2px;' }, [ 'مفعَّل منذ: ' + st.since ])
						: E('span', {}),

					E('div', { 'style': 'margin-top:10px;' }, [
						badge('العزل البروتوكولي', !!st.isolation, 'مفعّل 🛡', 'معطل'),
						badge('عدالة توزيع الهواء', !!caps.airtime_hostapd, 'نشط ⚡', 'معطّل'),
						badge('جدولة الحزم', !!caps.airtime_kernel, 'نشط', 'معطّل'),
						badge('تحويل البث المتعدد', !!caps.mcast_to_ucast, 'مفعّل', 'معطّل'),
						badge('مسرّع الذاكرة', !!caps.buffer_tuning, 'مفعّل (4MB)', 'معطّل'),
						badge('درايفر CT المتقدم', !!caps.ath10k_ct, 'نشط', 'قياسي')
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
						'click': ui.createHandlerFn(this, 'handleVerify')
					}, [ '📊 فحص الحالة الحية' ]),

					E('button', {
						'class': 'btn',
						'click': ui.createHandlerFn(this, 'handleCheck')
					}, [ '🔍 تقرير التوافق' ])
				])
			]),

			E('div', {
				'style': 'margin-top:14px; display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:10px; font-size:12px;'
			}, [
				E('div', { 'style': 'background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:8px 12px; display:flex; align-items:center; gap:8px;' }, [
					E('span', { 'style': 'font-size:18px;' }, [ '📶' ]),
					E('div', {}, [
						E('strong', { 'style': 'color:#1e293b; display:block;' }, [ 'راديو 5 جيجاهرتز حصري' ]),
						E('span', { 'style': 'color:#64748b;' }, [ 'مخصص للربط الخارجي بعيد المدى (راديو 2.4G حر للشبكة المحلية)' ])
					])
				]),
				E('div', { 'style': 'background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:8px 12px; display:flex; align-items:center; gap:8px;' }, [
					E('span', { 'style': 'font-size:18px;' }, [ '🛡' ]),
					E('div', {}, [
						E('strong', { 'style': 'color:#1e293b; display:block;' }, [ 'عزل وحماية بروتوكولية' ]),
						E('span', { 'style': 'color:#64748b;' }, [ 'بث مشفر يمنع الأجهزة العادية من كشف أو اعتراض الإشارة' ])
					])
				]),
				E('div', { 'style': 'background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:8px 12px; display:flex; align-items:center; gap:8px;' }, [
					E('span', { 'style': 'font-size:18px;' }, [ '🔗' ]),
					E('div', {}, [
						E('strong', { 'style': 'color:#1e293b; display:block;' }, [ 'ربط WDS شفاف (Layer-2)' ]),
						E('span', { 'style': 'color:#64748b;' }, [ 'تمرير كامل لحزم الإيثرنت وعناوين MAC بين أجهزة Horus' ])
					])
				]),
				E('div', { 'style': 'background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:8px 12px; display:flex; align-items:center; gap:8px;' }, [
					E('span', { 'style': 'font-size:18px;' }, [ '↩' ]),
					E('div', {}, [
						E('strong', { 'style': 'color:#1e293b; display:block;' }, [ 'استرجاع تلقائي' ]),
						E('span', { 'style': 'color:#64748b;' }, [ 'عند إيقاف HAMax تُستعاد الإعدادات الأصلية للراديو فوراً' ])
					])
				])
			])
		]);
	},

	buildAirPanel: function(st) {
		var sv = st.survey;

		if (!sv) {
			return E('div', {
				'id': 'hamax-air',
				'style': 'padding:12px; background:#f9fafb; border-radius:8px; color:#9ca3af; font-size:13px; text-align:center;'
			}, [ _('لا توجد بيانات مسح للراديو (المسح متاح فقط بعد تشغيل الراديو)') ]);
		}

		var util  = parseInt(sv.util, 10);
		var noise = parseInt(sv.noise, 10);

		function cell(label, value, color, hint) {
			return E('div', { 'style': 'flex:1; min-width:120px; padding:8px 10px;' }, [
				E('div', { 'style': 'font-size:11px; color:#6b7280;' }, [ label ]),
				E('div', { 'style': 'font-size:19px; font-weight:800; color:' + (color || '#111827') }, [ value ]),
				hint ? E('div', { 'style': 'font-size:10px; color:#9ca3af;' }, [ hint ]) : E('span', {})
			]);
		}

		var utilColor = isNaN(util) ? '#111827'
		              : (util >= 70 ? '#dc2626' : (util >= 40 ? '#d97706' : '#059669'));

		return E('div', {
			'id': 'hamax-air',
			'style': 'display:flex; flex-wrap:wrap; gap:4px; background:#fff; border:1px solid #e5e7eb;' +
			         'border-radius:10px; padding:6px;'
		}, [
			cell(_('التردد التشغيلي'), (sv.freq || '—') + ' MHz', null,
			     st.offgrid ? _('قناة مخصصة (Off-Grid) 🛡') : _('قناة قياسية 📡')),
			cell(_('أرضية الضوضاء (Noise)'), (isNaN(noise) ? '—' : noise + ' dBm'), null, _('مستوى الضوضاء المحيطة')),
			cell(_('استهلاك القناة (Airtime)'), (isNaN(util) ? '—' : util + '%'), utilColor, _('نسبة انشغال التردد')),
			cell(_('زمن الإرسال (TX Time)'), (sv.tx_ms || '—') + ' ms', null, _('من إجمالي ') + (sv.active_ms || '—') + ' ms'),
			cell(_('زمن الاستقبال (RX Time)'), (sv.rx_ms || '—') + ' ms', null, '')
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
					th('الواجهة'), th('البرج الرئيسي (BSSID)'), th('اسم الشبكة (SSID)'), th('قوة الإشارة'),
					th('سرعة الإرسال TX'), th('سرعة الاستقبال RX'), th('التردد')
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
				th('الماك أدرس (MAC)'), th('جودة الرابط (Quality)'), th('نسبة الإشارة للضوضاء (SNR)'), th('قوة الإشارة'), th('TX'), th('RX'),
				th('إنتاجية متوقعة'), th('إعادة الإرسال (Retry)'), th('حصة الهواء (Airtime)')
			]) ]),
			E('tbody', {}, links.map(function(s) {
				var w   = parseInt(s.weight, 10);
				var pct = isNaN(w) ? 0 : Math.max(0, Math.min(100, Math.round(w / 5.12)));
				var q   = linkQuality(s, st.survey);
				var qc  = qualityColor(q.score);

				return E('tr', {}, [
					E('td', { 'style': S.mono + ' font-weight:700;' }, [
						s.mac,
						E('div', { 'style': S.muted }, [ s.iface ])
					]),

					E('td', { 'style': 'min-width:110px;' }, [
						q.score === null
							? E('span', { 'style': S.muted }, [ _('يحتاج مسح الراديو') ])
							: E('div', {}, [
								E('div', { 'style': 'font-weight:800; color:' + qc }, [ q.score + '%' ]),
								E('div', { 'style': 'background:#e5e7eb; border-radius:4px; height:6px; overflow:hidden;' }, [
									E('div', { 'style': 'background:' + qc + '; height:100%; width:' + q.score + '%;' }, [])
								])
							])
					]),

					E('td', { 'style': 'font-weight:700; color:' + qc }, [
						q.snr === null ? '—' : (q.snr + ' dB')
					]),

					E('td', {}, [
						(s.signal || '—') + ' dBm',
						s.signal_avg ? E('div', { 'style': S.muted }, [ 'متوسط ' + s.signal_avg ]) : E('span', {})
					]),
					E('td', {}, [ (s.tx_rate || '—') + ' Mb/s' ]),
					E('td', {}, [ (s.rx_rate || '—') + ' Mb/s' ]),
					E('td', {}, [ s.expected || '—' ]),

					E('td', { 'style': (q.retry !== null && q.retry > 15 ? 'color:#b91c1c; font-weight:700;' : 'color:#6b7280;') }, [
						q.retry === null ? '—' : (q.retry.toFixed(1) + '%'),
						E('div', { 'style': S.muted }, [ _('فشل: ') + (s.tx_failed || '0') ])
					]),

					E('td', { 'style': 'min-width:110px;' }, [
						isNaN(w)
							? E('span', { 'style': S.muted }, [ _('غير مفعَّل') ])
							: E('div', {}, [
								E('div', { 'style': 'background:#e5e7eb; border-radius:4px; height:6px; overflow:hidden;' }, [
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
					? _('سيتم إيقاف بروتوكول HAMax واستعادة الإعدادات الأصلية لراديو 5 جيجا.')
					: _('سيتم تفعيل بروتوكول HAMax وتحسين أداء راديو 5 جيجا للربط الخارجي.')
			]),
			E('p', { 'style': 'color:#b45309; font-size:12px;' }, [
				_('ملاحظة: سيُعاد تشغيل راديو 5 جيجا فقط، ولن يتأثر راديو 2.4 جيجا المنزلي.')
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
									        : _('تم تطبيق ملف HAMax على راديو 5 جيجا بنجاح.')
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

	handleVerify: function() {
		return fs.exec('/usr/bin/hamax', [ 'verify' ]).then(function(res) {
			ui.showModal(_('فحص الحالة الحية لبروتوكول HAMax'), [
				E('p', { 'style': 'font-size:13px; color:#6b7280;' }, [
					_('بيانات القياس الفعلية المباشرة من الراديو ونظام التشغيل.')
				]),
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

	handleCheck: function() {
		return fs.exec('/usr/bin/hamax', [ 'check' ]).then(function(res) {
			ui.showModal(_('تقرير توافق عتاد HAMax'), [
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
		var st    = data[0] || {};
		var log0  = (data[1] || '').trim();
		var chans = data[4] || [];
		var self  = this;
		var m, s, o;

		m = new form.Map('hamax',
			_('بروتوكول HAMax للربط اللاسلكي الخارجي (5 GHz Outdoor Bridge)'),
			_('منظومة الربط اللاسلكي للمسافات البعيدة (Point-to-Point و Multipoint) بأداء فائق وتأخير منخفض وحماية بروتوكولية كاملة.')
		);

		/* --- live dashboard ------------------------------------------ */
		s = m.section(form.NamedSection, 'settings', 'hamax');
		s.anonymous = true;

		o = s.option(form.DummyValue, '_dash');
		o.rawhtml = true;
		o.cfgvalue = function() {
			return E('div', { 'id': 'hamax-dash' }, [
				self.buildStatusCard(st),
				E('div', { 'id': 'hamax-air-wrap', 'style': 'margin-bottom:12px;' }, [
					self.buildAirPanel(st)
				]),
				E('div', { 'style': 'background:#fff; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden;' }, [
					E('div', {
						'style': 'padding:10px 16px; background:#f9fafb; border-bottom:1px solid #e5e7eb;' +
						         'display:flex; justify-content:space-between; align-items:center;'
					}, [
						E('strong', { 'style': 'font-size:14px;' }, [
							st.role === 'client' ? '📡 حالة الاتصال بالبرج الرئيسي' : '📊 المحطات المتصلة على راديو 5 جيجا'
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
		s = m.section(form.NamedSection, 'settings', 'hamax', _('إعدادات بروتوكول HAMax'));
		s.anonymous = true;
		s.addremove = false;

		s.tab('general',  _('عام (General)'));
		s.tab('spectrum', _('الترددات والتشفير (Wireless / Security)'));
		s.tab('link',     _('خصائص الإشارة والمسافة (Advanced RF)'));
		s.tab('airtime',  _('إدارة جودة الخدمة (QoS / Airtime)'));
		s.tab('log',      _('سجل العمليات (System Log)'));

		/* general */
		o = s.taboption('general', form.Flag, 'enabled', _('تفعيل HAMax عند الإقلاع'),
			_('تشغيل بروتوكول HAMax وتطبيق إعداداته تلقائياً على راديو 5 جيجاهرتز بعد بدء التشغيل.'));
		o.rmempty = false;

		o = s.taboption('general', form.ListValue, 'profile', _('نمط الربط (Topology)'),
			_('نمط نقطة-لنقطة (PtP) مخصص لربط موقعين بأقصى سرعة وأدنى زمن تأخير. نمط نقطة-لعدة-نقاط (PtMP) مخصص لتوزيع الإشارة لعدة محطات عملاء مع تفعيل تفادي التصادم وعدالة توزيع الهواء.'));
		o.value('ptmp', _('برج متعدد المحطات (PtMP) — موصى به'));
		o.value('ptp',  _('رابط نقطة لنقطة مباشر (PtP)'));
		o.default = 'ptmp';

		o = s.taboption('general', form.ListValue, 'mode', _('دور الجهاز (Wireless Role)'),
			_('تحديد دور الجهاز كنقطة وصول رئيسية (Access Point) أو محطة استقبال طرفية (Station/Client). الوضع التلقائي يقرأ الدور من إعداد الواجهة الحالي.'));
		o.value('auto',   _('تلقائي (حسب إعداد الواجهة الحالي)'));
		o.value('ap',     _('نقطة وصول رئيسية (Access Point - Master)'));
		o.value('client', _('محطة استقبال طرفية (Station / Client)'));
		o.default = 'auto';

		o = s.taboption('general', form.Flag, 'wds', _('جسر WDS الشفاف (Layer-2 Transparent Bridge)'),
			_('تمرير كامل لحزم الإيثرنت وعناوين MAC الأصلية عبر الرابط اللاسلكي بدقة ومطابقة تامة لمعايير 4-Address WDS.'));
		o.default = '1';
		o.rmempty = false;

		/* spectrum */
		var usable   = chans.filter(function(c) { return c.state === 'usable'; });
		var offgrid  = usable.filter(function(c) { return !c.standard; });
		var unavail  = chans.filter(function(c) { return c.state === 'unavailable'; });

		o = s.taboption('spectrum', form.DummyValue, '_spectrum_note');
		o.rawhtml = true;
		o.cfgvalue = function() {
			var msg, bg, fg;
			if (usable.length > 0) {
				msg = '✅ قنوات الراديو جاهزة: متوفر ' + usable.length + ' قناة تشغيلية تشمل ' + offgrid.length + ' قناة مخصصة ومحمية (Off-Grid).';
				bg = '#ecfdf5'; fg = '#065f46';
			} else {
				msg = 'ℹ️ جارٍ فحص قنوات الراديو...';
				bg = '#f0f9ff'; fg = '#0369a1';
			}
			return E('div', {
				'style': 'padding:10px 14px; border-radius:8px; font-size:13px; line-height:1.7;' +
				         'background:' + bg + '; color:' + fg + ';'
			}, [ msg ]);
		};

		o = s.taboption('spectrum', form.ListValue, 'channel', _('قناة التردد (Frequency / Channel)'),
			_('اختر تردد التشغيل. القنوات المعلمة بـ [قناة مخصصة محمية] تقع خارج نطاق البحث القياسي للأجهزة العادية، مما يوفر عزلاً وحماية كاملة.'));
		o.value('', _('— الاحتفاظ بالتردد الحالي بدون تغيير —'));
		usable.forEach(function(c) {
			o.value(String(c.channel),
				(c.standard ? '📡 ' : '🛡 ') + c.channel + ' — ' + c.freq + ' MHz' +
				(c.standard ? _(' [قناة قياسية]') : _(' [قناة مخصصة محمية Off-Grid]')));
		});
		unavail.forEach(function(c) {
			o.value(String(c.channel), '🔒 ' + c.channel + ' — ' + c.freq + _(' MHz [غير متاح]'));
		});
		o.rmempty = true;

		o = s.taboption('spectrum', form.ListValue, 'htmode', _('عرض القناة (Channel Width)'),
			_('تحديد عرض القناة. اختر VHT80 للسرعات العالية أو VHT40/20 للمسافات البعيدة والبيئات ذات التداخل العالي.'));
		o.value('', _('— الاحتفاظ بالعرض الحالي —'));
		o.value('HT20',  'HT20 — 20 MHz (أقصى مدى وتحمل للضوضاء)');
		o.value('HT40',  'HT40 — 40 MHz (مدى بعيد وسرعة متوازنة)');
		o.value('VHT20', 'VHT20 — 20 MHz AC');
		o.value('VHT40', 'VHT40 — 40 MHz AC');
		o.value('VHT80', 'VHT80 — 80 MHz AC (أقصى سرعة إنتاجية)');
		o.rmempty = true;

		o = s.taboption('spectrum', form.Flag, 'isolation', _('قفل العزل والحماية البروتوكولية (HAMax Protocol Lock)'),
			_('تشفير الرابط وعزله بقفل بروتوكولي خاص وإخفاء معرّف البث، مما يمنع الأجهزة العادية من كشف الشبكة أو الاتصال بها.'));
		o.default = '1';

		o = s.taboption('spectrum', form.Value, 'lock_key', _('مفتاح قفل البروتوكول المشترك (Security Key)'),
			_('مفتاح التوثيق والمصافحة المشفر بين أجهزة HAMax. يجب تطابقه في أجهزة الإرسال والاستقبال.'));
		o.default = 'HAMax@Horus9200#Link';
		o.password = true;
		o.depends('isolation', '1');

		o = s.taboption('spectrum', form.Flag, 'stealth', _('إخفاء اسم الشبكة (Hidden SSID)'),
			_('كتم بث اسم الشبكة في إطارات البيكون لتوفير أقصى درجات السرية والتخفي.'));
		o.default = '1';

		/* link */
		o = s.taboption('link', form.Value, 'distance', _('مسافة الرابط (بالمتر)'),
			_('المسافة التقريبية للرابط بالأمتار لضبط توقيت ACK وزمن انتشار الإشارة بدقة ومنع سقوط الحزم عبر المسافات البعيدة.'));
		o.datatype = 'range(0, 50000)';
		o.default = '5000';

		o = s.taboption('link', form.Value, 'rts', _('عتبة RTS/CTS (بايت)'),
			_('معالجة مشكلة العقدة المخفية في الروابط متعددة العملاء (PtMP). القيمة الافتراضية 512. تُعطل تلقائياً في نمط PtP.'));
		o.datatype = 'range(0, 2347)';
		o.default = '512';
		o.depends('profile', 'ptmp');

		o = s.taboption('link', form.Value, 'mcast_rate', _('أدنى معدل للبث المتعدد (kbps)'),
			_('رفع سرعة إرسال حزم البث العام والمتعدد للحفاظ على وقت الهواء ومنع هبوط كفاءة الرابط (الافتراضي: 24000 = 24 ميجابت).'));
		o.datatype = 'uinteger';
		o.default = '24000';

		o = s.taboption('link', form.Value, 'beacon_int', _('الفاصل بين البيكونات (ms)'),
			_('الفاصل الزمني بين إطارات البيكون (الافتراضي 100 مللي ثانية).'));
		o.datatype = 'range(15, 65535)';
		o.default = '100';

		o = s.taboption('link', form.Value, 'dtim_period', _('فترة DTIM'),
			_('فترة تسليم رسائل إدارة المرور (الافتراضي 1 لتأمين أقل زمن استجابة للروابط الثابتة).'));
		o.datatype = 'range(1, 255)';
		o.default = '1';

		o = s.taboption('link', form.Value, 'txpower', _('طاقة الإرسال (dBm)'),
			_('تحديد قدرة الإرسال بالديسيبل. اتركه فارغاً للاعتماد على أقصى قدرة مسموحة للبطاقة.'));
		o.datatype = 'range(0, 30)';
		o.rmempty = true;

		o = s.taboption('link', form.Flag, 'short_gi', _('الفاصل الوقائي القصير (Short GI)'),
			_('تفعيل الفاصل الوقائي القصير لزيادة سرعة نقل البيانات ومعدلات التدفق القصوى.'));
		o.default = '1';

		o = s.taboption('link', form.Flag, 'noscan', _('تثبيت عرض القناة (noscan)'),
			_('إلزام الراديو بالبقاء على عرض القناة المحدد وتفادي التضييق التلقائي للقناة.'));
		o.default = '1';

		o = s.taboption('link', form.Flag, 'disable_legacy_rates', _('معدلات السرعة العالية فقط (OFDM Rates)'),
			_('إلغاء السرعات القديمة المنخفضة وإجبار الراديو على استخدام معدلات الإرسال السريعة فقط.'));
		o.default = '1';

		o = s.taboption('link', form.Flag, 'multicast_to_unicast', _('تحويل البث المتعدد إلى أحادي (Multicast-to-Unicast)'),
			_('تحويل حزم البث العام والمتعدد إلى حزم أحادية مرسلة بأقصى سرعة مع تأكيد الاستلام (ACK)، مما يحافظ على استقرار البينج ويمنع تقطيع الاتصال.'));
		o.default = '1';

		o = s.taboption('link', form.Flag, 'tune_buffers', _('مسرّع ذاكرة النواة (Kernel Buffer Scaling)'),
			_('توسيع حجم طوابير وذاكرة النواة المؤقتة لاستيعاب التدفقات العالية للبيانات دون فقدان حزم عبر الرابط.'));
		o.default = '1';

		o = s.taboption('link', form.Flag, 'ct_suppress_kick', _('حماية ثبات إشارة الرابط (Link Fading Protection)'),
			_('حماية ثبات الاتصال للعملاء البعيدين ومنع انقطاع الوصلة عند التغيرات اللحظية للإشارة الناتجة عن العوامل الجوية.'));
		o.default = '1';

		o = s.taboption('link', form.Value, 'antenna_gain', _('كسب الهوائي الخارجي (Antenna Gain dBi)'),
			_('قيمة كسب الهوائي الموجه (مثل 23 أو 30 لهوائيات الدش والبانل) لمساعدة الراديو في ضبط الحسابات اللاسلكية بدقة.'));
		o.datatype = 'range(0, 40)';
		o.rmempty = true;

		/* airtime */
		o = s.taboption('airtime', form.Flag, 'airtime', _('عدالة توزيع وقت الهواء (Airtime Fairness)'),
			_('تنظيم توزيع وقت الهواء بعدالة بين المحطات المتصلة لمنع العميل ذو الإشارة الضعيفة من استنزاف وقت البث والتأثير على بقية الشبكة. يُعطل تلقائياً في نمط PtP.'));
		o.default = '1';
		o.depends('profile', 'ptmp');

		o = s.taboption('airtime', form.ListValue, 'airtime_mode', _('آلية توزيع الهواء (Airtime Algorithm)'),
			_('الخوارزمية المستخدمة لحساب حصص البث لكل محطة متصلة.'));
		o.value('2', _('أوزان ديناميكية ذكية (Dynamic - موصى به)'));
		o.value('1', _('أوزان ثابتة (Static)'));
		o.value('3', _('تحديد سقف أقصى لكل عميل (Airtime Limit)'));
		o.default = '2';
		o.depends({ profile: 'ptmp', airtime: '1' });

		o = s.taboption('airtime', form.Value, 'airtime_update_interval', _('فترة تحديث الحصص (ms)'),
			_('الفترة الزمنية لإعادة حساب أوزان استهلاك الهواء (الافتراضي 200 مللي ثانية).'));
		o.datatype = 'range(50, 5000)';
		o.default = '200';
		o.depends({ profile: 'ptmp', airtime: '1' });

		o = s.taboption('airtime', form.Flag, 'vendor_ie', _('بث معرّف بروتوكول HAMax'),
			_('بث شارة بروتوكول HAMax في إطارات البيكون للتعرف التلقائي والمتبادل بين أجهزة الشبكة.'));
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

				var air = document.getElementById('hamax-air');
				if (air) air.parentNode.replaceChild(self.buildAirPanel(cur), air);

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
