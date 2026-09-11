'use strict';
'require view';
'require form';
'require fs';
'require ui';

// Horus Spot — IP Bindings (MikroTik style)
return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('uspot', _('Horus Spot — IP Bindings (MAC Bypass)'),
			_('Local rules for MAC addresses. "Bypassed" gives unlimited internet without SAS. "Blocked" drops the MAC completely. For speed-limited MACs, add them in SAS Panel instead (MAC Auto-Login is enabled).'));

		s = m.section(form.TableSection, 'whitelist', _('IP Bindings List'));
		s.addremove = true;
		s.anonymous = true;
		s.sortable = true;
		s.nodescriptions = true;

		o = s.option(form.Value, 'mac', _('MAC Address'));
		o.datatype = 'macaddr';
		o.rmempty = false;
		o.placeholder = 'AA:BB:CC:DD:EE:FF';

		o = s.option(form.ListValue, 'type', _('Type'));
		o.value('bypassed', _('Bypassed (Unlimited)'));
		o.value('blocked', _('Blocked (Drop)'));
		o.default = 'bypassed';

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
				ui.addNotification(null, E('p', _('IP Bindings applied successfully.')), 'info');
			}).catch(function() {
				ui.addNotification(null, E('p', _('Saved. Could not apply live — will apply on next hotspot restart.')), 'warning');
			});
		});
	}
});
