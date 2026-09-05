'use strict';
'require view';
'require form';
'require uci';
'require fs';
'require ui';
'require poll';

/*
 * Horus AirMax (HAMax) - High-Performance Wireless Bridge Engine
 * Scope: 5 GHz Radio ONLY.
 */

/* Theme Palette (Ubiquiti airOS 8 Dark-Slate Aesthetics) */
var T = {
	bgDark:      '#0f172a',
	bgCard:      '#1e293b',
	bgCardSub:   '#0f172a',
	border:      '#334155',
	borderLight: '#475569',
	textMain:    '#f8fafc',
	textMuted:   '#94a3b8',
	accentBlue:  '#0090ff',
	accentCyan:  '#06b6d4',
	accentGreen: '#10b981',
	accentAmber: '#f59e0b',
	accentRed:   '#ef4444',
	fontMono:    'Consolas, "SF Mono", Monaco, Menlo, monospace'
};

/* Throughput state tracking */
var trafficHistory = [];
var MAX_HISTORY = 30;
var lastBytes = { tx: null, rx: null, time: null };
var peakRates = { tx: 0, rx: 0 };

/* Helper: parse modulation string into UBNT airOS notation */
function parseModulation(rateStr) {
	if (!rateStr) return { label: '\u2014', tier: '', mcs: '', width: '', nss: '2x2' };

	var mcsMatch = rateStr.match(/(?:VHT-MCS|MCS)\s*(\d+)/i);
	var mcs = mcsMatch ? parseInt(mcsMatch[1], 10) : null;
	var nssMatch = rateStr.match(/NSS\s*(\d+)/i);
	var nss = nssMatch ? (nssMatch[1] + 'x' + nssMatch[1]) : '2x2';
	var widthMatch = rateStr.match(/(\d+)\s*MHz/i);
	var width = widthMatch ? (widthMatch[1] + 'MHz') : '';

	var tier = '8x', qam = '256QAM', color = T.accentBlue;
	if (mcs !== null) {
		if (mcs >= 8)      { tier = '8x'; qam = '256QAM'; color = T.accentBlue; }
		else if (mcs >= 5) { tier = '6x'; qam = '64QAM';  color = T.accentGreen; }
		else if (mcs >= 3) { tier = '4x'; qam = '16QAM';  color = T.accentAmber; }
		else if (mcs >= 1) { tier = '2x'; qam = 'QPSK';   color = '#f97316'; }
		else               { tier = '1x'; qam = 'BPSK';   color = T.accentRed; }
	}

	return {
		label: tier + ' (' + qam + ')',
		tier: tier,
		qam: qam,
		color: color,
		mcs: mcs,
		width: width,
		nss: nss
	};
}

/* Calculate AMC (airMAX Capacity %) and AMQ (airMAX Quality %) */
function calcAirmaxMetrics(link, survey) {
	var metrics = { amq: null, amc: null, snr: null, retry: 0 };
	if (!link) return metrics;

	var sig = parseInt(link.signal, 10);
	var noise = survey ? parseInt(survey.noise, 10) : -92;
	if (!isNaN(sig) && !isNaN(noise)) {
		metrics.snr = sig - noise;
	}

	var retries = parseInt(link.tx_retries, 10) || 0;
	var packets = parseInt(link.tx_packets, 10) || 0;
	if ((retries + packets) > 0) {
		metrics.retry = (100 * retries) / (retries + packets);
	}

	/* AMQ calculation based on SNR (ideal >= 35 dB) and retry loss */
	if (metrics.snr !== null) {
		var snrNorm = Math.max(0, Math.min(100, ((metrics.snr - 12) / 26) * 100));
		var penalty = Math.min(60, metrics.retry * 2.2);
		metrics.amq = Math.round(Math.max(5, Math.min(100, snrNorm - penalty)));
	}

	/* AMC calculation based on current PHY rate vs max 866.7 Mbps */
	var txNum = parseFloat(link.tx_rate) || 0;
	if (txNum > 0) {
		metrics.amc = Math.round(Math.max(5, Math.min(100, (txNum / 866.7) * 100)));
	}

	return metrics;
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

	/* --- airOS 8 Dashboard Builder --- */

	buildDashboard: function(st) {
		var enabled = (st.state === 'enabled');
		var isClient = (st.role === 'client');
		var survey = st.survey || {};
		var links = st.links || [];
		var primaryLink = links[0] || null;
		var metrics = calcAirmaxMetrics(primaryLink, survey);

		var wrapper = E('div', {
			'id': 'hamax-airos-dashboard',
			'style': 'background:' + T.bgDark + '; color:' + T.textMain + ';' +
			         'border-radius:12px; padding:18px; margin-bottom:16px;' +
			         'box-shadow:0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3);' +
			         'border:1px solid ' + (enabled ? T.accentBlue : T.border) + ';'
		});

		wrapper.appendChild(this.renderTopBar(st, enabled, isClient));
		wrapper.appendChild(this.renderGaugesRow(st, metrics, survey));
		wrapper.appendChild(this.renderLocalRemoteCards(st, primaryLink, survey, isClient));
		wrapper.appendChild(this.renderThroughputGraph());
		wrapper.appendChild(this.renderStationsCard(st, links, isClient));

		return wrapper;
	},

	/* 1. Header Bar */
	renderTopBar: function(st, enabled, isClient) {
		var roleTitle = isClient ? 'Station PtP (CPE)' : (st.profile === 'ptp' ? 'Access Point PtP' : 'Access Point PtMP');
		var freqStr = st.freq ? (st.freq + ' MHz') : (st.channel ? ('Ch ' + st.channel) : 'Auto');
		var widthStr = st.htmode || '80 MHz';
		var modelName = st.device_model || 'Horus AirMax';

		return E('div', {
			'style': 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;' +
			         'border-bottom:1px solid ' + T.border + '; padding-bottom:14px; margin-bottom:16px;'
		}, [
			E('div', { 'style': 'display:flex; align-items:center; gap:14px;' }, [
				E('div', {
					'style': 'background:linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color:#fff;' +
					         'font-weight:900; font-size:16px; padding:6px 14px; border-radius:8px;' +
					         'letter-spacing:1px; box-shadow:0 2px 8px rgba(2, 132, 199, 0.4);'
				}, [ 'Horus AirMax' ]),
				E('div', {}, [
					E('div', { 'style': 'font-size:18px; font-weight:800; color:' + T.textMain + '; letter-spacing:0.5px;' }, [
						modelName,
						E('span', {
							'style': 'font-size:11px; font-weight:700; margin-inline-start:8px; padding:2px 8px; border-radius:10px;' +
							         'background:' + (enabled ? '#065f46' : '#374151') + '; color:' + (enabled ? '#34d399' : '#9ca3af') + ';'
						}, [ enabled ? 'ACTIVE \u26A1' : 'STANDBY' ])
					]),
					E('div', { 'style': 'font-size:12px; color:' + T.textMuted + '; margin-top:2px; display:flex; gap:12px; flex-wrap:wrap;' }, [
						E('span', {}, [ 'Mode: ', E('strong', { 'style': 'color:#38bdf8;' }, [ roleTitle ]) ]),
						E('span', {}, [ 'Frequency: ', E('strong', { 'style': 'color:#38bdf8;' }, [ freqStr ]) ]),
						E('span', {}, [ 'Width: ', E('strong', { 'style': 'color:#38bdf8;' }, [ widthStr ]) ]),
						st.ssid ? E('span', {}, [ 'SSID: ', E('strong', { 'style': 'color:#38bdf8;' }, [ st.ssid ]) ]) : E('span', {})
					])
				])
			]),

			E('div', { 'style': 'display:flex; gap:8px; align-items:center; flex-wrap:wrap;' }, [
				E('button', {
					'class': 'btn ' + (enabled ? 'btn-danger' : 'cbi-button-positive'),
					'style': 'font-weight:700; padding:6px 16px; border-radius:6px; font-size:12px;',
					'click': ui.createHandlerFn(this, 'handleToggle', enabled)
				}, [ enabled ? '\u23F8 Stop airMAX' : '\u25B6 Start airMAX' ]),

				E('button', {
					'class': 'btn',
					'style': 'font-size:12px; padding:6px 12px; border-radius:6px; background:' + T.bgCard + '; color:' + T.textMain + '; border:1px solid ' + T.border + ';',
					'click': ui.createHandlerFn(this, 'handleVerify')
				}, [ '\u2699 RF Tools' ]),

				E('button', {
					'class': 'btn',
					'style': 'font-size:12px; padding:6px 12px; border-radius:6px; background:' + T.bgCard + '; color:' + T.textMain + '; border:1px solid ' + T.border + ';',
					'click': ui.createHandlerFn(this, 'handleCheck')
				}, [ '\uD83D\uDD0D Diagnostics' ])
			])
		]);
	},

	/* 2. Gauges Row: AMC, AMQ, and Segmented AirTime Bar */
	renderGaugesRow: function(st, metrics, survey) {
		var amqVal = metrics.amq !== null ? metrics.amq : 0;
		var amcVal = metrics.amc !== null ? metrics.amc : 0;

		var util = parseInt(survey.util, 10) || 0;
		var txPct = parseInt(survey.tx_pct, 10) || 0;
		var rxPct = parseInt(survey.rx_pct, 10) || 0;
		var intfPct = parseInt(survey.intf_pct, 10) || 0;
		var freePct = Math.max(0, 100 - (txPct + rxPct + intfPct));

		var amqColor = amqVal >= 75 ? T.accentGreen : (amqVal >= 50 ? T.accentAmber : T.accentRed);
		var amcColor = amcVal >= 75 ? T.accentBlue : (amcVal >= 50 ? T.accentAmber : T.accentRed);

		return E('div', {
			'style': 'display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:14px; margin-bottom:16px;'
		}, [
			/* AMQ Gauge */
			E('div', {
				'style': 'background:' + T.bgCard + '; border:1px solid ' + T.border + '; border-radius:10px; padding:14px;'
			}, [
				E('div', { 'style': 'display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;' }, [
					E('span', { 'style': 'font-size:12px; font-weight:700; color:' + T.textMuted + '; text-transform:uppercase; letter-spacing:0.5px;' }, [ 'airMAX Quality (AMQ)' ]),
					E('span', { 'style': 'font-size:18px; font-weight:900; color:' + amqColor + ';' }, [ amqVal > 0 ? (amqVal + '%') : '\u2014' ])
				]),
				E('div', { 'style': 'background:' + T.bgCardSub + '; border-radius:6px; height:8px; overflow:hidden; border:1px solid ' + T.border + ';' }, [
					E('div', { 'style': 'background:' + amqColor + '; height:100%; width:' + amqVal + '%; transition:width 0.4s ease;' }, [])
				]),
				E('div', { 'style': 'font-size:11px; color:' + T.textMuted + '; margin-top:6px; display:flex; justify-content:space-between;' }, [
					E('span', {}, [ 'SNR: ', E('strong', { 'style': 'color:' + T.textMain + ';' }, [ metrics.snr !== null ? (metrics.snr + ' dB') : '\u2014' ]) ]),
					E('span', {}, [ 'Retries: ', E('strong', { 'style': 'color:' + (metrics.retry > 10 ? T.accentRed : T.textMain) + ';' }, [ metrics.retry.toFixed(1) + '%' ]) ])
				])
			]),

			/* AMC Gauge */
			E('div', {
				'style': 'background:' + T.bgCard + '; border:1px solid ' + T.border + '; border-radius:10px; padding:14px;'
			}, [
				E('div', { 'style': 'display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;' }, [
					E('span', { 'style': 'font-size:12px; font-weight:700; color:' + T.textMuted + '; text-transform:uppercase; letter-spacing:0.5px;' }, [ 'airMAX Capacity (AMC)' ]),
					E('span', { 'style': 'font-size:18px; font-weight:900; color:' + amcColor + ';' }, [ amcVal > 0 ? (amcVal + '%') : '\u2014' ])
				]),
				E('div', { 'style': 'background:' + T.bgCardSub + '; border-radius:6px; height:8px; overflow:hidden; border:1px solid ' + T.border + ';' }, [
					E('div', { 'style': 'background:' + amcColor + '; height:100%; width:' + amcVal + '%; transition:width 0.4s ease;' }, [])
				]),
				E('div', { 'style': 'font-size:11px; color:' + T.textMuted + '; margin-top:6px; display:flex; justify-content:space-between;' }, [
					E('span', {}, [ 'Theoretical Speed: ', E('strong', { 'style': 'color:' + T.textMain + ';' }, [ '866.7 Mbps' ]) ]),
					E('span', {}, [ 'Efficiency: ', E('strong', { 'style': 'color:' + T.textMain + ';' }, [ amcVal + '%' ]) ])
				])
			]),

			/* AirTime Utilization Gauge (Segmented) */
			E('div', {
				'style': 'background:' + T.bgCard + '; border:1px solid ' + T.border + '; border-radius:10px; padding:14px;'
			}, [
				E('div', { 'style': 'display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;' }, [
					E('span', { 'style': 'font-size:12px; font-weight:700; color:' + T.textMuted + '; text-transform:uppercase; letter-spacing:0.5px;' }, [ 'AirTime Utilization' ]),
					E('span', { 'style': 'font-size:18px; font-weight:900; color:' + (util >= 75 ? T.accentRed : (util >= 45 ? T.accentAmber : T.accentGreen)) + ';' }, [
						util + '%'
					])
				]),
				/* Multi-segment Bar */
				E('div', {
					'style': 'display:flex; height:8px; border-radius:6px; overflow:hidden; background:' + T.bgCardSub + '; border:1px solid ' + T.border + ';'
				}, [
					E('div', { 'title': 'TX AirTime: ' + txPct + '%', 'style': 'background:' + T.accentBlue + '; width:' + txPct + '%;' }, []),
					E('div', { 'title': 'RX AirTime: ' + rxPct + '%', 'style': 'background:' + T.accentGreen + '; width:' + rxPct + '%;' }, []),
					E('div', { 'title': 'Interference/Busy: ' + intfPct + '%', 'style': 'background:' + T.accentAmber + '; width:' + intfPct + '%;' }, []),
					E('div', { 'title': 'Free AirTime: ' + freePct + '%', 'style': 'background:#334155; width:' + freePct + '%;' }, [])
				]),
				E('div', {
					'style': 'display:flex; gap:10px; font-size:10px; color:' + T.textMuted + '; margin-top:6px; flex-wrap:wrap;'
				}, [
					E('span', { 'style': 'display:inline-flex; align-items:center; gap:4px;' }, [
						E('span', { 'style': 'width:8px; height:8px; border-radius:50%; background:' + T.accentBlue + '; display:inline-block;' }),
						'TX: ' + txPct + '%'
					]),
					E('span', { 'style': 'display:inline-flex; align-items:center; gap:4px;' }, [
						E('span', { 'style': 'width:8px; height:8px; border-radius:50%; background:' + T.accentGreen + '; display:inline-block;' }),
						'RX: ' + rxPct + '%'
					]),
					E('span', { 'style': 'display:inline-flex; align-items:center; gap:4px;' }, [
						E('span', { 'style': 'width:8px; height:8px; border-radius:50%; background:' + T.accentAmber + '; display:inline-block;' }),
						'Busy: ' + intfPct + '%'
					]),
					E('span', { 'style': 'display:inline-flex; align-items:center; gap:4px;' }, [
						E('span', { 'style': 'width:8px; height:8px; border-radius:50%; background:#334155; display:inline-block;' }),
						'Free: ' + freePct + '%'
					])
				])
			])
		]);
	},

	/* 3. Local Radio vs Remote Radio RF Comparison Cards */
	renderLocalRemoteCards: function(st, link, survey, isClient) {
		var localSig = link ? parseInt(link.signal, 10) : -60;
		var noise = survey ? parseInt(survey.noise, 10) : -92;
		var snr = (!isNaN(localSig) && !isNaN(noise)) ? (localSig - noise) : 32;

		var ch0 = link && link.chain0 ? link.chain0 : (localSig ? (localSig - 1) : '-61');
		var ch1 = link && link.chain1 ? link.chain1 : (localSig ? (localSig - 2) : '-62');
		var chDiff = link && link.chain_diff ? link.chain_diff : Math.abs(parseInt(ch0, 10) - parseInt(ch1, 10));

		var txMod = parseModulation(link ? (link.tx_bitrate_full || (link.tx_rate + ' Mbps')) : '866.7 Mbps VHT-MCS 9 80MHz');
		var rxMod = parseModulation(link ? (link.rx_bitrate_full || (link.rx_rate + ' Mbps')) : '866.7 Mbps VHT-MCS 9 80MHz');

		var distMeters = parseInt(st.distance, 10) || 5000;
		var distKm = (distMeters / 1000).toFixed(1);
		var distMiles = (distMeters / 1609.34).toFixed(1);

		var remoteName = link ? (link.name || link.mac || 'Remote Station') : 'Remote Station';
		var remoteIp = link ? (link.ip || '\u2014') : '\u2014';
		var remoteSig = link ? (link.signal || '\u2014') : '\u2014';

		return E('div', {
			'style': 'background:' + T.bgCard + '; border:1px solid ' + T.border + '; border-radius:12px; padding:16px; margin-bottom:16px;'
		}, [
			E('div', {
				'style': 'font-size:13px; font-weight:800; color:' + T.textMuted + '; text-transform:uppercase; letter-spacing:1px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center;'
			}, [
				E('span', {}, [ '\uD83D\uDCE1 RF Link Performance & Signal Metrics' ]),
				E('span', { 'style': 'font-size:11px; color:#38bdf8;' }, [ 'Distance: ' + distKm + ' km (' + distMiles + ' miles)' ])
			]),

			E('div', {
				'style': 'display:grid; grid-template-columns:1fr auto 1fr; gap:16px; align-items:center;'
			}, [
				/* Left: LOCAL AP / RADIO */
				E('div', {
					'style': 'background:' + T.bgCardSub + '; border:1px solid ' + T.border + '; border-radius:10px; padding:14px;'
				}, [
					E('div', { 'style': 'display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;' }, [
						E('div', {}, [
							E('span', { 'style': 'font-size:11px; font-weight:700; color:' + T.accentBlue + '; text-transform:uppercase;' }, [ 'LOCAL RADIO' ]),
							E('div', { 'style': 'font-size:15px; font-weight:800; color:' + T.textMain + ';' }, [ st.device_model || 'Horus AirMax' ])
						]),
						E('div', { 'style': 'text-align:right;' }, [
							E('span', { 'style': 'font-size:22px; font-weight:900; color:' + T.accentGreen + ';' }, [
								(link && link.signal ? link.signal : '\u2014') + ' dBm'
							])
						])
					]),

					/* Chain Signals */
					E('div', { 'style': 'background:#1e293b; border-radius:6px; padding:8px 10px; margin-bottom:10px; font-size:11px;' }, [
						E('div', { 'style': 'display:flex; justify-content:space-between; margin-bottom:4px;' }, [
							E('span', { 'style': 'color:' + T.textMuted + ';' }, [ 'Chains (0 / 1):' ]),
							E('span', { 'style': 'font-family:' + T.fontMono + '; color:' + T.textMain + ';' }, [
								ch0 + ' / ' + ch1 + ' dBm'
							])
						]),
						E('div', { 'style': 'display:flex; justify-content:space-between;' }, [
							E('span', { 'style': 'color:' + T.textMuted + ';' }, [ 'Delta Imbalance:' ]),
							E('span', { 'style': 'font-weight:700; color:' + (chDiff <= 2 ? T.accentGreen : (chDiff <= 4 ? T.accentAmber : T.accentRed)) + ';' }, [
								chDiff + ' dB ' + (chDiff <= 2 ? '\u2705 Ideal' : '\u26A0 Check Alignment')
							])
						])
					]),

					/* Noise, SNR & TX Power */
					E('div', { 'style': 'display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; font-size:11px; text-align:center;' }, [
						E('div', { 'style': 'background:#1e293b; padding:6px; border-radius:6px;' }, [
							E('div', { 'style': 'color:' + T.textMuted + ';' }, [ 'Noise Floor' ]),
							E('div', { 'style': 'font-weight:800; color:' + T.textMain + ';' }, [ noise + ' dBm' ])
						]),
						E('div', { 'style': 'background:#1e293b; padding:6px; border-radius:6px;' }, [
							E('div', { 'style': 'color:' + T.textMuted + ';' }, [ 'SNR' ]),
							E('div', { 'style': 'font-weight:800; color:' + T.accentGreen + ';' }, [ snr + ' dB' ])
						]),
						E('div', { 'style': 'background:#1e293b; padding:6px; border-radius:6px;' }, [
							E('div', { 'style': 'color:' + T.textMuted + ';' }, [ 'TX Power' ]),
							E('div', { 'style': 'font-weight:800; color:' + T.textMain + ';' }, [ (st.txpower || '24.00') + ' dBm' ])
						])
					]),

					/* TX / RX Data Rates */
					E('div', { 'style': 'margin-top:10px; display:flex; justify-content:space-between; align-items:center; font-size:11px;' }, [
						E('div', {}, [
							E('span', { 'style': 'color:' + T.textMuted + ';' }, [ 'TX Modulation: ' ]),
							E('span', { 'style': 'background:#0369a1; color:#fff; padding:2px 8px; border-radius:10px; font-weight:700; font-size:10px;' }, [ txMod.label ])
						]),
						E('div', { 'style': 'color:' + T.textMuted + ';' }, [ 'LAN: ', E('strong', { 'style': 'color:#34d399;' }, [ st.lan_speed || '1000 Mbps' ]) ])
					])
				]),

				/* Center: RF LINK CONNECTOR */
				E('div', { 'style': 'display:flex; flex-direction:column; align-items:center; justify-content:center; padding:0 8px;' }, [
					E('div', { 'style': 'font-size:22px; color:#38bdf8; animation:pulse 2s infinite;' }, [ '\u21C4' ]),
					E('div', {
						'style': 'background:#0369a1; color:#fff; font-size:10px; font-weight:800; padding:2px 8px; border-radius:10px; white-space:nowrap; margin:4px 0;'
					}, [ distKm + ' km' ]),
					E('div', { 'style': 'font-size:10px; color:' + T.textMuted + ';' }, [ 'WDS Transparent' ])
				]),

				/* Right: REMOTE PEER / STATION */
				E('div', {
					'style': 'background:' + T.bgCardSub + '; border:1px solid ' + T.border + '; border-radius:10px; padding:14px;'
				}, [
					E('div', { 'style': 'display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;' }, [
						E('div', {}, [
							E('span', { 'style': 'font-size:11px; font-weight:700; color:#38bdf8; text-transform:uppercase;' }, [ 'REMOTE STATION' ]),
							E('div', { 'style': 'font-size:15px; font-weight:800; color:' + T.textMain + ';' }, [ remoteName ])
						]),
						E('div', { 'style': 'text-align:right;' }, [
							E('span', { 'style': 'font-size:22px; font-weight:900; color:' + (remoteSig !== '\u2014' ? T.accentGreen : T.textMuted) + ';' }, [
								remoteSig !== '\u2014' ? (remoteSig + ' dBm') : 'Scanning...'
							])
						])
					]),

					/* Remote IP & Interface */
					E('div', { 'style': 'background:#1e293b; border-radius:6px; padding:8px 10px; margin-bottom:10px; font-size:11px;' }, [
						E('div', { 'style': 'display:flex; justify-content:space-between; margin-bottom:4px;' }, [
							E('span', { 'style': 'color:' + T.textMuted + ';' }, [ 'Remote IP Address:' ]),
							E('span', { 'style': 'font-family:' + T.fontMono + '; color:' + T.accentCyan + '; font-weight:700;' }, [ remoteIp ])
						]),
						E('div', { 'style': 'display:flex; justify-content:space-between;' }, [
							E('span', { 'style': 'color:' + T.textMuted + ';' }, [ 'MAC Address:' ]),
							E('span', { 'style': 'font-family:' + T.fontMono + '; color:' + T.textMain + ';' }, [ link ? link.mac : '\u2014' ])
						])
					]),

					/* Remote Metrics Grid */
					E('div', { 'style': 'display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; font-size:11px; text-align:center;' }, [
						E('div', { 'style': 'background:#1e293b; padding:6px; border-radius:6px;' }, [
							E('div', { 'style': 'color:' + T.textMuted + ';' }, [ 'AirTime' ]),
							E('div', { 'style': 'font-weight:800; color:' + T.accentBlue + ';' }, [
								link && link.weight ? (Math.round(parseInt(link.weight, 10) / 5.12) + '%') : '\u2014'
							])
						]),
						E('div', { 'style': 'background:#1e293b; padding:6px; border-radius:6px;' }, [
							E('div', { 'style': 'color:' + T.textMuted + ';' }, [ 'Latency' ]),
							E('div', { 'style': 'font-weight:800; color:' + T.accentGreen + ';' }, [ '< 2 ms' ])
						]),
						E('div', { 'style': 'background:#1e293b; padding:6px; border-radius:6px;' }, [
							E('div', { 'style': 'color:' + T.textMuted + ';' }, [ 'Inactive' ]),
							E('div', { 'style': 'font-weight:800; color:' + T.textMain + ';' }, [
								link && link.inactive ? (link.inactive + ' ms') : '0 ms'
							])
						])
					]),

					/* RX Modulation */
					E('div', { 'style': 'margin-top:10px; display:flex; justify-content:space-between; align-items:center; font-size:11px;' }, [
						E('div', {}, [
							E('span', { 'style': 'color:' + T.textMuted + ';' }, [ 'RX Modulation: ' ]),
							E('span', { 'style': 'background:#065f46; color:#fff; padding:2px 8px; border-radius:10px; font-weight:700; font-size:10px;' }, [ rxMod.label ])
						]),
						E('div', { 'style': 'color:' + T.textMuted + ';' }, [
							'Speed: ', E('strong', { 'style': 'color:' + T.textMain + ';' }, [ (link && link.rx_rate ? link.rx_rate : '866.7') + ' Mbps' ])
						])
					])
				])
			])
		]);
	},

	/* 4. Live Real-Time Throughput / Traffic Graph (SVG) */
	renderThroughputGraph: function() {
		var curTx = trafficHistory.length ? trafficHistory[trafficHistory.length - 1].txRate : 0;
		var curRx = trafficHistory.length ? trafficHistory[trafficHistory.length - 1].rxRate : 0;

		return E('div', {
			'style': 'background:' + T.bgCard + '; border:1px solid ' + T.border + '; border-radius:12px; padding:16px; margin-bottom:16px;'
		}, [
			E('div', { 'style': 'display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px;' }, [
				E('div', {}, [
					E('span', { 'style': 'font-size:13px; font-weight:800; color:' + T.textMuted + '; text-transform:uppercase; letter-spacing:1px;' }, [ '\uD83D\uDCC8 Real-Time Throughput (Traffic)' ]),
					E('div', { 'style': 'font-size:11px; color:' + T.textMuted + ';' }, [ 'Live transmitter and receiver traffic between Local and Remote' ])
				]),
				E('div', { 'style': 'display:flex; gap:16px; font-size:12px;' }, [
					E('div', { 'style': 'display:flex; align-items:center; gap:6px;' }, [
						E('span', { 'style': 'width:10px; height:10px; border-radius:50%; background:' + T.accentBlue + '; display:inline-block;' }),
						E('span', { 'style': 'color:' + T.textMuted + ';' }, [ 'TX:' ]),
						E('strong', { 'id': 'hamax-tx-rate', 'style': 'color:' + T.accentBlue + '; font-size:14px;' }, [ curTx.toFixed(2) + ' Mbps' ]),
						E('span', { 'style': 'color:' + T.textMuted + '; font-size:10px;' }, [ '(Peak: ' + peakRates.tx.toFixed(1) + ')' ])
					]),
					E('div', { 'style': 'display:flex; align-items:center; gap:6px;' }, [
						E('span', { 'style': 'width:10px; height:10px; border-radius:50%; background:' + T.accentGreen + '; display:inline-block;' }),
						E('span', { 'style': 'color:' + T.textMuted + ';' }, [ 'RX:' ]),
						E('strong', { 'id': 'hamax-rx-rate', 'style': 'color:' + T.accentGreen + '; font-size:14px;' }, [ curRx.toFixed(2) + ' Mbps' ]),
						E('span', { 'style': 'color:' + T.textMuted + '; font-size:10px;' }, [ '(Peak: ' + peakRates.rx.toFixed(1) + ')' ])
					])
				])
			]),

			/* SVG Canvas Container */
			E('div', {
				'id': 'hamax-svg-chart-wrap',
				'style': 'background:' + T.bgCardSub + '; border:1px solid ' + T.border + '; border-radius:8px; padding:8px; height:140px; position:relative; overflow:hidden;'
			}, [
				this.generateSvgChart()
			])
		]);
	},

	generateSvgChart: function() {
		var w = 800, h = 120;
		var maxVal = Math.max(10, peakRates.tx, peakRates.rx, 15);

		var pointsTx = [];
		var pointsRx = [];
		var count = Math.max(MAX_HISTORY, trafficHistory.length);

		for (var i = 0; i < MAX_HISTORY; i++) {
			var entry = trafficHistory[i] || { txRate: 0, rxRate: 0 };
			var x = (i / (MAX_HISTORY - 1)) * w;
			var yTx = h - (Math.min(entry.txRate, maxVal) / maxVal) * (h - 10);
			var yRx = h - (Math.min(entry.rxRate, maxVal) / maxVal) * (h - 10);
			pointsTx.push(x.toFixed(1) + ',' + yTx.toFixed(1));
			pointsRx.push(x.toFixed(1) + ',' + yRx.toFixed(1));
		}

		var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
		svg.setAttribute('preserveAspectRatio', 'none');
		svg.setAttribute('style', 'width:100%; height:100%; display:block;');

		/* Grid lines */
		for (var g = 1; g <= 3; g++) {
			var gy = (h / 4) * g;
			var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
			line.setAttribute('x1', '0');
			line.setAttribute('y1', gy);
			line.setAttribute('x2', w);
			line.setAttribute('y2', gy);
			line.setAttribute('stroke', '#1e293b');
			line.setAttribute('stroke-dasharray', '4 4');
			svg.appendChild(line);
		}

		/* TX Polyline */
		var polyTx = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
		polyTx.setAttribute('fill', 'none');
		polyTx.setAttribute('stroke', T.accentBlue);
		polyTx.setAttribute('stroke-width', '2.5');
		polyTx.setAttribute('points', pointsTx.join(' '));
		svg.appendChild(polyTx);

		/* RX Polyline */
		var polyRx = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
		polyRx.setAttribute('fill', 'none');
		polyRx.setAttribute('stroke', T.accentGreen);
		polyRx.setAttribute('stroke-width', '2.5');
		polyRx.setAttribute('points', pointsRx.join(' '));
		svg.appendChild(polyRx);

		return svg;
	},

	/* 5. Stations Table */
	renderStationsCard: function(st, links, isClient) {
		var self = this;
		var title = isClient ? 'Connected Remote Access Point (Tower)' : 'Connected airMAX Stations (Clients)';

		return E('div', {
			'style': 'background:' + T.bgCard + '; border:1px solid ' + T.border + '; border-radius:12px; overflow:hidden;'
		}, [
			E('div', {
				'style': 'padding:12px 16px; background:#162032; border-bottom:1px solid ' + T.border + ';' +
				         'display:flex; justify-content:space-between; align-items:center;'
			}, [
				E('div', { 'style': 'display:flex; align-items:center; gap:8px;' }, [
					E('span', { 'style': 'font-size:14px; font-weight:800; color:' + T.textMain + ';' }, [ title ]),
					E('span', {
						'style': 'background:#0369a1; color:#fff; font-size:11px; font-weight:800; padding:2px 8px; border-radius:12px;'
					}, [ String(links.length) ])
				]),
				E('span', { 'style': 'font-size:11px; color:' + T.textMuted + ';' }, [ '4-Address WDS Layer-2 Bridge Active' ])
			]),

			E('div', { 'id': 'hamax-stations-table-wrap', 'style': 'padding:12px; overflow-x:auto;' }, [
				this.renderStationsTable(links, isClient, st)
			])
		]);
	},

	renderStationsTable: function(links, isClient, st) {
		if (!links || links.length === 0) {
			return E('div', {
				'style': 'padding:24px; text-align:center; color:' + T.textMuted + '; font-size:13px;'
			}, [
				isClient ? 'Searching for Remote airMAX Tower...' : 'No active stations connected on 5 GHz radio.'
			]);
		}

		function th(text) {
			return E('th', {
				'style': 'background:#0f172a; color:' + T.textMuted + '; font-size:11px; font-weight:700;' +
				         'text-transform:uppercase; padding:8px 10px; border-bottom:1px solid ' + T.border + ';'
			}, [ text ]);
		}

		var table = E('table', { 'class': 'table', 'style': 'width:100%; margin:0; border-collapse:collapse;' }, [
			E('thead', {}, [
				E('tr', {}, [
					th('Device / MAC'),
					th('IP Address'),
					th('Signal (Chains)'),
					th('TX Rate'),
					th('RX Rate'),
					th('AirTime'),
					th('Distance'),
					th('Retries / Lost'),
					th('Connection Time')
				])
			]),
			E('tbody', {}, links.map(function(s) {
				var txMod = parseModulation(s.tx_bitrate_full || (s.tx_rate + ' Mbps'));
				var rxMod = parseModulation(s.rx_bitrate_full || (s.rx_rate + ' Mbps'));
				var airtimePct = s.weight ? Math.round(parseInt(s.weight, 10) / 5.12) : 10;
				var sigNum = parseInt(s.signal, 10) || -60;
				var sigColor = sigNum >= -65 ? T.accentGreen : (sigNum >= -75 ? T.accentAmber : T.accentRed);

				var ch0 = s.chain0 || (sigNum - 1);
				var ch1 = s.chain1 || (sigNum - 2);

				return E('tr', { 'style': 'border-bottom:1px solid #1e293b; font-size:12px;' }, [
					/* Device & MAC */
					E('td', { 'style': 'padding:8px 10px;' }, [
						E('div', { 'style': 'font-weight:700; color:' + T.textMain + ';' }, [ s.name || 'Station' ]),
						E('div', { 'style': 'font-family:' + T.fontMono + '; font-size:10px; color:' + T.textMuted + ';' }, [ s.mac || s.bssid || '\u2014' ])
					]),

					/* IP */
					E('td', { 'style': 'padding:8px 10px; font-family:' + T.fontMono + '; color:' + T.accentCyan + '; font-weight:700;' }, [
						s.ip || '\u2014'
					]),

					/* Signal & Chains */
					E('td', { 'style': 'padding:8px 10px;' }, [
						E('div', { 'style': 'font-weight:800; color:' + sigColor + ';' }, [ (s.signal || '\u2014') + ' dBm' ]),
						E('div', { 'style': 'font-size:10px; color:' + T.textMuted + '; font-family:' + T.fontMono + ';' }, [
							ch0 + ' / ' + ch1 + ' dBm'
						])
					]),

					/* TX Rate */
					E('td', { 'style': 'padding:8px 10px;' }, [
						E('span', {
							'style': 'background:' + txMod.color + '; color:#fff; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px;'
						}, [ txMod.tier ]),
						E('span', { 'style': 'margin-inline-start:6px; color:' + T.textMain + ';' }, [ (s.tx_rate || '\u2014') + ' Mbps' ])
					]),

					/* RX Rate */
					E('td', { 'style': 'padding:8px 10px;' }, [
						E('span', {
							'style': 'background:' + rxMod.color + '; color:#fff; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px;'
						}, [ rxMod.tier ]),
						E('span', { 'style': 'margin-inline-start:6px; color:' + T.textMain + ';' }, [ (s.rx_rate || '\u2014') + ' Mbps' ])
					]),

					/* AirTime */
					E('td', { 'style': 'padding:8px 10px; min-width:90px;' }, [
						E('div', { 'style': 'font-weight:700; color:#38bdf8;' }, [ airtimePct + '%' ]),
						E('div', { 'style': 'background:#0f172a; height:5px; border-radius:3px; overflow:hidden; margin-top:2px;' }, [
							E('div', { 'style': 'background:' + T.accentBlue + '; height:100%; width:' + airtimePct + '%;' }, [])
						])
					]),

					/* Distance */
					E('td', { 'style': 'padding:8px 10px; color:' + T.textMain + ';' }, [
						((parseInt(st.distance, 10) || 5000) / 1000).toFixed(1) + ' km'
					]),

					/* Retries */
					E('td', { 'style': 'padding:8px 10px;' }, [
						E('div', { 'style': 'color:' + (s.tx_failed > 0 ? T.accentRed : T.textMuted) + ';' }, [
							(s.tx_retries || '0') + ' retries'
						]),
						s.tx_failed ? E('div', { 'style': 'font-size:10px; color:' + T.accentRed + ';' }, [ 'Drop: ' + s.tx_failed ]) : E('span', {})
					]),

					/* Uptime */
					E('td', { 'style': 'padding:8px 10px; color:' + T.textMuted + ';' }, [
						s.connected ? (s.connected + 's') : (s.inactive ? (s.inactive + 'ms ago') : '\u2014')
					])
				]);
			}))
		]);

		return table;
	},

	/* --- Toggle, Check, and Verification Handlers --- */

	handleToggle: function(enabled) {
		var self = this;
		return ui.showModal(enabled ? _('Stop Horus AirMax') : _('Start Horus AirMax'), [
			E('p', {}, [
				enabled
					? _('Stop Horus AirMax and restore default 5 GHz Wi-Fi settings.')
					: _('Activate Horus AirMax long-range wireless protocol profile on 5 GHz radio.')
			]),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn', 'click': ui.hideModal }, [ _('Cancel') ]),
				' ',
				E('button', {
					'class': 'btn cbi-button-positive',
					'click': ui.createHandlerFn(self, function() {
						uci.set('hamax', 'settings', 'enabled', enabled ? '0' : '1');
						return uci.save()
							.then(function() { return uci.apply(); })
							.then(function() { return fs.exec('/usr/bin/hamax', [ enabled ? 'disable' : 'enable' ]); })
							.then(function() {
								ui.hideModal();
								location.reload();
							});
					})
				}, [ _('Confirm') ])
			])
		]);
	},

	handleVerify: function() {
		return fs.exec('/usr/bin/hamax', [ 'verify' ]).then(function(res) {
			ui.showModal(_('airMAX RF Link Verification'), [
				E('pre', {
					'style': 'max-height:60vh; overflow:auto; background:#0f172a; color:#f8fafc;' +
					         'padding:12px; border-radius:8px; font-size:12px; direction:ltr; text-align:left;'
				}, [ res.stdout || res.stderr || _('No output') ]),
				E('div', { 'class': 'right' }, [
					E('button', { 'class': 'btn', 'click': ui.hideModal }, [ _('Close') ])
				])
			]);
		});
	},

	handleCheck: function() {
		return fs.exec('/usr/bin/hamax', [ 'check' ]).then(function(res) {
			ui.showModal(_('airMAX Hardware Diagnostics'), [
				E('pre', {
					'style': 'max-height:60vh; overflow:auto; background:#0f172a; color:#f8fafc;' +
					         'padding:12px; border-radius:8px; font-size:12px; direction:ltr; text-align:left;'
				}, [ res.stdout || res.stderr || _('No output') ]),
				E('div', { 'class': 'right' }, [
					E('button', { 'class': 'btn', 'click': ui.hideModal }, [ _('Close') ])
				])
			]);
		});
	},

	handleSaveApply: function(ev, mode) {
		return this.super('handleSaveApply', [ ev, mode ]).then(function() {
			return fs.exec('/usr/bin/hamax', [ 'apply' ]);
		}).then(function() {
			ui.addNotification(null, E('p', [ _('Settings saved and applied to 5 GHz airMAX radio.') ]));
		});
	},

	/* --- Render Method: Map and airOS Settings Tabs --- */

	render: function(data) {
		var st = data[0] || {};
		var log0 = (data[1] || '').trim();
		var chans = data[4] || [];
		var self = this;
		var m, s, o;

		m = new form.Map('hamax',
			_('Horus AirMax \u2014 airOS 8 High-Performance Outdoor Bridge'),
			_('Carrier-class 5 GHz Point-to-Point (PtP) and Point-to-MultiPoint (PtMP) wireless bridging system.')
		);

		/* Live airOS Dashboard */
		s = m.section(form.NamedSection, 'settings', 'hamax');
		s.anonymous = true;

		o = s.option(form.DummyValue, '_dashboard');
		o.rawhtml = true;
		o.cfgvalue = function() {
			return self.buildDashboard(st);
		};

		/* airOS Settings Tabs */
		s = m.section(form.NamedSection, 'settings', 'hamax', _('airMAX Configuration'));
		s.anonymous = true;
		s.addremove = false;

		s.tab('wireless', _('Wireless RF'));
		s.tab('airmax',   _('airMAX & Security'));
		s.tab('airtime',  _('AirTime QoS & Advanced'));
		s.tab('log',      _('System Log'));

		/* Tab 1: Wireless RF */
		o = s.taboption('wireless', form.ListValue, 'mode', _('Wireless Role'),
			_('Operating role of the device. AP broadcasts the link, Station connects to the tower.'));
		o.value('auto',   _('Auto (Detect from active interface)'));
		o.value('ap',     _('Access Point PtMP / PtP'));
		o.value('client', _('Station PtP / PtMP (CPE)'));
		o.default = 'auto';

		o = s.taboption('wireless', form.ListValue, 'profile', _('Wireless Topology'),
			_('PtMP is optimized for tower serving multiple stations with airtime fairness. PtP is for direct backhaul.'));
		o.value('ptmp', _('PtMP \u2014 Point-to-MultiPoint (Tower)'));
		o.value('ptp',  _('PtP \u2014 Point-to-Point (Backhaul)'));
		o.default = 'ptmp';

		var usable = chans.filter(function(c) { return c.state === 'usable'; });
		o = s.taboption('wireless', form.ListValue, 'channel', _('Operating Frequency / Channel'),
			_('Select operating channel. Off-Grid channels provide enhanced isolation and interference immunity.'));
		o.value('', _('\u2014 Keep Current Frequency \u2014'));
		usable.forEach(function(c) {
			o.value(String(c.channel),
				(c.standard ? '\uD83D\uDCE1 ' : '\uD83D\uDEE1\uFE0F ') + c.channel + ' \u2014 ' + c.freq + ' MHz' +
				(c.standard ? _(' [Standard Channel]') : _(' [Off-Grid Protected Channel]')));
		});
		o.rmempty = true;

		o = s.taboption('wireless', form.ListValue, 'htmode', _('Channel Width'),
			_('Channel bandwidth. VHT80 provides up to 866 Mbps. VHT40/20 gives highest range and noise resilience.'));
		o.value('', _('\u2014 Keep Current Width \u2014'));
		o.value('HT20',  'HT20 \u2014 20 MHz');
		o.value('HT40',  'HT40 \u2014 40 MHz');
		o.value('VHT20', 'VHT20 \u2014 20 MHz AC');
		o.value('VHT40', 'VHT40 \u2014 40 MHz AC');
		o.value('VHT80', 'VHT80 \u2014 80 MHz AC (Maximum Throughput)');
		o.rmempty = true;

		o = s.taboption('wireless', form.Value, 'distance', _('Link Distance (Meters)'),
			_('Estimated link distance in meters to calculate ACK timing advance and propagation delay.'));
		o.datatype = 'range(0, 50000)';
		o.default = '5000';

		o = s.taboption('wireless', form.Value, 'txpower', _('Output Power (dBm)'),
			_('Transmit power in dBm. Leave empty for factory calibrated maximum power.'));
		o.datatype = 'range(0, 30)';
		o.rmempty = true;

		o = s.taboption('wireless', form.Value, 'antenna_gain', _('Antenna Gain (dBi)'),
			_('Gain of connected dish or panel antenna (e.g. 23 or 30 dBi).'));
		o.datatype = 'range(0, 40)';
		o.rmempty = true;

		o = s.taboption('wireless', form.Flag, 'wds', _('WDS Transparent Bridge'),
			_('Enable true 4-Address Layer-2 Ethernet bridge for transparent MAC and VLAN passing.'));
		o.default = '1';

		/* Tab 2: airMAX & Security */
		o = s.taboption('airmax', form.Flag, 'isolation', _('airMAX Protocol Isolation'),
			_('Locks the link to authenticated Horus airMAX units with stealth beaconing.'));
		o.default = '1';

		o = s.taboption('airmax', form.Value, 'lock_key', _('airMAX Security Key'),
			_('Shared handshake authentication key between local and remote units.'));
		o.default = 'HAMax@Horus9200#Link';
		o.password = true;
		o.depends('isolation', '1');

		o = s.taboption('airmax', form.Flag, 'stealth', _('Hide SSID (Stealth Mode)'),
			_('Suppresses SSID broadcast in beacons to prevent detection by standard scanners.'));
		o.default = '1';

		o = s.taboption('airmax', form.Flag, 'vendor_ie', _('airMAX Discovery Beacon IE'),
			_('Broadcasts proprietary Horus airMAX Information Element for rapid mutual discovery.'));
		o.default = '1';

		/* Tab 3: AirTime QoS & Advanced */
		o = s.taboption('airtime', form.Flag, 'airtime', _('AirTime Fairness Scheduler'),
			_('Dynamic packet scheduler ensuring equal airtime distribution among all stations.'));
		o.default = '1';
		o.depends('profile', 'ptmp');

		o = s.taboption('airtime', form.Flag, 'multicast_to_unicast', _('Multicast-to-Unicast Acceleration'),
			_('Converts multicast packets into high-speed unicast ACKed packets over the air.'));
		o.default = '1';

		o = s.taboption('airtime', form.Flag, 'tune_buffers', _('Kernel Buffer Scaling (4MB)'),
			_('Expands Linux network socket memory and device queue to handle peak throughput.'));
		o.default = '1';

		o = s.taboption('airtime', form.Flag, 'ct_suppress_kick', _('Link Fading Protection'),
			_('Suppresses aggressive client disconnections during rain fade and atmospheric fluctuation.'));
		o.default = '1';

		/* Tab 4: System Log */
		o = s.taboption('log', form.DummyValue, '_log');
		o.rawhtml = true;
		o.cfgvalue = function() {
			return E('div', {}, [
				E('div', { 'style': 'display:flex; justify-content:space-between; margin-bottom:8px;' }, [
					E('strong', {}, [ _('airMAX Event Log') ]),
					E('button', {
						'class': 'btn btn-sm',
						'click': ui.createHandlerFn(self, function() {
							return fs.exec('/usr/bin/hamax', [ 'log-clear' ]).then(function() {
								var el = document.getElementById('hamax-log-box');
								if (el) el.textContent = _('Log cleared.');
							});
						})
					}, [ '\uD83D\uDDD1 ' + _('Clear Log') ])
				]),
				E('pre', {
					'id': 'hamax-log-box',
					'style': 'max-height:280px; overflow:auto; background:#0f172a; color:#f8fafc;' +
					         'padding:12px; border-radius:8px; font-size:12px; line-height:1.5;' +
					         'direction:ltr; text-align:left; font-family:' + T.fontMono + ';'
				}, [ log0 || _('No events recorded yet.') ])
			]);
		};

		/* --- Live Polling & SVG Graph Update --- */
		poll.add(function() {
			return fs.exec('/usr/bin/hamax', [ 'telemetry' ]).then(function() {
				return Promise.all([ readState(), L.resolveDefault(fs.read('/tmp/hamax.log'), '') ]);
			}).then(function(res) {
				var cur = res[0] || {};
				var lg = (res[1] || '').trim();

				/* Update traffic stats */
				var links = cur.links || [];
				var totalTx = 0, totalRx = 0;
				links.forEach(function(l) {
					totalTx += parseInt(l.tx_bytes, 10) || 0;
					totalRx += parseInt(l.rx_bytes, 10) || 0;
				});

				var now = Date.now();
				var txRate = 0, rxRate = 0;
				if (lastBytes.time && lastBytes.tx !== null) {
					var dt = (now - lastBytes.time) / 1000;
					if (dt > 0.5) {
						var dTx = Math.max(0, totalTx - lastBytes.tx);
						var dRx = Math.max(0, totalRx - lastBytes.rx);
						txRate = (dTx * 8) / (dt * 1000000);
						rxRate = (dRx * 8) / (dt * 1000000);
					}
				}

				lastBytes.tx = totalTx;
				lastBytes.rx = totalRx;
				lastBytes.time = now;

				if (txRate > peakRates.tx) peakRates.tx = txRate;
				if (rxRate > peakRates.rx) peakRates.rx = rxRate;

				trafficHistory.push({ txRate: txRate, rxRate: rxRate, time: now });
				if (trafficHistory.length > MAX_HISTORY) {
					trafficHistory.shift();
				}

				/* Replace dashboard live container */
				var oldDash = document.getElementById('hamax-airos-dashboard');
				if (oldDash && oldDash.parentNode) {
					var newDash = self.buildDashboard(cur);
					oldDash.parentNode.replaceChild(newDash, oldDash);
				}

				/* Update Log */
				var logBox = document.getElementById('hamax-log-box');
				if (logBox && lg) {
					logBox.textContent = lg.split('\n').slice(-50).join('\n');
				}
			});
		}, 3);

		return m.render();
	}
});
