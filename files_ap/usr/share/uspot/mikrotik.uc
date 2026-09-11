// SPDX-License-Identifier: GPL-2.0-only
// ============================================================================
// Horus-Spot — MikroTik hotspot template engine for uspot
// ----------------------------------------------------------------------------
// Renders standard MikroTik RouterOS hotspot pages (login.html, status.html,
// logout.html, alogin.html, error.html, ...) so they can be served verbatim by
// uspot. Supports the MikroTik template directives actually used by those pages:
//   $(var)                          variable substitution
//   $(if COND) ... $(endif)         conditional block
//   $(if COND) ... $(else) ... $(endif)
//   $(if COND) ... $(elif COND) ... $(endif)
// where COND is one of:  name   |   name == 'x'   |   name == "x"   |   name != 'x'
//
// CHAP note: MikroTik pages compute the password with
//   hexMD5('$(chap-id)' + password + '$(chap-challenge)')
// where chap-id / chap-challenge are emitted as octal escapes (\NNN) that the
// standard md5.js reads back as raw bytes. We emit chap-id = \000 (RADIUS CHAP
// ident 0, matching uspot's radius-client) and chap-challenge = octal escapes of
// the per-client challenge bytes, so the resulting hex is exactly the CHAP
// response uspot expects.
// ============================================================================

'use strict';

let fs = require('fs');

// read a template/asset file, empty string on failure
function read_file(path) {
	let data = fs.readfile(path);
	return data ? data : '';
}

// strip a single pair of surrounding quotes (' or ")
function unquote(s) {
	let n = length(s);
	if (n >= 2) {
		let a = substr(s, 0, 1);
		let b = substr(s, n - 1, 1);
		if ((a == "'" && b == "'") || (a == '"' && b == '"'))
			return substr(s, 1, n - 2);
	}
	return s;
}

// value considered "true" for a bare $(if name)
function truthy(v) {
	return !(v == null || v == '' || v == '0' || v == false);
}

// evaluate a MikroTik condition string against the vars object V
function eval_cond(cond, V) {
	cond = trim(cond);
	let m = match(cond, /^([A-Za-z0-9_.-]+)[ \t]*(==|!=)[ \t]*(.*)$/);
	if (m) {
		let name = m[1];
		let op = m[2];
		let rhs = unquote(trim(m[3]));
		let lv = V[name];
		lv = (lv == null) ? '' : '' + lv;
		if (op == '==')
			return lv == rhs;
		return lv != rhs;
	}
	return truthy(V[cond]);
}

// convert a hex string (e.g. "A1B2...") to MikroTik octal escapes "\241\262..."
function esc_octal_from_hex(h) {
	let out = '';
	let n = length(h);
	for (let i = 0; i + 1 < n; i += 2) {
		let b = hex(substr(h, i, 2)) || 0;
		out += sprintf('\\%03o', b);
	}
	return out;
}

// human readable byte count (MikroTik-style)
function bytes_nice(n) {
	n = +n || 0;
	let u = [ 'B', 'KiB', 'MiB', 'GiB', 'TiB' ];
	let i = 0;
	let v = n;
	while (v >= 1024 && i < length(u) - 1) {
		v /= 1024;
		i++;
	}
	return sprintf(i ? '%.1f %s' : '%d %s', v, u[i]);
}

// seconds -> HH:MM:SS
function duration_nice(s) {
	s = +s || 0;
	return sprintf('%02d:%02d:%02d', int(s / 3600), int((s % 3600) / 60), int(s % 60));
}

// render a MikroTik template string with the given vars
function render(tmpl, V) {
	let out = '';
	let stack = [];		// conditional frames: { parent, active, any }
	let pos = 0;
	let n = length(tmpl);

	function emitting() {
		return length(stack) ? stack[length(stack) - 1].active : true;
	}

	while (pos < n) {
		let rel = index(substr(tmpl, pos), '$(');
		if (rel < 0) {
			if (emitting())
				out += substr(tmpl, pos);
			break;
		}
		let s = pos + rel;
		if (s > pos && emitting())
			out += substr(tmpl, pos, s - pos);

		let erel = index(substr(tmpl, s), ')');
		if (erel < 0) {			// unterminated tag, emit verbatim
			if (emitting())
				out += substr(tmpl, s);
			break;
		}
		let e = s + erel;
		let raw = substr(tmpl, s + 2, e - (s + 2));
		let tag = trim(raw);
		pos = e + 1;

		if (substr(tag, 0, 3) == 'if ') {
			let parent = emitting();
			let r = parent && eval_cond(substr(tag, 3), V);
			push(stack, { parent, active: r, any: r });
		} else if (substr(tag, 0, 5) == 'elif ') {
			let f = stack[length(stack) - 1];
			if (!f)
				continue;
			if (f.any) {
				f.active = false;
			} else {
				let r = f.parent && eval_cond(substr(tag, 5), V);
				f.active = r;
				f.any = r;
			}
		} else if (tag == 'else') {
			let f = stack[length(stack) - 1];
			if (!f)
				continue;
			f.active = f.parent && !f.any;
			f.any = true;
		} else if (tag == 'endif') {
			pop(stack);
		} else {
			// plain variable substitution
			if (emitting()) {
				let v = V[raw];
				if (v == null)
					v = V[tag];
				out += (v == null) ? '' : '' + v;
			}
		}
	}

	return out;
}

return { read_file, render, eval_cond, esc_octal_from_hex, bytes_nice, duration_nice };
