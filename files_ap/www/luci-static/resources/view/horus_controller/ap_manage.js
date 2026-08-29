'use strict';
'require view';
'require ui';
'require dom';

return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	render: function() {
		var container = E('div', { class: 'horus-ap-view', style: 'direction:rtl; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;' });

		// Styles
		var styles = E('style', {}, `
			.horus-ap-view { color: #f8fafc; }
			.glass-card { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4); }
			.card-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 14px; margin-bottom: 20px; }
			.card-title { font-size: 18px; font-weight: 700; color: #00e676; margin: 0; display: flex; align-items: center; gap: 8px; }
			.card-desc { font-size: 13px; color: #94a3b8; margin: 4px 0 0 0; }
			
			.form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 20px; }
			.form-group { display: flex; flex-direction: column; gap: 6px; }
			.form-label { font-size: 13px; font-weight: 600; color: #cbd5e1; display: flex; align-items: center; gap: 6px; }
			.form-control { background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 10px 14px; color: #f8fafc; font-size: 14px; outline: none; transition: all 0.2s; }
			.form-control:focus { border-color: #00e676; box-shadow: 0 0 0 3px rgba(0, 230, 118, 0.2); }
			
			/* AP Selection Grid */
			.ap-select-box { background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 16px; margin-bottom: 22px; }
			.ap-select-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px; }
			.ap-select-title { font-size: 14px; font-weight: bold; color: #38bdf8; display: flex; align-items: center; gap: 6px; }
			.ap-tools { display: flex; gap: 8px; }
			.btn-tool { padding: 4px 12px; font-size: 12px; font-weight: 600; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.05); color: #cbd5e1; cursor: pointer; transition: 0.2s; }
			.btn-tool:hover { background: rgba(255,255,255,0.15); color: #fff; }
			
			.ap-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; max-height: 240px; overflow-y: auto; padding: 4px; }
			.ap-tile { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; cursor: pointer; transition: all 0.2s; user-select: none; }
			.ap-tile:hover { background: rgba(51, 65, 85, 0.6); border-color: rgba(255, 255, 255, 0.25); }
			.ap-tile.selected { background: rgba(0, 230, 118, 0.12); border-color: #00e676; box-shadow: 0 0 10px rgba(0, 230, 118, 0.15); }
			.ap-tile input[type="checkbox"] { width: 18px; height: 18px; accent-color: #00e676; cursor: pointer; }
			.ap-tile-info { display: flex; flex-direction: column; gap: 2px; }
			.ap-tile-name { font-size: 13px; font-weight: 700; color: #f8fafc; }
			.ap-tile-sub { font-size: 11px; color: #94a3b8; font-family: monospace; }
			
			/* Buttons */
			.btn-submit-ip { width: 100%; padding: 14px; background: linear-gradient(135deg, #00e676 0%, #00b0ff 100%); color: #000; border: none; border-radius: 8px; font-size: 15px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 15px rgba(0, 230, 118, 0.3); transition: all 0.2s; }
			.btn-submit-ip:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0, 230, 118, 0.45); }
			
			.btn-op { flex: 1; min-width: 180px; padding: 12px 18px; border: none; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.2s; }
			.btn-op-reboot { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); }
			.btn-op-reboot:hover { background: #f59e0b; color: #000; }
			.btn-op-wifi { background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); }
			.btn-op-wifi:hover { background: #38bdf8; color: #000; }
			.btn-op-off { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); }
			.btn-op-off:hover { background: #ef4444; color: #fff; }
			.btn-op-on { background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.4); }
			.btn-op-on:hover { background: #22c55e; color: #000; }
		`);
		container.appendChild(styles);

		var inNewIp = E('input', { class: 'form-control', type: 'text', placeholder: 'مثال: 192.168.169.224' });
		var inNetmask = E('input', { class: 'form-control', type: 'text', value: '255.255.255.0', placeholder: '255.255.255.0' });
		var inGateway = E('input', { class: 'form-control', type: 'text', value: '192.168.169.1', placeholder: '192.168.169.1' });
		var inHostname = E('input', { class: 'form-control', type: 'text', placeholder: 'مثال: AP-LivingRoom' });
		var inTxpower = E('input', { class: 'form-control', type: 'number', placeholder: 'مثال: 23' });

		var apGrid = E('div', { class: 'ap-grid' });
		var btnSelectAll = E('button', { class: 'btn-tool', type: 'button' }, '✅ تحديد الكل');
		var btnDeselectAll = E('button', { class: 'btn-tool', type: 'button' }, '❌ إلغاء التحديد');
		var selectedCountBadge = E('span', { style: 'color:#00e676; font-weight:bold; font-size:12px;' }, '(تم تحديد 0 إكسس)');

		var btnSubmitIp = E('button', { class: 'btn-submit-ip' }, '💾 تطبيق عنوان الـ IP والشبكة على الإكسس المختار عبر HMP');

		// Card 1: IP & Network Form
		var cardIp = E('div', { class: 'glass-card' }, [
			E('div', { class: 'card-header' }, [
				E('div', {}, [
					E('h3', { class: 'card-title' }, '🌐 إدارة الشبكة وعناوين الـ IP عن بعد (Remote Network Configuration)'),
					E('p', { class: 'card-desc' }, 'تغيير عنوان الآي بي واسم الجهاز وقناع الشبكة عبر طبقة Layer 2 HMP.')
				])
			]),
			E('div', { class: 'ap-select-box' }, [
				E('div', { class: 'ap-select-header' }, [
					E('div', { class: 'ap-select-title' }, [
						E('span', {}, '🎯 اختيار الإكسس المستهدف:'),
						selectedCountBadge
					]),
					E('div', { class: 'ap-tools' }, [ btnSelectAll, btnDeselectAll ])
				]),
				apGrid
			]),
			E('div', { class: 'form-grid' }, [
				E('div', { class: 'form-group' }, [ E('label', { class: 'form-label' }, '🏷️ اسم الإكسس (Hostname):'), inHostname ]),
				E('div', { class: 'form-group' }, [ E('label', { class: 'form-label' }, '🌐 عنوان الـ IP الجديد:'), inNewIp ]),
				E('div', { class: 'form-group' }, [ E('label', { class: 'form-label' }, '🎭 قناع الشبكة (Netmask):'), inNetmask ]),
				E('div', { class: 'form-group' }, [ E('label', { class: 'form-label' }, '🚪 البوابة (Gateway):'), inGateway ]),
				E('div', { class: 'form-group' }, [ E('label', { class: 'form-label' }, '⚡ قوة البث (TxPower dBm):'), inTxpower ])
			]),
			btnSubmitIp
		]);
		container.appendChild(cardIp);

		// Card 2: Quick Hardware Actions
		var btnReboot = E('button', { class: 'btn-op btn-op-reboot' }, [ E('span', {}, '🔄'), E('span', {}, 'إعادة تشغيل الإكسسات المحددة') ]);
		var btnRestartWifi = E('button', { class: 'btn-op btn-op-wifi' }, [ E('span', {}, '📶'), E('span', {}, 'إعادة تشغيل الواي فاي فقط') ]);
		var btnRadioOff = E('button', { class: 'btn-op btn-op-off' }, [ E('span', {}, '📴'), E('span', {}, 'إيقاف بث الواي فاي') ]);
		var btnRadioOn = E('button', { class: 'btn-op btn-op-on' }, [ E('span', {}, '✔️'), E('span', {}, 'تشغيل بث الواي فاي') ]);

		var cardOps = E('div', { class: 'glass-card' }, [
			E('div', { class: 'card-header' }, [
				E('div', {}, [
					E('h3', { class: 'card-title', style: 'color:#38bdf8;' }, '🛠️ عمليات الهاردوير المباشرة (Hardware Actions via HMP)'),
					E('p', { class: 'card-desc' }, 'أوامر فورية يتم تنفيذها في الوقت الفعلي على الإكسسات المحددة بالشبكة.')
				])
			]),
			E('div', { style: 'display:flex; flex-wrap:wrap; gap:12px;' }, [
				btnReboot, btnRestartWifi, btnRadioOff, btnRadioOn
			])
		]);
		container.appendChild(cardOps);

		// State & Logic
		var knownAps = {};
		var selectedAps = new Set();

		function updateSelectedCount() {
			selectedCountBadge.textContent = '(تم تحديد ' + selectedAps.size + ' إكسس)';
			if (selectedAps.size === 1) {
				var mac = Array.from(selectedAps)[0];
				var ap = knownAps[mac];
				if (ap) {
					inHostname.value = ap.hostname || '';
					if (ap.ip && ap.ip !== '-') inNewIp.value = ap.ip;
				}
			}
		}

		btnSelectAll.onclick = function() {
			selectedAps.clear();
			Object.keys(knownAps).forEach(function(m){ selectedAps.add(m); });
			renderApGrid();
		};

		btnDeselectAll.onclick = function() {
			selectedAps.clear();
			renderApGrid();
		};

		function renderApGrid() {
			var tiles = [];
			var apKeys = Object.keys(knownAps);
			if (apKeys.length === 0) {
				tiles.push(E('div', { style: 'color:#94a3b8; font-size:13px; padding:10px;' }, 'جاري استكشاف الإكسسات عبر بروتوكول HMP...'));
			} else {
				apKeys.forEach(function(mac) {
					var ap = knownAps[mac];
					var isChecked = selectedAps.has(mac);
					var tile = E('div', { class: isChecked ? 'ap-tile selected' : 'ap-tile' });
					var cb = E('input', { type: 'checkbox' });
					cb.checked = isChecked;

					tile.onclick = function(e) {
						if (e.target !== cb) cb.checked = !cb.checked;
						if (cb.checked) selectedAps.add(mac);
						else selectedAps.delete(mac);
						tile.className = cb.checked ? 'ap-tile selected' : 'ap-tile';
						updateSelectedCount();
					};

					tile.appendChild(cb);
					tile.appendChild(E('div', { class: 'ap-tile-info' }, [
						E('span', { class: 'ap-tile-name' }, '📡 ' + (ap.hostname || 'AP')),
						E('span', { class: 'ap-tile-sub' }, (ap.ip || '-') + ' | ' + mac)
					]));
					tiles.push(tile);
				});
			}
			dom.content(apGrid, tiles);
			updateSelectedCount();
		}

		function loadData() {
			fetch('/cgi-bin/horus_map_data?_=' + Date.now()).then(function(r){ return r.json(); }).then(function(data) {
				if (data && data.aps) {
					var firstLoad = Object.keys(knownAps).length === 0;
					knownAps = data.aps;
					if (firstLoad && Object.keys(knownAps).length > 0) {
						selectedAps.add(Object.keys(knownAps)[0]);
					}
					renderApGrid();
				}
			}).catch(function(){});
		}

		btnSubmitIp.onclick = function() {
			if (selectedAps.size === 0) { alert('الرجاء اختيار إكسس واحد على الأقل.'); return; }
			var targetList = Array.from(selectedAps);

			var newIp = inNewIp.value.trim();
			var newHost = inHostname.value.trim();
			var nm = inNetmask.value.trim();
			var gw = inGateway.value.trim();
			var tx = inTxpower.value.trim();

			if (!newIp && !newHost && !tx) { alert('الرجاء كتابة عنوان IP أو اسم جديد لتطبيقه.'); return; }

			if (confirm('تطبيق إعدادات الشبكة على (' + targetList.length + ') إكسس عبر HMP؟')) {
				btnSubmitIp.disabled = true;
				var payload = { target_ap: targetList.length === 1 ? targetList[0] : targetList, action: 'set_ip' };
				if (newIp) payload.ip = newIp;
				if (nm) payload.netmask = nm;
				if (gw) payload.gateway = gw;
				if (newHost) payload.hostname = newHost;

				fetch('/cgi-bin/horus_ap_action', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				}).then(function(){
					if (tx) {
						fetch('/cgi-bin/horus_ap_action', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ target_ap: targetList.length === 1 ? targetList[0] : targetList, action: 'tx_power', txpower: tx })
						});
					}
					btnSubmitIp.disabled = false;
					ui.addNotification(null, E('p', '✅ تم إرسال أوامر ضبط الشبكة والـ IP بنجاح!'));
				}).catch(function(){
					btnSubmitIp.disabled = false;
				});
			}
		};

		function runHardwareAction(actionName, actionParam, stateVal) {
			if (selectedAps.size === 0) { alert('الرجاء تحديد إكسس واحد على الأقل.'); return; }
			var targetList = Array.from(selectedAps);
			var isAll = (targetList.length === Object.keys(knownAps).length);

			if (confirm('هل أنت متأكد من تنفيذ هذا الإجراء (' + actionName + ') على (' + targetList.length + ') إكسس؟')) {
				var p = { target_ap: isAll ? 'ALL' : targetList, action: actionParam };
				if (stateVal !== undefined) p.state = stateVal;

				var endpoint = actionParam === 'restart_wifi' ? '/cgi-bin/horus_wifi_action' : '/cgi-bin/horus_ap_action';
				fetch(endpoint, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(p)
				}).then(function(){
					ui.addNotification(null, E('p', '✅ تم إرسال أمر ' + actionName + ' بنجاح!'));
				});
			}
		}

		btnReboot.onclick = function() { runHardwareAction('إعادة التشغيل', 'reboot'); };
		btnRestartWifi.onclick = function() { runHardwareAction('إعادة تشغيل الوايرليس', 'restart_wifi'); };
		btnRadioOff.onclick = function() { runHardwareAction('إيقاف بث الوايرليس', 'wifi_radio', '1'); };
		btnRadioOn.onclick = function() { runHardwareAction('تشغيل بث الوايرليس', 'wifi_radio', '0'); };

		loadData();

		return container;
	}
});
