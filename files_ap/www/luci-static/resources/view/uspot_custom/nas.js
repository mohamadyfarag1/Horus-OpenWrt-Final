'use strict';
'require view';
'require form';
'require fs';
'require ui';

// Horus Spot — SAS / RADIUS (NAS) settings (real uspot schema)
return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('uspot', _('Horus Spot — SAS / RADIUS'),
			_('Point the hotspot at your SAS FreeRADIUS server. Register this router in SAS as a NAS of type "Mikrotik" using the same shared secret.'));

		s = m.section(form.NamedSection, 'hotspot', 'uspot', _('RADIUS Authentication (SAS)'));
		s.addremove = false;

		o = s.option(form.Value, 'auth_server', _('SAS server (auth)'), _('SAS FreeRADIUS IP or hostname.'));
		o.datatype = 'host';
		o = s.option(form.Value, 'auth_port', _('Auth port'));
		o.datatype = 'port'; o.default = '1812';
		o = s.option(form.Value, 'auth_secret', _('Shared secret'), _('Must equal the secret of this router in SAS (sas_nas).'));
		o.password = true;

		o = s.option(form.Value, 'auth_server2', _('Backup server (optional)'));
		o.datatype = 'host'; o.optional = true;
		o = s.option(form.Value, 'auth_secret2', _('Backup secret'));
		o.password = true; o.optional = true;

		s = m.section(form.NamedSection, 'hotspot', 'uspot', _('RADIUS Accounting'));
		s.addremove = false;
		o = s.option(form.Value, 'acct_server', _('SAS server (accounting)'), _('Usually same as auth server.'));
		o.datatype = 'host';
		o = s.option(form.Value, 'acct_port', _('Accounting port'));
		o.datatype = 'port'; o.default = '1813';
		o = s.option(form.Value, 'acct_secret', _('Accounting secret'));
		o.password = true;
		o = s.option(form.Value, 'acct_interval', _('Interim interval (s)'), _('How often usage is reported to SAS.'));
		o.datatype = 'uinteger'; o.default = '60';

		s = m.section(form.NamedSection, 'hotspot', 'uspot', _('NAS identity'));
		s.addremove = false;
		o = s.option(form.Value, 'nasid', _('NAS-Identifier'));
		o.default = 'HorusNAS';
		o = s.option(form.Value, 'nasmac', _('NAS MAC (Called-Station-Id)'), _("This AP's MAC address."));
		o.datatype = 'macaddr';

		s = m.section(form.NamedSection, 'hotspot', 'uspot', _('CoA / Disconnect (quota end)'));
		s.addremove = false;
		o = s.option(form.Value, 'das_secret', _('DAE secret'), _('Setting this enables RFC 5176 CoA/Disconnect so SAS can kick clients.'));
		o.password = true;
		o = s.option(form.Value, 'das_port', _('DAE port'));
		o.datatype = 'port'; o.default = '3799';

		s = m.section(form.NamedSection, 'hotspot', 'uspot', _('MAC auto-login + captive portal'));
		s.addremove = false;
		o = s.option(form.Flag, 'mac_auth', _('MAC auto-login'), _('Try MAC authentication before showing the portal (password = the MAC, per SAS rule).'));
		o.default = '1';
		o = s.option(form.Value, 'mac_suffix', _('MAC username suffix'));
		o.optional = true;
		o = s.option(form.Value, 'uam_server', _('Captive portal URL'), _('Local MikroTik login page, e.g. http://10.0.0.1/login'));
		o = s.option(form.Value, 'uam_port', _('UAM port'));
		o.datatype = 'port'; o.default = '3990';
		o = s.option(form.Value, 'challenge', _('CHAP challenge seed'), _('Shared seed used to derive the per-client CHAP challenge.'));

		return m.render();
	},

	handleSaveApply: function(ev, mode) {
		return this.super('handleSaveApply', [ev, mode]).then(function() {
			return fs.exec('/usr/bin/uspot', ['restart']).catch(function() {
				return fs.exec('/etc/init.d/uspot', ['restart']);
			}).then(function() {
				ui.addNotification(null, E('p', _('Horus Spot restarted.')), 'info');
			}).catch(function() {});
		});
	}
});
