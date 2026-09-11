'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('uspot', _('Portal Pages'), _('Upload and manage the captive portal login pages.'));

		s = m.section(form.NamedSection, 'hotspot', 'uspot', _('Login Page Management'));

		o = s.option(form.FileUpload, 'login_page_html', _('Login Page HTML'));
		o.root_directory = '/www/uspot';
		o.enable_upload = true;
		o.enable_remove = true;
		o.description = _('Upload your custom login.html or portal files here. They will be available at http://192.168.1.1/uspot/ (or your router IP).');

		o = s.option(form.FileUpload, 'login_page_css', _('Login Page CSS/Assets'));
		o.root_directory = '/www/uspot';
		o.enable_upload = true;
		o.enable_remove = true;

		return m.render();
	}
});
