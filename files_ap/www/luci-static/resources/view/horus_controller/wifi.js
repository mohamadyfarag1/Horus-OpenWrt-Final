'use strict';
'require view';
'require ui';
'require dom';

return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	render: function() {
		var container = E('div', { class: 'horus-wifi-view', style: 'direction:rtl; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;' });

		// Professional Dark/Glassmorphism Theme Styles
		var styles = E('style', {}, `
			.horus-wifi-view { color: #f8fafc; }
			.glass-card { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4); }
			.card-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 14px; margin-bottom: 20px; }
			.card-title { font-size: 18px; font-weight: 700; color: #00e676; margin: 0; display: flex; align-items: center; gap: 8px; }
			.card-desc { font-size: 13px; color: #94a3b8; margin: 4px 0 0 0; }
			
			.wifi-alert-box { background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); color: #fbbf24; padding: 12px 16px; border-radius: 8px; font-size: 13px; margin-bottom: 20px; display: flex; align-items: center; gap: 10px; }
			
			.form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 20px; }
			.form-group { display: flex; flex-direction: column; gap: 6px; }
			.form-label { font-size: 13px; font-weight: 600; color: #cbd5e1; display: flex; align-items: center; gap: 6px; }
			.form-control { background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 10px 14px; color: #f8fafc; font-size: 14px; outline: none; transition: all 0.2s; }
			.form-control:focus { border-color: #00e676; box-shadow: 0 0 0 3px rgba(0, 230, 118, 0.2); }
			.form-control option { background: #0f172a; color: #f8fafc; }
			
			/* AP Selection Grid */
			.ap-select-box { background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; padding: 16px; margin-bottom: 22px; }
			.ap-select-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 10px; }
			.ap-select-title { font-size: 14px; font-weight: bold; color: #38bdf8; display: flex; align-items: center; gap: 6px; }
			.ap-tools { display: flex; gap: 8px; }
			.btn-tool { padding: 4px 12px; font-size: 12px; font-weight: 600; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.05); color: #cbd5e1; cursor: pointer; transition: 0.2s; }
			.btn-tool:hover { background: rgba(255,255,255,0.15); color: #fff; }
			
			.ap-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; max-height: 240px; overflow-y: auto; padding: 4px; }
			.ap-tile { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; cursor: pointer; transition: all 0.2s; user-select: none; }
			.ap-tile:hover { background: rgba(51, 65, 85, 0.6); border-color: rgba(255, 255, 255, 0.25); transform: translateY(-1px); }
			.ap-tile.selected { background: rgba(0, 230, 118, 0.12); border-color: #00e676; box-shadow: 0 0 10px rgba(0, 230, 118, 0.15); }
			.ap-tile input[type="checkbox"] { width: 18px; height: 18px; accent-color: #00e676; cursor: pointer; }
			.ap-tile-info { display: flex; flex-direction: column; gap: 2px; }
			.ap-tile-name { font-size: 13px; font-weight: 700; color: #f8fafc; }
			.ap-tile-sub { font-size: 11px; color: #94a3b8; font-family: monospace; }
			
			/* Action Buttons */
			.btn-wifi-submit { width: 100%; padding: 14px; background: linear-gradient(135deg, #00e676 0%, #00b0ff 100%); color: #000; border: none; border-radius: 8px; font-size: 15px; font-weight: 800; cursor: pointer; box-shadow: 0 4px 15px rgba(0, 230, 118, 0.3); transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; }
			.btn-wifi-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0, 230, 118, 0.45); }
			.btn-wifi-submit:disabled { opacity: 0.6; cursor: not-allowed; }
		`);
		container.appendChild(styles);

		// WiFi Form Elements
		var inBand = E('select', { class: 'form-control' }, [
			E('option', { value: 'both' }, '📶 الترددين معاً (2.4GHz + 5GHz)'),
			E('option', { value: '2g' }, '📶 تردد 2.4GHz فقط'),
			E('option', { value: '5g' }, '📶 تردد 5GHz فقط')
		]);

		var inSsid = E('input', { class: 'form-control', type: 'text', placeholder: 'مثال: Horus_Ultra_WiFi' });
		var inPass = E('input', { class: 'form-control', type: 'password', placeholder: 'كلمة السر الجديدة (8 أحرف فأكثر)' });

		var inChannel = E('select', { class: 'form-control' }, [
			E('option', { value: '' }, 'بدون تغيير (الحالي)'),
			E('option', { value: 'auto' }, 'Auto (تلقائي)')
		]);
		for (var ch = 1; ch <= 13; ch++) inChannel.appendChild(E('option', { value: ch.toString() }, 'قناة ' + ch + ' (2.4GHz)'));
		[36, 40, 44, 48, 149, 153, 157, 161, 165].forEach(function(ch5) {
			inChannel.appendChild(E('option', { value: ch5.toString() }, 'قناة ' + ch5 + ' (5GHz)'));
		});

		var inHtmode = E('select', { class: 'form-control' }, [
			E('option', { value: '' }, 'بدون تغيير'),
			E('option', { value: 'HT20' }, '20 MHz (أفضل استقرار وأقل تداخل)'),
			E('option', { value: 'HT40' }, '40 MHz (سرعة مضاعفة)'),
			E('option', { value: 'VHT80' }, '80 MHz (أقصى سرعة لتردد 5G)')
		]);

		var inEnc = E('select', { class: 'form-control' }, [
			E('option', { value: '' }, 'بدون تغيير'),
			E('option', { value: 'psk2' }, 'WPA2-PSK (متوافق مع كل الهواتف)'),
			E('option', { value: 'psk2+ccmp' }, 'WPA2-PSK / AES CCMP'),
			E('option', { value: 'none' }, 'مفتوحة (بدون كلمة سر)'),
			E('option', { value: 'sae' }, 'WPA3-SAE (أعلى درجات الأمان)')
		]);

		var apGrid = E('div', { class: 'ap-grid' });
		var btnSelectAll = E('button', { class: 'btn-tool', type: 'button' }, '✅ تحديد الكل');
		var btnDeselectAll = E('button', { class: 'btn-tool', type: 'button' }, '❌ إلغاء التحديد');
		var selectedCountBadge = E('span', { style: 'color:#00e676; font-weight:bold; font-size:12px;' }, '(تم تحديد 0 إكسس)');

		var btnSubmit = E('button', { class: 'btn-wifi-submit' }, [
			E('span', { style: 'font-size:18px;' }, '🚀'),
			E('span', {}, 'تطبيق إعدادات الواي فاي على الإكسسات المحددة عبر HMP')
		]);

		var card = E('div', { class: 'glass-card' }, [
			E('div', { class: 'card-header' }, [
				E('div', {}, [
					E('h3', { class: 'card-title' }, '📶 التحكم الشامل بالواي فاي (WiFi Remote Control)'),
					E('p', { class: 'card-desc' }, 'تغيير اسم الشبكة والرقم السري والترددات والقنوات لعدة إكسسات في وقت واحد.')
				])
			]),
			E('div', { class: 'wifi-alert-box' }, [
				E('span', { style: 'font-size:16px;' }, '⚠️'),
				E('span', {}, 'تنبيه: تطبيق التغييرات سيقوم بتحديث إعدادات الوايرليس على الإكسسات المحددة فوراً عبر بروتوكول HMP.')
			]),
			E('div', { class: 'form-grid' }, [
				E('div', { class: 'form-group' }, [ E('label', { class: 'form-label' }, '📡 التردد المستهدف:'), inBand ]),
				E('div', { class: 'form-group' }, [ E('label', { class: 'form-label' }, '🔤 اسم الشبكة الجديد (SSID):'), inSsid ]),
				E('div', { class: 'form-group' }, [ E('label', { class: 'form-label' }, '🔑 كلمة السر الجديدة (Password):'), inPass ])
			]),
			E('div', { class: 'form-grid' }, [
				E('div', { class: 'form-group' }, [ E('label', { class: 'form-label' }, '📻 القناة (Channel):'), inChannel ]),
				E('div', { class: 'form-group' }, [ E('label', { class: 'form-label' }, '📊 عرض القناة (Channel Width):'), inHtmode ]),
				E('div', { class: 'form-group' }, [ E('label', { class: 'form-label' }, '🔒 نوع التشفير (Encryption):'), inEnc ])
			]),
			E('div', { class: 'ap-select-box' }, [
				E('div', { class: 'ap-select-header' }, [
					E('div', { class: 'ap-select-title' }, [
						E('span', {}, '🎯 اختيار الإكسسات المستهدفة لتطبيق التغيير:'),
						selectedCountBadge
					]),
					E('div', { class: 'ap-tools' }, [ btnSelectAll, btnDeselectAll ])
				]),
				apGrid
			]),
			btnSubmit
		]);
		container.appendChild(card);

		// State & Logic
		var knownAps = {};
		var selectedAps = new Set();

		function updateSelectedCount() {
			selectedCountBadge.textContent = '(تم تحديد ' + selectedAps.size + ' إكسس)';
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
					if (firstLoad) {
						Object.keys(knownAps).forEach(function(m){ selectedAps.add(m); });
					}
					renderApGrid();
				}
			}).catch(function(){});
		}

		btnSubmit.onclick = function() {
			var band = inBand.value;
			var ssid = inSsid.value.trim();
			var pass = inPass.value.trim();
			var ch = inChannel.value;
			var ht = inHtmode.value;
			var enc = inEnc.value;

			if (!ssid && !pass && !ch && !ht && !enc) {
				alert('الرجاء إدخال اسم شبكة أو رقم سري أو تغيير قناة لتطبيقها.');
				return;
			}

			if (selectedAps.size === 0) {
				alert('الرجاء تحديد إكسس واحد على الأقل لتطبيق الإعدادات عليه.');
				return;
			}

			var targetList = Array.from(selectedAps);
			var isAll = (targetList.length === Object.keys(knownAps).length);

			btnSubmit.disabled = true;
			btnSubmit.textContent = 'جاري الإرسال عبر HMP...';

			fetch('/cgi-bin/horus_wifi_action', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					target_ap: isAll ? 'ALL' : targetList,
					action: 'apply_profile',
					band: band,
					ssid: ssid,
					password: pass,
					channel: ch,
					htmode: ht,
					encryption: enc
				})
			}).then(function(){
				btnSubmit.disabled = false;
				btnSubmit.innerHTML = '<span>🚀</span> <span>تطبيق إعدادات الواي فاي على الإكسسات المحددة عبر HMP</span>';
				ui.addNotification(null, E('p', '✅ تم إرسال وتطبيق إعدادات الواي فاي بنجاح إلى (' + targetList.length + ') إكسس.'));
			}).catch(function(){
				btnSubmit.disabled = false;
				btnSubmit.innerHTML = '<span>🚀</span> <span>تطبيق إعدادات الواي فاي على الإكسسات المحددة عبر HMP</span>';
			});
		};

		loadData();

		return container;
	}
});
