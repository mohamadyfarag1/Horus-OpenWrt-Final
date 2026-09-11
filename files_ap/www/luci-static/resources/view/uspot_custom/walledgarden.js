'use strict';
'require view';
'require form';
'require fs';
'require ui';

// Horus Spot — Walled Garden (MikroTik style)
return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('uspot', _('Horus Spot — Walled Garden'),
			_('Allow access to specific websites (Domains) or IP addresses before the user logs in. Essential for payment gateways or company websites.'));

		// Domains
		s = m.section(form.TableSection, 'walled_domain', _('Walled Garden (Domains)'));
		s.addremove = true;
		s.anonymous = true;
		s.sortable = true;
		s.nodescriptions = true;

		o = s.option(form.Value, 'domain', _('Domain Name'));
		o.placeholder = 'e.g. paypal.com';
		o.rmempty = false;

		o = s.option(form.Value, 'comment', _('Comment'));
		
		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = '1';
		o.editable = true;

		// IPs
		s = m.section(form.TableSection, 'walled_ip', _('Walled Garden (IP List)'));
		s.addremove = true;
		s.anonymous = true;
		s.sortable = true;
		s.nodescriptions = true;

		o = s.option(form.Value, 'ip', _('IP Address / Subnet'));
		o.placeholder = 'e.g. 10.0.0.5 or 10.0.0.0/24';
		o.rmempty = false;

		o = s.option(form.Value, 'comment', _('Comment'));

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = '1';
		o.editable = true;

		return m.render();
	},

	handleSaveApply: function(ev, mode) {
		return this.super('handleSaveApply', [ev, mode]).then(function() {
			return fs.exec('/usr/bin/uspot-walledgarden.sh', ['apply']).then(function() {
				ui.addNotification(null, E('p', _('Walled Garden applied successfully.')), 'info');
			}).catch(function() {
				ui.addNotification(null, E('p', _('Saved. Could not apply live.')), 'warning');
			});
		});
	}
});
