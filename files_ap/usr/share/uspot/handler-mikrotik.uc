{%
// SPDX-License-Identifier: GPL-2.0-only
// ============================================================================
// Horus-Spot — MikroTik hotspot handler for uspot
// ----------------------------------------------------------------------------
// Serves standard MikroTik RouterOS hotspot pages locally and drives uspot's
// RADIUS backend, so SAS (registered as a MikroTik NAS) authenticates clients
// exactly as it would a real MikroTik. Reuses portal.uc (client lookup + ubus
// auth) and uam.c (challenge) unchanged; only adds this handler + mikrotik.uc.
//
// uhttpd routes (document_root = /www/uspot):
//   /login  -> GET renders login.html (MAC auto-login first), POST authenticates
//   /status -> GET renders status.html for the connected client
//   /logout -> logs the client off, renders logout.html
// Static assets (css/, img/, md5.js, favicon.ico) are served by uhttpd directly.
// ============================================================================

'use strict';

push(REQUIRE_SEARCH_PATH, "/usr/share/uspot/*.uc");

import { urlencode, ENCODE_FULL } from 'lucihttp';

let portal = require('portal');
let uam = require('uam');
let mt = require('mikrotik');

let DOCROOT = '/www/uspot';

function send_page(file, V) {
	print("Status: 200 OK\r\n");
	print("Content-Type: text/html; charset=UTF-8\r\n");
	print("Cache-Control: no-cache, no-store, must-revalidate\r\n\r\n");
	print(mt.render(mt.read_file(DOCROOT + '/' + file), V));
}

// original destination the client was trying to reach
function orig_dst(ctx) {
	let dst = ctx.form_data?.dst || ctx.query_string?.dst;
	if (dst)
		return dst;
	let host = ctx.env.HTTP_HOST || ctx.env.SERVER_ADDR;
	return 'http://' + host + '/';
}

// build the common MikroTik template variables
function base_vars(ctx) {
	let dst = orig_dst(ctx);
	return {
		'link-login':       '/login',
		'link-login-only':  '/login',
		'link-logout':      '/logout',
		'link-status':      '/status',
		'link-advert':      dst,
		'link-orig':        dst,
		'link-orig-esc':    urlencode(dst, ENCODE_FULL),
		'link-redirect':    dst,
		'link-redirect-esc':urlencode(dst, ENCODE_FULL),
		'mac':              ctx.format_mac,
		'mac-esc':          urlencode(ctx.format_mac, ENCODE_FULL),
		'ip':               ctx.env.REMOTE_ADDR,
		'hostname':         ctx.env.SERVER_ADDR,
		'username':         ctx.query_string?.username || ctx.form_data?.username || '',
		'error':            ctx.error_msg || '',
		'trial':            'no',
		'login-by':         '',
		'popup':            'true',
	};
}

// inject CHAP variables so MikroTik md5.js produces the response uspot expects
function chap_vars(ctx, V) {
	let challenge = uam.md5(ctx.config.challenge, ctx.format_mac);	// 32 hex chars
	ctx.chap_challenge = challenge;
	V['chap-id'] = '\\000';						// RADIUS CHAP ident 0
	V['chap-challenge'] = mt.esc_octal_from_hex(challenge);
	return V;
}

// mark the client as authenticated in the firewall backend
function enable_client(ctx) {
	ctx.ubus.error();	// clear pending error
	ctx.ubus.call('uspot', 'client_enable', {
		uspot: ctx.uspot,
		address: ctx.mac,
	});
	return !ctx.ubus.error();
}

// render the "you are logged in" page which bounces to the original URL
function page_alogin(ctx) {
	send_page('alogin.html', base_vars(ctx));
}

// render the login page (optionally with an error message)
function page_login(ctx, error_msg) {
	ctx.error_msg = error_msg;
	let V = base_vars(ctx);
	if (ctx.config.challenge)
		chap_vars(ctx, V);
	send_page('login.html', V);
}

// GET /status — usage for the connected client
function page_status(ctx) {
	let V = base_vars(ctx);
	let data = ctx.ubus.call('uspotfilter', 'client_get', { interface: ctx.uspot, address: ctx.mac }) || {};
	let acct = data?.accounting || {};
	V['bytes-in-nice']  = mt.bytes_nice(acct.bytes_dl || data.bytes_dl || 0);
	V['bytes-out-nice'] = mt.bytes_nice(acct.bytes_ul || data.bytes_ul || 0);
	V['uptime'] = mt.duration_nice(ctx.seconds_remaining != null ? (data.connect ? (time() - data.connect) : 0) : 0);
	if (ctx.seconds_remaining)
		V['session-time-left'] = mt.duration_nice(ctx.seconds_remaining);
	V['login-by'] = 'username';
	send_page('status.html', V);
}

// POST /login — verify credentials (CHAP) against SAS via uspot backend
function do_login(ctx) {
	let username = ctx.form_data.username;
	let password = ctx.form_data.password;	// already hexMD5(chap-id + pass + chap-challenge)

	if (!username || password == null) {
		page_login(ctx, 'Please enter username and password');
		return;
	}

	let challenge = uam.md5(ctx.config.challenge, ctx.format_mac);
	let extra = {
		'WISPr-Logoff-URL': sprintf('http://%s/logout', ctx.env.SERVER_ADDR),
	};

	let auth = portal.uspot_auth(ctx, username, password, challenge, extra);
	if (+auth?.['access-accept']) {
		if (!enable_client(ctx)) {
			page_login(ctx, 'internal error');
			return;
		}
		page_alogin(ctx);
		return;
	}

	let msg = auth?.reply?.['Reply-Message'] || 'invalid username or password';
	portal.debug(ctx, 'mikrotik login failed: ' + msg);
	page_login(ctx, msg);
}

// GET /logout — put the client back to pre-auth state
function do_logout(ctx) {
	ctx.ubus.call('uspot', 'client_remove', {
		uspot: ctx.uspot,
		address: ctx.mac,
	});
	send_page('logout.html', base_vars(ctx));
}

global.handle_request = function(env) {
	let ctx = portal.handle_request(env);
	if (!ctx)
		return;			// portal already emitted an error page

	let script = ctx.env.SCRIPT_NAME;

	if (script == '/logout' || script == '/logoff') {
		do_logout(ctx);
		return;
	}

	if (script == '/status') {
		page_status(ctx);
		return;
	}

	// /login (default)
	if (ctx.connected) {		// already authenticated -> bounce out
		page_alogin(ctx);
		return;
	}

	// form POST -> authenticate
	if (ctx.env.REQUEST_METHOD == 'POST' && ctx.form_data?.username != null) {
		do_login(ctx);
		return;
	}

	// GET: try MAC auto-login first (registered devices open silently)
	if (+ctx.config.mac_auth) {
		let auth = portal.uspot_auth(ctx);
		if (+auth?.['access-accept'] && enable_client(ctx)) {
			page_alogin(ctx);
			return;
		}
	}

	page_login(ctx, null);
};

%}
