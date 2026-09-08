'use strict';

/*
 * Horus AirMax (HAMax) - presentation helpers.
 *
 * Pure functions and the theme palette, split out of view/hamax/settings.js so
 * the view file carries only its render body. Nothing here touches uci, fs or
 * the DOM: every function maps its arguments to a value, which is what makes
 * them testable and safe to reuse from other HAMax views.
 *
 * Required as:  'require hamax.format'
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


/* Helper: decode UTF-8 escaped SSID (such as Arabic characters) */
function decodeSSID(s) {
	if (!s) return '';
	try {
		return s.replace(/\\x([0-9a-fA-F]{2})/g, function(m, p) {
			return '%' + p;
		}).replace(/(%[0-9a-fA-F]{2})+/g, function(m) {
			try { return decodeURIComponent(m); } catch (e) { return m; }
		});
	} catch (e) {
		return s;
	}
}

/* Helper: calculate realistic RF distance from signal & frequency (Log-Distance model) */
function estimateDistanceMeters(sig, freq) {
	var s = parseInt(sig, 10);
	if (isNaN(s)) return 1000;
	var f = freq ? parseInt(freq, 10) : 2462;
	var ref = (f > 4000) ? 47 : 40;
	var pl = 24 - s;
	if (pl <= ref) return 1.0;
	var dist = Math.pow(10, (pl - ref) / 24.0);
	return Math.max(1.0, Math.round(dist * 10) / 10);
}

/* Helper: format distance string nicely */
function formatDistance(distMeters) {
	if (distMeters <= 2.5) {
		return distMeters.toFixed(1) + ' m (' + (distMeters * 3.28).toFixed(1) + ' ft) — Near Field';
	} else if (distMeters < 100) {
		return Math.round(distMeters) + ' m (' + Math.round(distMeters * 3.28) + ' ft)';
	} else if (distMeters < 1000) {
		return Math.round(distMeters) + ' m';
	} else {
		return (distMeters / 1000).toFixed(2) + ' km (' + (distMeters / 1609.34).toFixed(2) + ' mi)';
	}
}

/* Helper: resolve device label and brand from MAC / Hostname */
function getDeviceLabel(link) {
	if (!link) return 'Remote Station';
	if (link.name && link.name !== '' && !link.name.startsWith('Station-')) {
		return link.name;
	}
	var mac = (link.mac || '').toLowerCase();
	if (mac.length >= 17) {
		var c2 = mac.charAt(1);
		if (c2 === '2' || c2 === '6' || c2 === 'a' || c2 === 'e') {
			return 'Smartphone (Private MAC)';
		}
		var oui = mac.substring(0, 8).toUpperCase();
		if (/^(00:27:22|04:18:D6|24:5A:4C|68:D7:9A|70:A7:41|DC:9F:DB|F4:92:BF)/.test(oui)) return 'Ubiquiti airMAX';
		if (/^(00:0C:42|48:8F:5A|64:D1:54|B8:69:F4|CC:2D:E0)/.test(oui)) return 'MikroTik Router';
		if (/^(AC:BC:32|F0:18:98|BC:D0:74|00:1A:11|3C:07:54)/.test(oui)) return 'Apple Device';
		if (/^(00:12:FB|00:26:37|34:23:87|50:01:D9|88:32:9B)/.test(oui)) return 'Samsung Device';
		if (/^(00:07:89)/.test(oui)) return 'Horus Device';
	}
	return link.name || ('Station-' + (link.mac ? link.mac.substring(12, 17) : ''));
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


return L.Class.extend({
	T:                     T,
	parseModulation:       parseModulation,
	decodeSSID:            decodeSSID,
	estimateDistanceMeters: estimateDistanceMeters,
	formatDistance:        formatDistance,
	getDeviceLabel:        getDeviceLabel,
	calcAirmaxMetrics:     calcAirmaxMetrics
});
