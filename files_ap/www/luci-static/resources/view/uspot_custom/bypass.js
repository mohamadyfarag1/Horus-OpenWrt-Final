'use strict';
'require view';
'require form';
'require fs';
'require ui';

// Horus Spot — MAC bypass (open internet WITHOUT RADIUS), MikroTik IP-binding=bypassed
return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('uspot', _('Horus Spot — MAC Bypass'),
			_('Devices listed here get internet access directly, without any RADIUS/SAS login (like a MikroTik "bypassed" IP-binding). Add a MAC and a comment.'));

		s = m.section(form.GridSection, 'whitelist', _('Bypassed devices'));
		s.addremove = true;
		s.anonymous = true;
		s.sortable = false;
		s.nodescriptions = true;

		o = s.option(form.Value, 'mac', _('MAC address'));
		o.datatype = 'macaddr';
		o.rmempty = false;
		o.placeholder = 'AA:BB:CC:DD:EE:FF';

		o = s.option(form.Value, 'comment', _('Comment'));
		o.placeholder = _('e.g. admin laptop, printer, CCTV');

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = '1';
		o.editable = true;

		return m.render();
	},

	handleSaveApply: function(ev, mode) {
		return this.super('handleSaveApply', [ev, mode]).then(function() {
			return fs.exec('/usr/bin/uspot-maclist.sh', ['apply']).then(function() {
				ui.addNotification(null, E('p', _('Bypass list applied.')), 'info');
			}).catch(function() {
				ui.addNotification(null, E('p', _('Saved. Could not apply live — will apply on next hotspot restart.')), 'warning');
			});
		});
	}
});
