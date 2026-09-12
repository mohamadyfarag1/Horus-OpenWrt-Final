'use strict';
'require view';
'require form';
'require fs';
'require ui';

// Horus Spot — SAS / RADIUS (MikroTik style layout)
return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('uspot', _('RADIUS'),
			_('Configure the connection to your RADIUS server. This page simulates the MikroTik "RADIUS" menu.'));

		s = m.section(form.NamedSection, 'hotspot', 'uspot');
		s.addremove = false;
		
		// Tabs matching MikroTik sections
		s.tab('radius', _('RADIUS Server (SAS)'));
		s.tab('incoming', _('Incoming / CoA (Disconnect)'));
		s.tab('profile', _('Hotspot Profile (Login)'));

		// --- Tab: RADIUS Server ---
		o = s.option(form.DummyValue, '_service', _('Service'));
		o.tab = 'radius'; o.default = 'Hotspot (Fixed)';

		o = s.option(form.Value, 'auth_server', _('Address (Auth Server)'), _('The IP address of your SAS server.'));
		o.tab = 'radius'; o.datatype = 'host';
		
		o = s.option(form.Value, 'auth_secret', _('Secret'), _('The Shared Secret you registered in SAS (sas_nas).'));
		o.tab = 'radius'; o.password = true;

		o = s.option(form.Value, 'auth_port', _('Authentication Port'));
		o.tab = 'radius'; o.datatype = 'port'; o.default = '1812';

		o = s.option(form.Value, 'acct_server', _('Accounting Server'), _('Usually the exact same IP as the Address above.'));
		o.tab = 'radius'; o.datatype = 'host';
		
		o = s.option(form.Value, 'acct_port', _('Accounting Port'));
		o.tab = 'radius'; o.datatype = 'port'; o.default = '1813';
		
		o = s.option(form.Value, 'acct_secret', _('Accounting Secret'), _('Usually the exact same Secret as above.'));
		o.tab = 'radius'; o.password = true;
		
		o = s.option(form.Value, 'acct_interval', _('Interim Update (s)'), _('How often to send live traffic counters to SAS.'));
		o.tab = 'radius'; o.datatype = 'uinteger'; o.default = '60';

		// --- Tab: Incoming / CoA ---
		o = s.option(form.Value, 'das_port', _('Incoming Port'), _('MikroTik default is 3799.'));
		o.tab = 'incoming'; o.datatype = 'port'; o.default = '3799';

		o = s.option(form.Value, 'das_secret', _('Incoming Secret'), _('Usually the exact same Secret as the RADIUS server.'));
		o.tab = 'incoming'; o.password = true;

		// --- Tab: Hotspot Profile ---
		o = s.option(form.Value, 'nasid', _('NAS-Identifier'), _('The identity of this router sent to SAS.'));
		o.tab = 'profile'; o.default = 'HorusNAS';
		
		o = s.option(form.Flag, 'mac_auth', _('Login By MAC'), _('Automatically authenticate known devices in SAS without showing the login page.'));
		o.tab = 'profile'; o.default = '1';

		o = s.option(form.Value, 'uam_server', _('External Login Page URL'), _('The full link to your SAS captive portal (e.g. http://192.168.100.1/cgi-bin/hotspot).'));
		o.tab = 'profile'; 

		return m.render();
	},

	handleSaveApply: function(ev, mode) {
		return this.super('handleSaveApply', [ev, mode]).then(function() {
			return fs.exec('/usr/bin/uspot', ['restart']).catch(function() {
				return fs.exec('/etc/init.d/uspot', ['restart']);
			}).then(function() {
				ui.addNotification(null, E('p', _('Horus Spot restarted with new RADIUS settings.')), 'info');
			}).catch(function() {});
		});
	}
});

