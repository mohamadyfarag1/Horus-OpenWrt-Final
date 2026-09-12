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

		s = m.section(form.NamedSection, 'hotspot', 'uspot');
		s.addremove = false;
		s.tab('auth', _('RADIUS Authentication (SAS)'));
		s.tab('acct', _('RADIUS Accounting'));
		s.tab('nas', _('NAS identity'));
		s.tab('coa', _('CoA / Disconnect (quota end)'));
		s.tab('portal', _('MAC auto-login + captive portal'));

		o = s.option(form.Value, 'auth_server', _('SAS server (auth)'), _('SAS FreeRADIUS IP or hostname.'));
		o.tab = 'auth'; o.datatype = 'host';
		
		o = s.option(form.Value, 'auth_port', _('Auth port'));
		o.tab = 'auth'; o.datatype = 'port'; o.default = '1812';
		
		o = s.option(form.Value, 'auth_secret', _('Shared secret'), _('Must equal the secret of this router in SAS (sas_nas).'));
		o.tab = 'auth'; o.password = true;

		o = s.option(form.Value, 'auth_server2', _('Backup server (optional)'));
		o.tab = 'auth'; o.datatype = 'host'; o.optional = true;
		
		o = s.option(form.Value, 'auth_secret2', _('Backup secret'));
		o.tab = 'auth'; o.password = true; o.optional = true;

		o = s.option(form.Value, 'acct_server', _('SAS server (accounting)'), _('Usually same as auth server.'));
		o.tab = 'acct'; o.datatype = 'host';
		
		o = s.option(form.Value, 'acct_port', _('Accounting port'));
		o.tab = 'acct'; o.datatype = 'port'; o.default = '1813';
		
		o = s.option(form.Value, 'acct_secret', _('Accounting secret'));
		o.tab = 'acct'; o.password = true;
		
		o = s.option(form.Value, 'acct_interval', _('Interim interval (s)'), _('How often usage is reported to SAS.'));
		o.tab = 'acct'; o.datatype = 'uinteger'; o.default = '60';

		o = s.option(form.Value, 'nasid', _('NAS-Identifier'));
		o.tab = 'nas'; o.default = 'HorusNAS';
		
		o = s.option(form.Value, 'nasmac', _('NAS MAC (Called-Station-Id)'), _("This AP's MAC address."));
		o.tab = 'nas'; o.datatype = 'macaddr';

		o = s.option(form.Value, 'das_secret', _('DAE secret'), _('Setting this enables RFC 5176 CoA/Disconnect so SAS can kick clients.'));
		o.tab = 'coa'; o.password = true;
		
		o = s.option(form.Value, 'das_port', _('DAE port'));
		o.tab = 'coa'; o.datatype = 'port'; o.default = '3799';

		o = s.option(form.Flag, 'mac_auth', _('MAC auto-login'), _('Try MAC authentication before showing the portal (password = the MAC, per SAS rule).'));
		o.tab = 'portal'; o.default = '1';
		
		o = s.option(form.Value, 'mac_suffix', _('MAC username suffix'));
		o.tab = 'portal'; o.optional = true;
		
		o = s.option(form.Value, 'uam_server', _('Captive portal URL'), _('Local MikroTik login page, e.g. http://10.0.0.1/login'));
		o.tab = 'portal'; 
		
		o = s.option(form.Value, 'uam_port', _('UAM port'));
		o.tab = 'portal'; o.datatype = 'port'; o.default = '3990';
		
		o = s.option(form.Value, 'challenge', _('CHAP challenge seed'), _('Shared seed used to derive the per-client CHAP challenge.'));
		o.tab = 'portal';

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
