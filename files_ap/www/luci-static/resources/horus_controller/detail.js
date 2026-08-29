'use strict';
'require baseclass';
'require dom';
'require ui';
'require horus_controller.i18n as horusI18n';

return baseclass.extend({
	apDetailElements: null,

	createClientRow: function(c, apMac, state, ui) {
		var cmac = (c.mac || '').toUpperCase();
		var rUser = (state.radiusMap && state.radiusMap[cmac]) ? state.radiusMap[cmac] : {};
		var isRegistered = !!(rUser.name || rUser.username);
		var dispName = rUser.name || rUser.username || horusI18n.t('unregistered_client');
		var prof = rUser.profile ? '🪙 ' + rUser.profile : '';
		var quota = rUser.quota ? ' | 📊 ' + rUser.quota : '';
		var uptimeStr = rUser.uptime ? ' | ⏱️ ' + rUser.uptime : '';

		var sigVal = parseInt(c.signal, 10) || -100;
		var sigBadgeColor = sigVal >= -65 ? 'background:rgba(34,197,94,0.18); color:#4ade80; border:1px solid rgba(34,197,94,0.4);' :
						   (sigVal >= -75 ? 'background:rgba(245,158,11,0.18); color:#fbbf24; border:1px solid rgba(245,158,11,0.4);' :
											'background:rgba(239,68,68,0.18); color:#f87171; border:1px solid rgba(239,68,68,0.4);');

		var btnSteer = E('button', { class: 'btn-ctrl btn-ctrl-steer', title: 'Smart Steer to Best AP' }, horusI18n.t('steer'));
		btnSteer.onclick = function() {
			if (confirm('Steer client (' + cmac + ') to nearest AP?')) {
				fetch('/cgi-bin/horus_ap_action', { method: 'POST', body: JSON.stringify({ target_ap: apMac, action: 'steer_client', mac: cmac, ban_time: 3000 }) });
				ui.addNotification(null, E('p', '⚡ Smart steering command dispatched.'));
			}
		};

		var btnKick = E('button', { class: 'btn-ctrl btn-ctrl-kick', title: 'Disconnect Client' }, horusI18n.t('kick'));
		btnKick.onclick = function() {
			if (confirm('Kick client (' + cmac + ')?')) {
				fetch('/cgi-bin/horus_ap_action', { method: 'POST', body: JSON.stringify({ target_ap: apMac, action: 'kick', mac: cmac }) });
				ui.addNotification(null, E('p', 'Client disconnected.'));
			}
		};

		var btnBan = E('button', { class: 'btn-ctrl btn-ctrl-ban', title: 'Ban Client' }, horusI18n.t('ban'));
		btnBan.onclick = function() {
			if (confirm('Ban MAC (' + cmac + ') on all APs?')) {
				fetch('/cgi-bin/horus_ban_action', { method: 'POST', body: JSON.stringify({ action: 'ban', mac: cmac, scope: 'all', duration: 0 }) });
				ui.addNotification(null, E('p', 'Client banned.'));
			}
		};

		var vIcon = c.vendor_icon || '📱';
		var vName = c.vendor || horusI18n.t('unknown_device');

		var radBadge = isRegistered ? 
			E('span', { class: 'live-rad-badge', style: 'background:rgba(34,197,94,0.2); color:#4ade80; border:1px solid rgba(34,197,94,0.4); padding:2px 6px; border-radius:4px; font-size:10px; font-weight:800; white-space:nowrap;' }, '✔ SAS') :
			E('span', { class: 'live-rad-badge', style: 'background:rgba(148,163,184,0.15); color:#94a3b8; border:1px solid rgba(148,163,184,0.3); padding:2px 6px; border-radius:4px; font-size:10px; white-space:nowrap;' }, horusI18n.t('unregistered'));

		var tr = E('tr', { 'data-mac': cmac }, [
			// Col 1: MAC & Device Brand
			E('td', { style: 'white-space:nowrap;' }, [
				E('div', { class: 'live-cmac', style: 'font-family:monospace; font-weight:800; font-size:13px; color:#38bdf8;' }, cmac),
				E('div', { style: 'display:inline-flex; align-items:center; gap:4px; background:rgba(255,255,255,0.06); padding:2px 6px; border-radius:4px; font-size:11px; color:#cbd5e1; margin-top:4px;' }, [
					E('span', { class: 'live-vendor-icon' }, vIcon),
					E('span', { class: 'live-vendor-name', style: 'font-weight:600;' }, vName)
				])
			]),
			// Col 2: Subscriber & Radius
			E('td', {}, [
				E('div', { style: 'display:flex; align-items:center; gap:8px;' }, [
					E('span', { class: 'live-disp-name', style: 'color:#00e676; font-weight:800; font-size:14px;' }, dispName),
					radBadge
				]),
				E('div', { class: 'live-radius-details', style: 'font-size:11px; color:#94a3b8; margin-top:3px;' }, (prof || quota) ? (prof + quota + uptimeStr) : '')
			]),
			// Col 3: Live Speed Meter
			E('td', { style: 'white-space:nowrap;' }, [
				E('div', { class: 'speed-meter-box' }, [
					E('div', { class: 'speed-meter-row rx' }, [ E('span', {}, '⬇️ ' + horusI18n.t('download') + ':'), E('span', { class: 'live-rx-speed' }, c.rx_speed || '0 bps') ]),
					E('div', { class: 'speed-meter-row tx' }, [ E('span', {}, '⬆️ ' + horusI18n.t('upload') + ':'), E('span', { class: 'live-tx-speed' }, c.tx_speed || '0 bps') ])
				])
			]),
			// Col 4: Session Total Data
			E('td', { style: 'white-space:nowrap;' }, [
				E('div', { class: 'session-data-box' }, [
					E('div', { class: 'live-total-rx', style: 'color:#38bdf8;' }, '📥 ' + (c.total_rx || '-')),
					E('div', { class: 'live-total-tx', style: 'color:#4ade80;' }, '📤 ' + (c.total_tx || '-'))
				])
			]),
			// Col 5: Wireless Signal & PHY Rate
			E('td', { style: 'text-align:center; white-space:nowrap;' }, [
				E('div', { class: 'wireless-health-box' }, [
					E('span', { class: 'live-signal-badge', style: 'padding:3px 8px; border-radius:6px; font-weight:800; font-size:12px;' + sigBadgeColor }, (c.signal || '-') + ' dBm'),
					E('span', { class: 'live-link-rate', style: 'font-size:11px; color:#94a3b8; font-family:monospace;' }, '📶 ' + (c.link_rate || '-'))
				])
			]),
			// Col 6: IP & Interface
			E('td', { style: 'white-space:nowrap;' }, [
				E('div', { class: 'live-ip', style: 'font-family:monospace; font-weight:700; color:#f8fafc; font-size:12px;' }, rUser.ip || '-'),
				E('div', { class: 'live-iface', style: 'font-size:11px; color:#64748b;' }, c.iface || '-')
			]),
			// Col 7: Actions Group
			E('td', { style: 'text-align:center; white-space:nowrap;' }, [
				E('div', { class: 'client-ctrl-group' }, [btnSteer, btnKick, btnBan])
			])
		]);

		return tr;
	},

	updateClientsTableInPlace: function(tbody, clientsList, apMac, state, ui) {
		var self = this;
		if (!tbody) return;

		if (!clientsList || clientsList.length === 0) {
			var emptyRow = tbody.querySelector('.empty-clients-row');
			if (!emptyRow) {
				dom.content(tbody, [
					E('tr', { class: 'empty-clients-row' }, E('td', { colspan: 7, style: 'text-align:center; padding:30px; color:#64748b; font-size:14px;' }, 'No wireless clients currently connected to this AP.'))
				]);
			}
			return;
		}

		var emptyPlaceholder = tbody.querySelector('.empty-clients-row');
		if (emptyPlaceholder) emptyPlaceholder.remove();

		var activeMacSet = new Set();

		clientsList.forEach(function(c) {
			var cmac = (c.mac || '').toUpperCase();
			activeMacSet.add(cmac);

			var existingRow = tbody.querySelector('tr[data-mac="' + cmac + '"]');
			if (existingRow) {
				var elRxSpeed = existingRow.querySelector('.live-rx-speed');
				if (elRxSpeed && elRxSpeed.textContent !== (c.rx_speed || '0 bps')) elRxSpeed.textContent = c.rx_speed || '0 bps';

				var elTxSpeed = existingRow.querySelector('.live-tx-speed');
				if (elTxSpeed && elTxSpeed.textContent !== (c.tx_speed || '0 bps')) elTxSpeed.textContent = c.tx_speed || '0 bps';

				var elTotalRx = existingRow.querySelector('.live-total-rx');
				if (elTotalRx && elTotalRx.textContent !== ('📥 ' + (c.total_rx || '-'))) elTotalRx.textContent = '📥 ' + (c.total_rx || '-');

				var elTotalTx = existingRow.querySelector('.live-total-tx');
				if (elTotalTx && elTotalTx.textContent !== ('📤 ' + (c.total_tx || '-'))) elTotalTx.textContent = '📤 ' + (c.total_tx || '-');

				var elSig = existingRow.querySelector('.live-signal-badge');
				if (elSig) {
					var sigVal = parseInt(c.signal, 10) || -100;
					var sText = (c.signal || '-') + ' dBm';
					if (elSig.textContent !== sText) elSig.textContent = sText;
					var bCol = sigVal >= -65 ? 'rgba(34,197,94,0.18)' : (sigVal >= -75 ? 'rgba(245,158,11,0.18)' : 'rgba(239,68,68,0.18)');
					var tCol = sigVal >= -65 ? '#4ade80' : (sigVal >= -75 ? '#fbbf24' : '#f87171');
					elSig.style.background = bCol;
					elSig.style.color = tCol;
				}

				var elRate = existingRow.querySelector('.live-link-rate');
				if (elRate && elRate.textContent !== ('📶 ' + (c.link_rate || '-'))) elRate.textContent = '📶 ' + (c.link_rate || '-');

				var rUser = (state.radiusMap && state.radiusMap[cmac]) ? state.radiusMap[cmac] : {};
				var elIp = existingRow.querySelector('.live-ip');
				if (elIp && elIp.textContent !== (rUser.ip || '-')) elIp.textContent = rUser.ip || '-';

				var dispName = rUser.name || rUser.username || horusI18n.t('unregistered_client');
				var elName = existingRow.querySelector('.live-disp-name');
				if (elName && elName.textContent !== dispName) elName.textContent = dispName;
			} else {
				tbody.appendChild(self.createClientRow(c, apMac, state, ui));
			}
		});

		var currentRows = tbody.querySelectorAll('tr[data-mac]');
		currentRows.forEach(function(r) {
			var rMac = r.getAttribute('data-mac');
			if (rMac && !activeMacSet.has(rMac)) {
				r.remove();
			}
		});
	},

	buildApDetailView: function(apMac, state, viewApDetail, backCb, ui) {
		var self = this;
		var ap = (state.data && state.data.aps && state.data.aps[apMac]) ? state.data.aps[apMac] : {};
		var wifiList = ap.wifi || [];
		var portsList = ap.ports || [];
		var clientsList = ap.clients || [];

		dom.content(viewApDetail, []);

		// Top Header Card with Back Button
		var btnBack = E('button', { class: 'btn-back' }, horusI18n.t('back_to_dash'));
		btnBack.onclick = function() {
			if (typeof backCb === 'function') backCb();
		};

		var headerBox = E('div', { class: 'ap-detail-header' }, [
			E('div', {}, [
				E('h2', { class: 'ap-detail-title' }, [
					E('span', {}, '📡 ' + (ap.hostname || 'Horus-AP')),
					E('span', { class: 'badge', style: 'font-size:12px; background:rgba(34,197,94,0.2); color:#4ade80; border:1px solid rgba(34,197,94,0.4); padding:3px 10px; border-radius:20px;' }, horusI18n.t('connected_hmp'))
				]),
				E('div', { style: 'font-size:13px; color:#94a3b8; font-family:monospace; margin-top:5px;' }, 'MAC: ' + apMac + ' | LAN IP: ' + (ap.ip || '-'))
			]),
			E('div', { style: 'display:flex; gap:10px;' }, [
				E('button', { class: 'btn-action btn-reboot', style: 'padding:9px 18px; font-size:13px;' }, horusI18n.t('reboot_ap')),
				btnBack
			])
		]);
		headerBox.querySelector('.btn-reboot').onclick = function() {
			if (confirm('Reboot AP (' + apMac + ')?')) {
				fetch('/cgi-bin/horus_ap_action', { method: 'POST', body: JSON.stringify({ target_ap: apMac, action: 'reboot' }) });
				ui.addNotification(null, E('p', 'Reboot command sent.'));
			}
		};
		viewApDetail.appendChild(headerBox);

		// Real-Time Speed & Capacity Metrics Banner
		var st = ap.stats || {};
		var mRxSpeed = E('h3', { style: 'color:#38bdf8; font-size:22px; margin:0;' }, '⬇️ ' + (st.rx_speed || '0 bps'));
		var mRxTotal = E('p', { style: 'color:#94a3b8; font-size:12px; margin:4px 0 0 0;' }, horusI18n.t('rx_live_total') + ' ' + (st.total_rx || '-'));

		var mTxSpeed = E('h3', { style: 'color:#4ade80; font-size:22px; margin:0;' }, '⬆️ ' + (st.tx_speed || '0 bps'));
		var mTxTotal = E('p', { style: 'color:#94a3b8; font-size:12px; margin:4px 0 0 0;' }, horusI18n.t('tx_live_total') + ' ' + (st.total_tx || '-'));

		var mClients = E('h3', { style: 'color:#fbbf24; font-size:22px; margin:0;' }, '👥 ' + clientsList.length);
		var mClientsDesc = E('p', { style: 'color:#94a3b8; font-size:12px; margin:4px 0 0 0;' }, horusI18n.t('active_wifi_clients'));

		var mCpuStats = E('h3', { style: 'color:#a855f7; font-size:20px; margin:0;' }, '🧠 ' + (st.cpu_load || '0.0') + ' | 💾 ' + (st.mem_pct || 0) + '%' + ((st.cpu_temp && st.cpu_temp !== '-') ? ' | 🌡️ ' + st.cpu_temp : ''));
		var mCpuDesc = E('p', { style: 'color:#94a3b8; font-size:12px; margin:4px 0 0 0;' }, horusI18n.t('cpu_mem_temp'));

		var statsBanner = E('div', { style: 'display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:14px; margin-bottom: 20px;' }, [
			E('div', { class: 'dash-card', style: 'border:1px solid rgba(56,189,248,0.3); background:rgba(15,23,42,0.6); padding:16px; border-radius:10px;' }, [ mRxSpeed, mRxTotal ]),
			E('div', { class: 'dash-card', style: 'border:1px solid rgba(34,197,94,0.3); background:rgba(15,23,42,0.6); padding:16px; border-radius:10px;' }, [ mTxSpeed, mTxTotal ]),
			E('div', { class: 'dash-card', style: 'border:1px solid rgba(251,191,36,0.3); background:rgba(15,23,42,0.6); padding:16px; border-radius:10px;' }, [ mClients, mClientsDesc ]),
			E('div', { class: 'dash-card', style: 'border:1px solid rgba(168,85,247,0.3); background:rgba(15,23,42,0.6); padding:16px; border-radius:10px;' }, [ mCpuStats, mCpuDesc ])
		]);
		viewApDetail.appendChild(statsBanner);

		// --- Section 1: Independent Radios (2.4GHz & 5GHz) ---
		var radiosGrid = E('div', { class: 'radios-grid' });

		var radio2g = wifiList.find(function(w){ return w.band_code === '2g' || w.band === '2.4GHz' || w.channel <= 14; }) || { band: '2.4GHz', band_code: '2g', channel: '1', htmode: 'HT20', ssid: 'RedaNet LG', noise: '-87 dBm', disabled: false };
		var radio5g = wifiList.find(function(w){ return w.band_code === '5g' || w.band === '5GHz' || w.channel >= 36; }) || { band: '5GHz', band_code: '5g', channel: '157', htmode: 'VHT80', ssid: 'ras2ac', noise: '-92 dBm', disabled: false };

		function buildRadioCard(rData, is5G) {
			var bTitle = is5G ? horusI18n.t('radio_5g_title') : horusI18n.t('radio_2g_title');
			var cardColor = is5G ? '#38bdf8' : '#4ade80';

			var inSsid = E('input', { type: 'text', value: rData.ssid || '', placeholder: 'SSID' });
			var inPass = E('input', { type: 'password', placeholder: 'Password' });
			var inChan = E('select', {});
			inChan.appendChild(E('option', { value: '' }, 'Current (' + (rData.channel || 'Auto') + ')'));
			inChan.appendChild(E('option', { value: 'auto' }, 'Auto'));
			if (!is5G) {
				for (var c = 1; c <= 13; c++) inChan.appendChild(E('option', { value: c.toString() }, 'Channel ' + c));
			} else {
				[36, 40, 44, 48, 149, 153, 157, 161, 165].forEach(function(c5){ inChan.appendChild(E('option', { value: c5.toString() }, 'Channel ' + c5)); });
			}

			var inHt = E('select', {}, [
				E('option', { value: '' }, 'Current (' + (rData.htmode || '-') + ')'),
				E('option', { value: 'HT20' }, '20 MHz'),
				E('option', { value: 'HT40' }, '40 MHz'),
				E('option', { value: 'VHT80' }, '80 MHz')
			]);

			var noiseValSpan = E('span', { style: 'color:#38bdf8; font-weight:bold; font-family:monospace;' }, (rData.noise || '-') + ' ' + horusI18n.t('clean_env'));
			var noiseDisplay = E('div', { style: 'margin: 6px 0 12px 0; font-size:12px; color:#cbd5e1; background:rgba(0,0,0,0.25); padding:6px 10px; border-radius:6px; display:flex; justify-content:space-between;' }, [
				E('span', {}, horusI18n.t('noise_floor')),
				noiseValSpan
			]);

			var btnSave = E('button', { class: 'btn-primary', style: 'width:100%; margin-top:8px;' }, horusI18n.t('save_radio_settings') + ' ' + (is5G ? '5G' : '2.4G'));
			btnSave.onclick = function() {
				btnSave.disabled = true;
				fetch('/cgi-bin/horus_wifi_action', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						target_ap: apMac,
						action: 'apply_profile',
						band: is5G ? '5g' : '2g',
						ssid: inSsid.value.trim(),
						password: inPass.value.trim(),
						channel: inChan.value,
						htmode: inHt.value
					})
				}).then(function(){
					btnSave.disabled = false;
					ui.addNotification(null, E('p', '✅ Radio settings saved successfully.'));
				});
			};

			var btnRestart = E('button', { class: 'btn-sm-op', style: 'background:rgba(56,189,248,0.2); color:#38bdf8; border:1px solid rgba(56,189,248,0.4);' }, horusI18n.t('restart_radio') + ' ' + (is5G ? '5G' : '2.4G'));
			btnRestart.onclick = function() {
				fetch('/cgi-bin/horus_wifi_action', { method: 'POST', body: JSON.stringify({ target_ap: apMac, action: 'radio_restart', radio: is5G ? 'radio1' : 'radio0' }) });
				ui.addNotification(null, E('p', 'Radio restarted.'));
			};

			var btnToggle = E('button', { class: 'btn-sm-op', style: rData.disabled ? 'background:rgba(34,197,94,0.2); color:#4ade80; border:1px solid rgba(34,197,94,0.4);' : 'background:rgba(239,68,68,0.2); color:#f87171; border:1px solid rgba(239,68,68,0.4);' }, rData.disabled ? horusI18n.t('toggle_radio_on') : horusI18n.t('toggle_radio_off'));
			btnToggle.onclick = function() {
				var nextState = rData.disabled ? '0' : '1';
				fetch('/cgi-bin/horus_ap_action', { method: 'POST', body: JSON.stringify({ target_ap: apMac, action: 'radio_toggle', radio: is5G ? 'radio1' : 'radio0', state: nextState }) });
				ui.addNotification(null, E('p', (nextState === '0' ? 'Enabled' : 'Disabled') + ' Radio ' + (is5G ? '5G' : '2.4G')));
			};

			return E('div', { class: 'radio-card' }, [
				E('div', { class: 'radio-header' }, [
					E('h4', { class: 'radio-title', style: 'color:' + cardColor }, bTitle),
					E('span', { style: 'font-size:12px; font-weight:700; color:' + (rData.disabled ? '#ef4444' : '#22c55e') }, rData.disabled ? horusI18n.t('stopped') : horusI18n.t('running'))
				]),
				noiseDisplay,
				E('div', { class: 'radio-ops' }, [ btnRestart, btnToggle ]),
				E('div', { class: 'form-row' }, [
					E('div', { class: 'form-field' }, [ E('label', {}, horusI18n.t('ssid_name')), inSsid ]),
					E('div', { class: 'form-field' }, [ E('label', {}, horusI18n.t('new_password')), inPass ])
				]),
				E('div', { class: 'form-row' }, [
					E('div', { class: 'form-field' }, [ E('label', {}, horusI18n.t('current_channel') + ' ' + (rData.channel || 'Auto')), inChan ]),
					E('div', { class: 'form-field' }, [ E('label', {}, horusI18n.t('channel_width') + ' ' + (rData.htmode || '-')), inHt ])
				]),
				btnSave
			]);
		}

		radiosGrid.appendChild(buildRadioCard(radio2g, false));
		radiosGrid.appendChild(buildRadioCard(radio5g, true));
		viewApDetail.appendChild(radiosGrid);

		// --- Section 2: Ethernet Ports Status & Wired Clients ---
		var portsSection = E('div', { class: 'glass-card' }, [
			E('h3', { style: 'margin-top:0; color:#38bdf8; font-size:17px; display:flex; align-items:center; gap:8px;' }, horusI18n.t('wired_ports_title')),
			E('p', { style: 'font-size:13px; color:#94a3b8; margin:0 0 16px 0;' }, horusI18n.t('wired_ports_desc'))
		]);

		var portsGrid = E('div', { class: 'ports-grid', id: 'detail_ports_grid' });
		if (portsList.length === 0) {
			portsGrid.appendChild(E('div', { style: 'color:#64748b; font-size:13px;' }, 'Reading wired ports via HMP...'));
		} else {
			portsList.forEach(function(p) {
				var isUp = !!p.is_up;
				var isEnabled = (p.is_enabled !== undefined) ? !!p.is_enabled : (p.state !== 'down');
				var hasCable = isUp && (p.carrier === 1 || p.speed > 0);

				var statusBadge = '';
				var statusClass = '';
				if (hasCable) {
					statusBadge = '🟢 ' + (p.speed_str || horusI18n.t('port_cable_connected'));
					statusClass = 'port-status-up';
				} else if (isEnabled) {
					statusBadge = horusI18n.t('port_enabled_no_cable');
					statusClass = 'port-status-down';
				} else {
					statusBadge = horusI18n.t('port_disabled_admin');
					statusClass = 'port-status-down';
				}

				var pCard = E('div', { class: 'port-card' }, [
					E('div', { class: 'port-header' }, [
						E('span', { class: 'port-name' }, '🔌 ' + p.label),
						E('span', { class: statusClass, style: 'font-size:11px; font-weight:700;' }, statusBadge)
					])
				]);

				var btnPortToggle = E('button', {
					class: 'btn-sm-op',
					style: isEnabled ? 'background:rgba(239,68,68,0.18); color:#f87171; border:1px solid rgba(239,68,68,0.35);' : 'background:rgba(34,197,94,0.18); color:#4ade80; border:1px solid rgba(34,197,94,0.35);'
				}, isEnabled ? horusI18n.t('disable_port') : horusI18n.t('enable_port'));

				btnPortToggle.onclick = function() {
					var nState = isEnabled ? 'down' : 'up';
					fetch('/cgi-bin/horus_ap_action', { method: 'POST', body: JSON.stringify({ target_ap: apMac, action: 'port_state', port: p.port, state: nState }) });
					ui.addNotification(null, E('p', 'Command dispatched for port: ' + p.label));
				};
				pCard.appendChild(btnPortToggle);

				if (p.clients && p.clients.length > 0) {
					var cHtml = [];
					p.clients.forEach(function(cl) {
						var rUser = (state.radiusMap && state.radiusMap[cl.mac]) ? state.radiusMap[cl.mac] : {};
						var cName = rUser.name || rUser.username || cl.mac;
						cHtml.push(E('div', { style: 'margin-top:4px; padding:3px 6px; background:rgba(255,255,255,0.05); border-radius:4px;' }, [
							E('div', { style: 'color:#00e676; font-weight:700;' }, '💻 ' + cName),
							E('div', { style: 'color:#94a3b8; font-size:10px;' }, cl.mac + (cl.ip ? ' (' + cl.ip + ')' : ''))
						]));
					});
					pCard.appendChild(E('div', { class: 'port-clients-list' }, [
						E('div', { style: 'font-weight:700; color:#cbd5e1; margin-top:6px;' }, horusI18n.t('connected_wired_clients') + ' (' + p.clients.length + '):'),
						E('div', {}, cHtml)
					]));
				}
				portsGrid.appendChild(pCard);
			});
		}
		portsSection.appendChild(portsGrid);
		viewApDetail.appendChild(portsSection);

		// --- Section 3: Wireless Connected Clients on this AP ---
		var clientsSection = E('div', { class: 'glass-card' }, [
			E('h3', { id: 'detail_clients_heading', style: 'margin-top:0; color:#fbbf24; font-size:17px;' }, horusI18n.t('wifi_subscribers_title') + ' (' + clientsList.length + ')')
		]);

		var detailClientsTbody = E('tbody', { id: 'detail_clients_tbody' });
		if (clientsList.length === 0) {
			detailClientsTbody.appendChild(E('tr', { class: 'empty-clients-row' }, E('td', { colspan: 7, style: 'text-align:center; padding:30px; color:#64748b; font-size:14px;' }, 'No wireless clients currently connected to this AP.')));
		} else {
			clientsList.forEach(function(c) {
				detailClientsTbody.appendChild(self.createClientRow(c, apMac, state, ui));
			});
		}

		clientsSection.appendChild(E('div', { class: 'table-box' }, [
			E('table', { class: 'custom-table' }, [
				E('thead', {}, [
					E('tr', {}, [
						E('th', {}, horusI18n.t('mac_brand')),
						E('th', {}, horusI18n.t('subscriber_radius')),
						E('th', {}, horusI18n.t('live_speed')),
						E('th', {}, horusI18n.t('total_session')),
						E('th', { style: 'text-align:center;' }, horusI18n.t('signal_rate')),
						E('th', {}, horusI18n.t('network_ip')),
						E('th', { style: 'text-align:center;' }, horusI18n.t('client_actions'))
					])
				]),
				detailClientsTbody
			])
		]));
		viewApDetail.appendChild(clientsSection);

		// --- Section 4: Remote IP & Admin Password Settings ---
		var inNewIp = E('input', { type: 'text', value: ap.ip !== '-' ? ap.ip : '', placeholder: '192.168.169.224' });
		var inNetmask = E('input', { type: 'text', value: '255.255.255.0', placeholder: '255.255.255.0' });
		var inGateway = E('input', { type: 'text', value: '192.168.169.1', placeholder: '192.168.169.1' });
		var inHostname = E('input', { type: 'text', value: ap.hostname || '', placeholder: 'AP Hostname' });
		var inApAdminPass = E('input', { type: 'password', placeholder: 'New Admin Password' });

		var btnApplyIp = E('button', { class: 'btn-primary' }, horusI18n.t('apply_remote_ip_btn'));
		btnApplyIp.onclick = function() {
			var newIp = inNewIp.value.trim();
			var newHost = inHostname.value.trim();
			var newPass = inApAdminPass.value.trim();

			if (!newIp && !newHost && !newPass) { alert('Please enter new IP, Hostname, or Password.'); return; }

			btnApplyIp.disabled = true;
			var payload = { target_ap: apMac, action: 'set_ip', ip: newIp, netmask: inNetmask.value.trim(), gateway: inGateway.value.trim(), hostname: newHost };
			fetch('/cgi-bin/horus_ap_action', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			}).then(function(){
				if (newPass) {
					fetch('/cgi-bin/horus_ap_action', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ target_ap: apMac, action: 'admin_password', password: newPass })
					});
				}
				btnApplyIp.disabled = false;
				ui.addNotification(null, E('p', '✅ Network and credentials applied via HMP.'));
			}).catch(function(){ btnApplyIp.disabled = false; });
		};

		var ipSection = E('div', { class: 'glass-card' }, [
			E('h3', { style: 'margin-top:0; color:#a855f7; font-size:17px;' }, horusI18n.t('remote_ip_admin_title')),
			E('div', { class: 'form-row' }, [
				E('div', { class: 'form-field' }, [ E('label', {}, horusI18n.t('ap_name_host') + ':'), inHostname ]),
				E('div', { class: 'form-field' }, [ E('label', {}, horusI18n.t('new_ip')), inNewIp ]),
				E('div', { class: 'form-field' }, [ E('label', {}, horusI18n.t('netmask')), inNetmask ]),
				E('div', { class: 'form-field' }, [ E('label', {}, horusI18n.t('gateway')), inGateway ]),
				E('div', { class: 'form-field' }, [ E('label', {}, horusI18n.t('admin_password')), inApAdminPass ])
			]),
			btnApplyIp
		]);
		viewApDetail.appendChild(ipSection);

		// Cache Element references for silent in-place updates
		self.apDetailElements = {
			apMac: apMac,
			mRxSpeed: mRxSpeed,
			mRxTotal: mRxTotal,
			mTxSpeed: mTxSpeed,
			mTxTotal: mTxTotal,
			mClients: mClients,
			mCpuStats: mCpuStats,
			detailClientsHeading: clientsSection.querySelector('#detail_clients_heading'),
			detailClientsTbody: detailClientsTbody
		};
	},

	updateApDetailLive: function(apMac, state, ui) {
		var self = this;
		if (!self.apDetailElements || self.apDetailElements.apMac !== apMac) {
			return false;
		}

		var ap = (state.data && state.data.aps && state.data.aps[apMac]) ? state.data.aps[apMac] : {};
		var st = ap.stats || {};
		var clientsList = ap.clients || [];

		// 1. Update Metrics smoothly in-place
		if (self.apDetailElements.mRxSpeed) self.apDetailElements.mRxSpeed.textContent = '⬇️ ' + (st.rx_speed || '0 bps');
		if (self.apDetailElements.mRxTotal) self.apDetailElements.mRxTotal.textContent = horusI18n.t('rx_live_total') + ' ' + (st.total_rx || '-');
		if (self.apDetailElements.mTxSpeed) self.apDetailElements.mTxSpeed.textContent = '⬆️ ' + (st.tx_speed || '0 bps');
		if (self.apDetailElements.mTxTotal) self.apDetailElements.mTxTotal.textContent = horusI18n.t('tx_live_total') + ' ' + (st.total_tx || '-');
		if (self.apDetailElements.mClients) self.apDetailElements.mClients.textContent = '👥 ' + clientsList.length;
		if (self.apDetailElements.mCpuStats) self.apDetailElements.mCpuStats.textContent = '🧠 ' + (st.cpu_load || '0.0') + ' | 💾 ' + (st.mem_pct || 0) + '%' + ((st.cpu_temp && st.cpu_temp !== '-') ? ' | 🌡️ ' + st.cpu_temp : '');

		// 2. Update Clients Heading & in-place Row Reconciliation
		if (self.apDetailElements.detailClientsHeading) {
			self.apDetailElements.detailClientsHeading.textContent = horusI18n.t('wifi_subscribers_title') + ' (' + clientsList.length + ')';
		}
		if (self.apDetailElements.detailClientsTbody) {
			self.updateClientsTableInPlace(self.apDetailElements.detailClientsTbody, clientsList, apMac, state, ui);
		}
		return true;
	}
});
