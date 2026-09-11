'use strict';
'require view';
'require form';
'require fs';
'require ui';
'require tools.widgets as widgets';

// Horus Spot — General Settings (real uspot schema)
return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('uspot', _('Horus Spot — General'),
			_('General hotspot settings. RADIUS/SAS details are on the "SAS / RADIUS" tab.'));

		s = m.section(form.NamedSection, 'hotspot', 'uspot', _('General Settings'));
		s.addremove = false;

		o = s.option(form.Flag, 'enabled', _('Enable Horus Spot'),
			_('Turn the captive portal on or off.'));
		o.default = '1';

		o = s.option(form.ListValue, 'auth_mode', _('Authentication mode'));
		o.value('uam', _('UAM (MikroTik pages + CHAP) — recommended for SAS'));
		o.value('radius', _('RADIUS (built-in credentials form)'));
		o.value('click-to-continue', _('Click to continue'));
		o.default = 'uam';

		o = s.option(widgets.NetworkSelect, 'interface', _('Network interface'),
			_('The dedicated network the hotspot runs on (e.g. captive or lan).'));
		o.multiple = false;
		o.default = 'lan';

		o = s.option(form.ListValue, 'mac_format', _('MAC address format'),
			_('Must match what SAS expects. MikroTik uses uppercase AA:BB:CC:DD:EE:FF.'));
		['AA:BB:CC:DD:EE:FF','aa:bb:cc:dd:ee:ff','AA-BB-CC-DD-EE-FF','aa-bb-cc-dd-ee-ff','AABBCCDDEEFF','aabbccddeeff'].forEach(function(v){ o.value(v); });
		o.default = 'AA:BB:CC:DD:EE:FF';

		o = s.option(form.Value, 'idle_timeout', _('Idle timeout (s)'),
			_('Client kicked after being idle this long. Overridden by RADIUS.'));
		o.datatype = 'uinteger';
		o.default = '600';

		o = s.option(form.Value, 'session_timeout', _('Session timeout (s)'),
			_('0 = take Session-Timeout from RADIUS (SAS).'));
		o.datatype = 'uinteger';
		o.default = '0';

		o = s.option(form.Flag, 'counters', _('Enable traffic counters'),
			_('Required for accounting and quota (Total-Limit). Keep enabled for SAS.'));
		o.default = '1';

		o = s.option(form.Flag, 'debug', _('Debug logging'),
			_('Verbose logs — check with: logread -e uspot'));
		o.default = '0';

		return m.render();
	},

	handleSaveApply: function(ev, mode) {
		var self = this;
		return this.super('handleSaveApply', [ev, mode]).then(function() {
			return fs.exec('/sbin/uci', ['get', 'uspot.hotspot.enabled']).then(function(res) {
				if (res.stdout && res.stdout.trim() === '0') {
					return fs.exec('/etc/init.d/uspot', ['stop']).then(function() {
						return fs.exec('/etc/init.d/uspot', ['disable']);
					}).then(function() {
						ui.addNotification(null, E('p', _('Horus Spot disabled and stopped.')), 'info');
					});
				} else {
					return fs.exec('/etc/init.d/uspot', ['enable']).then(function() {
						return fs.exec('/etc/init.d/uspot', ['restart']);
					}).then(function() {
						ui.addNotification(null, E('p', _('Horus Spot enabled and restarted.')), 'info');
					});
				}
			}).catch(function() {
				return fs.exec('/etc/init.d/uspot', ['restart']);
			});
		});
	}
});
