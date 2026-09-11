# Horus-Spot — دليل الربط النهائي (uhttpd + الجدار + شبكة الكابتف)

> يُطبَّق **يدوياً وبتأنٍّ** بعد التفليش. لا يُطبَّق آلياً لأن ربط البوابة على بورت 80 قد يتعارض مع لوحة LuCI ويقفل الوصول للراوتر.

النظام يعمل هكذا: العميل غير المسجّل تُعترض تصفحته وتُحوَّل إلى صفحة MikroTik المحلية (`/login`) التي يخدمها `handler-mikrotik.uc`؛ الصفحة تحسب CHAP وترسله؛ uspot يصادق عبر RADIUS ضد SAS (المسجّل كـ NAS نوع Mikrotik)؛ ثم يُفتح النت وتُطبَّق السرعة/الكوتا من رد SAS، والمحاسبة والفصل (CoA) يشتغلان native.

---

## القرار المطلوب أولاً: أين تعمل البوابة؟

- **(الموصى به) واجهة ضيوف مخصّصة `captive`:** البوابة تملك بورت 80 على شبكة منفصلة، وLuCI تبقى على الـ LAN بلا تعارض. الأنظف والأأمن.
- **(بديل) مشاركة الـ LAN:** لازم تنقل LuCI لبورت آخر (مثلاً 8080) أو تشغّل البوابة على 3990 فقط، وإلا تعارض بورت 80.

الأمثلة تحت تفترض واجهة `captive` على `10.0.0.1/24`. لو هتشارك الـ LAN، استبدل الـ IP وبدّل `option interface 'lan'` في `/etc/config/uspot`.

---

## 1) واجهة الكابتف + DHCP (اختياري لو عندك واجهة ضيوف بالفعل)

```
uci set network.captive=interface
uci set network.captive.proto='static'
uci set network.captive.ipaddr='10.0.0.1'
uci set network.captive.netmask='255.255.255.0'
# اربطها بجهاز/‏SSID الضيوف حسب إعدادك (bridge/vlan)

uci set dhcp.captive=dhcp
uci set dhcp.captive.interface='captive'
uci set dhcp.captive.start='10'
uci set dhcp.captive.limit='240'
uci set dhcp.captive.leasetime='1h'
uci commit
```

ثم في `/etc/config/uspot` اضبط: `option interface 'captive'` و`option uam_server 'http://10.0.0.1/login'`.

---

## 2) uhttpd — instances البوابة (توجيه لصفحات MikroTik)

```
# --- بوابة الكابتف على بورت 80 لواجهة captive فقط ---
uci set uhttpd.uspot=uhttpd
uci add_list uhttpd.uspot.listen_http='10.0.0.1:80'
uci set uhttpd.uspot.redirect_https='0'
uci set uhttpd.uspot.max_requests='5'
uci set uhttpd.uspot.no_dirlists='1'
uci set uhttpd.uspot.home='/www/uspot'
uci add_list uhttpd.uspot.ucode_prefix='/login=/usr/share/uspot/handler-mikrotik.uc'
uci add_list uhttpd.uspot.ucode_prefix='/logon=/usr/share/uspot/handler-mikrotik.uc'
uci add_list uhttpd.uspot.ucode_prefix='/status=/usr/share/uspot/handler-mikrotik.uc'
uci add_list uhttpd.uspot.ucode_prefix='/logout=/usr/share/uspot/handler-mikrotik.uc'
uci add_list uhttpd.uspot.ucode_prefix='/logoff=/usr/share/uspot/handler-mikrotik.uc'
uci add_list uhttpd.uspot.ucode_prefix='/cpd=/usr/share/uspot/handler-cpd.uc'
uci set uhttpd.uspot.error_page='/login'      # أي طلب غير معروف => صفحة الدخول (سلوك الكابتف)

# --- منفذ UAM 3990 (توافق إعادة توجيه UAM) ---
uci set uhttpd.uam3990=uhttpd
uci add_list uhttpd.uam3990.listen_http='10.0.0.1:3990'
uci set uhttpd.uam3990.redirect_https='0'
uci set uhttpd.uam3990.max_requests='5'
uci set uhttpd.uam3990.no_dirlists='1'
uci set uhttpd.uam3990.home='/www/uspot'
uci add_list uhttpd.uam3990.ucode_prefix='/login=/usr/share/uspot/handler-mikrotik.uc'
uci add_list uhttpd.uam3990.ucode_prefix='/logon=/usr/share/uspot/handler-mikrotik.uc'
uci add_list uhttpd.uam3990.ucode_prefix='/logout=/usr/share/uspot/handler-mikrotik.uc'
uci add_list uhttpd.uam3990.ucode_prefix='/logoff=/usr/share/uspot/handler-mikrotik.uc'
uci commit uhttpd

# تأكّد أن instance 'main' (LuCI) لا يستمع على 10.0.0.1:80
/etc/init.d/uhttpd restart
```

> **تحذير:** لو هتشارك الـ LAN، انقل LuCI أولاً: `uci del uhttpd.main.listen_http; uci add_list uhttpd.main.listen_http='192.168.100.1:8080'; uci commit uhttpd` — وإلا تعارض بورت 80.

---

## 3) الجدار الناري — السماح بالبوابة و DAE، ومنع التخطي

قواعد `nftables` للاعتراض ومنع التخطي في `files_ap/etc/nftables.d/10-horus-spot-security.nft`. أضف قواعد firewall4 للسماح:

```
# السماح للعميل بالوصول لبوابة الدخول
uci add firewall rule
uci set firewall.@rule[-1].name='Allow-captive-portal'
uci set firewall.@rule[-1].src='captive'
uci set firewall.@rule[-1].dest_port='80 443 3990'
uci set firewall.@rule[-1].proto='tcp'
uci set firewall.@rule[-1].target='ACCEPT'

# السماح لسيرفر SAS فقط بإرسال أوامر الفصل CoA/Disconnect (DAE)
uci add firewall rule
uci set firewall.@rule[-1].name='Allow-SAS-DAE'
uci set firewall.@rule[-1].src='wan'
uci set firewall.@rule[-1].src_ip='192.168.100.254'   # CHANGE-ME: IP سيرفر SAS
uci set firewall.@rule[-1].dest_port='3799'
uci set firewall.@rule[-1].proto='udp'
uci set firewall.@rule[-1].target='ACCEPT'
uci commit firewall
/etc/init.d/firewall restart
```

---

## 4) اختبار سريع بعد الربط

```
ubus call uspot status                     # الخدمة شغالة
logread -e uspot                           # تتبّع الدخول
# من جهاز عميل: افتح أي موقع -> يتحوّل لصفحة MikroTik login
# سجّل دخول بمشترك/كارت SAS -> يفتح النت
# تحقّق السرعة:
tc -s qdisc show
# اختبر الفصل من SAS (بعد ضبط nas):
# radclient <router_ip>:3799 disconnect <secret>  (من جهة SAS)
```

---

## ملاحظات

- في `/etc/config/uspot` اضبط قيم `CHANGE-ME` (IP وSecret الـ SAS، `nasmac`، `uam_server`).
- سجّل الراوتر في لوحة SAS كـ NAS نوع **Mikrotik** بنفس الـ secret و`coa_port=3799`.
- لمستخدمي الماك (auto-login): أنشئ لكل ماك مستخدماً في SAS باسورده = الماك بصيغة `AA:BB:CC:DD:EE:FF`.
