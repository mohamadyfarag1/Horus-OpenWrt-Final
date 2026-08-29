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

		var horus_version = '1.0.26-38';
		m = new form.Map('horus_controller', horusI18n.t('settings'), horusI18n.t('settings_desc') + ' - Build: ' + horus_version);

		s = m.section(form.NamedSection, 'main', 'settings', '');
		s.anonymous = false;
		s.addremove = false;

		s.tab('role', horusI18n.t('tab_role'));
		s.tab('roaming', horusI18n.t('tab_roaming'));
		s.tab('radius', horusI18n.t('tab_radius'));

		// Tab: role
		o = s.taboption('role', form.ListValue, 'role', horusI18n.t('opt_role'));
		o.value('standalone', horusI18n.t('role_standalone'));
		o.value('root', horusI18n.t('role_root'));
		o.value('satellite', horusI18n.t('role_satellite'));
		o.default = 'standalone';

		o = s.taboption('role', form.DummyValue, '_role_help', horusI18n.t('opt_role_help'));
		o.rawhtml = true;
		o.cfgvalue = function(section_id) {
			var role = uci.get('horus_controller', section_id, 'role');
			var desc = '';
			if (role === 'root') desc = horusI18n.t('role_help_root');
			else if (role === 'satellite') desc = horusI18n.t('role_help_satellite');
			else desc = horusI18n.t('role_help_standalone');
			return '<div style="color:#10b981; font-weight:700; font-size:13px; padding:8px 14px; background:rgba(16,185,129,0.1); border-radius:8px; border:1px solid rgba(16,185,129,0.25); line-height:1.5;">' + desc + '</div>';
		};

		o = s.taboption('role', form.Value, 'hmp_secret', horusI18n.t('opt_hmp_secret'));
		o.password = true;
		o.description = horusI18n.t('opt_hmp_secret_desc');

		o = s.taboption('role', form.Value, 'grace_period', horusI18n.t('opt_grace_period'));
		o.datatype = 'uinteger';
		o.placeholder = '30';
		o.depends('role', 'root');
		o.description = horusI18n.t('opt_grace_period_desc');

		o = s.taboption('role', form.Value, 'controller_ip', horusI18n.t('opt_controller_ip'));
		o.datatype = 'ip4addr';
		o.placeholder = '192.168.1.1';
		o.depends('role', 'satellite');
		o.description = horusI18n.t('opt_controller_ip_desc');

		o = s.taboption('role', form.Flag, 'auto_ch_2g', horusI18n.t('opt_auto_ch_2g'));
		o.depends('role', 'root');
		o.description = horusI18n.t('opt_auto_ch_2g_desc');

		o = s.taboption('role', form.Flag, 'auto_ch_5g', horusI18n.t('opt_auto_ch_5g'));
		o.depends('role', 'root');
		o.description = horusI18n.t('opt_auto_ch_5g_desc');

		// Tab: roaming
		o = s.taboption('roaming', form.Flag, 'roaming_enabled', horusI18n.t('opt_roaming_enabled'));
		o.default = '1';
		o.description = horusI18n.t('opt_roaming_enabled_desc');

		o = s.taboption('roaming', form.Flag, 'enable_80211kv', horusI18n.t('opt_enable_80211kv'));
		o.default = '1';
		o.description = horusI18n.t('opt_enable_80211kv_desc');

		o = s.taboption('roaming', form.Value, 'min_rssi', horusI18n.t('opt_min_rssi'));
		o.datatype = 'integer';
		o.placeholder = '-75';
		o.default = '-75';
		o.description = horusI18n.t('opt_min_rssi_desc');

		o = s.taboption('roaming', form.Flag, 'band_steering', horusI18n.t('opt_band_steering'));
		o.default = '1';
		o.description = horusI18n.t('opt_band_steering_desc');

		o = s.taboption('roaming', form.Value, 'roam_diff', horusI18n.t('opt_roam_diff'));
		o.datatype = 'uinteger';
		o.placeholder = '10';
		o.default = '10';
		o.description = horusI18n.t('opt_roam_diff_desc');

		// Tab: radius
		o = s.taboption('radius', form.Flag, 'enabled', horusI18n.t('opt_radius_enabled'));
		o.rmempty = false;

		o = s.taboption('radius', form.ListValue, 'radius_type', horusI18n.t('opt_radius_type'));
		o.value('sas', 'SAS 4');
		o.value('dma', 'DMA Radius');
		o.value('adv', 'Advanced Radius');

		o = s.taboption('radius', form.Value, 'base_url', horusI18n.t('opt_base_url'));
		o = s.taboption('radius', form.Value, 'username', horusI18n.t('opt_username'));
		o = s.taboption('radius', form.Value, 'password', horusI18n.t('opt_password'));
		o.password = true;

		o = s.taboption('radius', form.Value, 'api_key', horusI18n.t('opt_api_key'));
		o.password = true;
		o.depends('radius_type', 'adv');
		o.depends('radius_type', 'dma');

		o = s.taboption('radius', form.Value, 'sync_interval', horusI18n.t('opt_sync_interval'));
		o.datatype = 'uinteger';
		o.default = '10';

		o = s.taboption('radius', form.DummyValue, '_status', horusI18n.t('opt_radius_status'));
		o.rawhtml = true;
		o.cfgvalue = function(section_id) {
			var en = uci.get('horus_controller', section_id, 'enabled');
			var url = uci.get('horus_controller', section_id, 'base_url');
			if (en !== '1' || !url) {
				return '<span style="color:#ef4444;font-weight:bold;padding:6px 12px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);border-radius:8px;">' + horusI18n.t('status_unconfigured') + '</span>';
			}
			return '<span id="horus_auto_status" style="color:#fbbf24;font-weight:bold;padding:6px 12px;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);border-radius:8px;">' + horusI18n.t('status_checking') + '</span>' +
				'<img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" style="display:none;" onload="'+
				'fetch(\'/cgi-bin/horus_test\').then(function(r){return r.json();}).then(function(d){' +
				'var el = document.getElementById(\'horus_auto_status\'); if(!el) return;' +
				'if(d.success){' +
				'el.innerHTML = \'' + horusI18n.t('status_connected') + '\';' +
				'el.style.color = \'#4ade80\'; el.style.background = \'rgba(34,197,94,0.15)\'; el.style.borderColor = \'rgba(34,197,94,0.3)\';' +
				'} else {' +
				'if(d.message && (d.message.indexOf(\'Timeout\') !== -1 || d.message.indexOf(\'unreachable\') !== -1 || d.message.indexOf(\'\\u0644\\u0627 \\u064a\\u0648\\u062c\\u062f \\u0631\\u062f\') !== -1)){' +
				'el.innerHTML = \'' + horusI18n.t('status_timeout') + '\';' +
				'el.style.color = \'#f87171\'; el.style.background = \'rgba(239,68,68,0.15)\'; el.style.borderColor = \'rgba(239,68,68,0.3)\';' +
				'} else {' +
				'el.innerHTML = \'' + horusI18n.t('status_auth_error') + '\';' +
				'el.style.color = \'#fbbf24\'; el.style.background = \'rgba(245,158,11,0.15)\'; el.style.borderColor = \'rgba(245,158,11,0.3)\';' +
				'}' +
				'}' +
				'}).catch(function(){' +
				'var el = document.getElementById(\'horus_auto_status\'); if(!el) return;' +
				'el.innerHTML = \'' + horusI18n.t('status_error') + '\';' +
				'el.style.color = \'#f87171\'; el.style.background = \'rgba(239,68,68,0.15)\'; el.style.borderColor = \'rgba(239,68,68,0.3)\';' +
				'});' +
				'">';
		};

		return m.render().then(function(mapNode) {
			var langBtn = horusI18n.buildLangBtn(function() {
				window.location.reload();
			});

			var isRtl = (horusI18n.getDir() === 'rtl');
			var topBar = E('div', { class: 'settings-topbar', style: 'display:flex; justify-content:space-between; align-items:center; max-width:1050px; margin:10px auto 20px auto; padding:0 6px;' }, [
				E('div', {}, [
					E('h2', { style: 'margin:0; color:#f8fafc; font-size:22px; font-weight:900; display:flex; align-items:center; gap:8px;' }, [
						E('span', { style: 'color:#10b981;' }, '⚙️'),
						E('span', {}, horusI18n.t('settings'))
					]),
					E('p', { style: 'margin:6px 0 0 0; color:#94a3b8; font-size:13px; font-weight:600;' }, horusI18n.t('settings_desc') + ' | Build: ' + horus_version)
				]),
				langBtn
			]);

			var wrapper = E('div', { class: 'horus-settings-view', style: 'direction:' + horusI18n.getDir() + '; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;' }, [
				E('style', {}, `
					#maincontent { max-width: 98% !important; width: 98% !important; margin: 0 auto !important; padding: 12px !important; }
					.horus-settings-view { width: 100% !important; box-sizing: border-box; }
					
					/* Completely remove default conflicting LuCI titles */
					.cbi-map > h2:first-child,
					.cbi-map > .cbi-map-descr,
					.cbi-section-title,
					.cbi-section-descr,
					.cbi-value-help,
					.cbi-tooltip-container {
						display: none !important;
					}
					
					.cbi-map { max-width: 1050px !important; width: 100% !important; margin: 0 auto !important; color: #f8fafc; }
					.cbi-section {
						background: rgba(17, 24, 39, 0.75) !important;
						backdrop-filter: blur(16px) !important;
						-webkit-backdrop-filter: blur(16px) !important;
						border: 1px solid rgba(255, 255, 255, 0.09) !important;
						border-radius: 16px !important;
						padding: 26px 30px !important;
						margin-bottom: 24px !important;
						box-shadow: 0 15px 35px -5px rgba(0, 0, 0, 0.5) !important;
					}
					.cbi-section-node { background: transparent !important; border: none !important; padding: 0 !important; }
					
					/* Smooth Rounded Tab Container */
					.cbi-tabmenu {
						display: flex !important;
						flex-wrap: wrap !important;
						gap: 8px !important;
						background: rgba(15, 23, 42, 0.6) !important;
						padding: 6px !important;
						border-radius: 12px !important;
						border: 1px solid rgba(255, 255, 255, 0.08) !important;
						margin: 0 0 26px 0 !important;
						list-style: none !important;
					}
					.cbi-tabmenu > li { margin: 0 !important; padding: 0 !important; list-style: none !important; }
					.cbi-tabmenu > li > a {
						padding: 10px 22px !important;
						font-size: 13.5px !important;
						font-weight: 700 !important;
						border-radius: 8px !important;
						background: transparent !important;
						border: 1px solid transparent !important;
						color: #94a3b8 !important;
						text-decoration: none !important;
						display: inline-flex !important;
						align-items: center !important;
						gap: 6px !important;
						transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
					}
					.cbi-tabmenu > li.cbi-tab > a {
						background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
						color: #022c22 !important;
						font-weight: 800 !important;
						box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35) !important;
						border: none !important;
					}
					.cbi-tabmenu > li > a:hover:not(.cbi-tab) {
						background: rgba(255, 255, 255, 0.06) !important;
						color: #f8fafc !important;
					}
					
					/* Perfectly Aligned 2-Column Form Rows */
					.cbi-value {
						border-bottom: 1px solid rgba(255,255,255,0.06) !important;
						padding: 18px 12px !important;
						display: flex !important;
						flex-direction: row !important;
						justify-content: space-between !important;
						align-items: flex-start !important;
						width: 100% !important;
						box-sizing: border-box !important;
						margin: 0 !important;
						border-radius: 8px !important;
						transition: background 0.15s ease !important;
					}
					.cbi-value:hover { background: rgba(255,255,255,0.02) !important; }
					
					.cbi-value-title {
						flex: 0 0 42% !important;
						max-width: 42% !important;
						font-weight: 700 !important;
						font-size: 14px !important;
						color: #f1f5f9 !important;
						text-align: ` + (isRtl ? 'right' : 'left') + ` !important;
						padding: 8px 0 0 0 !important;
						margin: 0 !important;
						line-height: 1.5 !important;
					}
					.cbi-value-field {
						flex: 0 0 54% !important;
						max-width: 54% !important;
						text-align: ` + (isRtl ? 'right' : 'left') + ` !important;
						padding: 0 !important;
						margin: 0 !important;
					}
					
					.cbi-value-field input[type="text"],
					.cbi-value-field input[type="password"],
					.cbi-value-field select {
						width: 100% !important;
						box-sizing: border-box !important;
						background: #0f172a !important;
						border: 1px solid rgba(255, 255, 255, 0.14) !important;
						border-radius: 8px !important;
						padding: 10px 14px !important;
						color: #f8fafc !important;
						font-size: 14px !important;
						outline: none !important;
						transition: all 0.2s ease !important;
					}
					.cbi-value-field input:focus, .cbi-value-field select:focus {
						border-color: #10b981 !important;
						box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2) !important;
						background: #090d16 !important;
					}
					.cbi-value-field input[type="checkbox"] {
						width: 22px !important;
						height: 22px !important;
						accent-color: #10b981 !important;
						cursor: pointer !important;
						margin-top: 6px !important;
					}
					
					.cbi-value-description {
						color: #94a3b8 !important;
						font-size: 12px !important;
						margin-top: 6px !important;
						line-height: 1.5 !important;
					}
					
					/* Action Buttons */
					.cbi-page-actions {
						display: flex !important;
						justify-content: flex-end !important;
						gap: 12px !important;
						background: rgba(15, 23, 42, 0.7) !important;
						border: 1px solid rgba(255,255,255,0.1) !important;
						border-radius: 12px !important;
						padding: 16px 24px !important;
						margin-top: 22px !important;
					}
					.cbi-button-apply, .cbi-button-save {
						background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
						color: #022c22 !important;
						font-weight: 800 !important;
						font-size: 14px !important;
						padding: 10px 24px !important;
						border: none !important;
						border-radius: 8px !important;
						cursor: pointer !important;
						box-shadow: 0 4px 14px rgba(16, 185, 129, 0.25) !important;
						transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
					}
					.cbi-button-apply:hover, .cbi-button-save:hover {
						transform: translateY(-1px) !important;
						box-shadow: 0 6px 18px rgba(16, 185, 129, 0.4) !important;
					}
					.cbi-button-reset {
						background: rgba(239, 68, 68, 0.15) !important;
						color: #f87171 !important;
						border: 1px solid rgba(239, 68, 68, 0.3) !important;
						font-weight: 700 !important;
						font-size: 14px !important;
						padding: 10px 20px !important;
						border-radius: 8px !important;
						cursor: pointer !important;
					}
				`),
				topBar,
				mapNode
			]);
			return wrapper;
		});
	}
});
