# مواصفات وخطة: جعل Horus-Spot (uspot) متوافقاً 100% مع SAS بمحاكاة MikroTik كاملة

> **الحالة:** مسوّدة للمراجعة والاعتماد قبل التنفيذ. لا يوجد أي كود وظيفي تم تعديله بعد.
> **القرار المعتمد من المستخدم:** المسار الكامل لمحاكاة MikroTik — SAS يجب أن يتعامل مع الراوتر *كأنه ميكروتيك بكل التفاصيل* (لوجن/أكتف/محاسبة/فصل عند انتهاء الكوتا)، مع إمكانية رفع صفحات هوتسبوت MikroTik كما هي، وإمكانية فتح النت لجهاز **بدون RADIUS** عبر تسجيل الماك في واجهة uspot مع كومنت.

---

## 0. الخلاصة التنفيذية

- **SAS ليس بوابة دخول** — هو سيرفر **FreeRADIUS** فقط. أي توافق = توافق على مستوى بروتوكول RADIUS + شكل صفحة الدخول التي يستضيفها الراوتر.
- الوضع الحالي لقسم uspot في المشروع هو **سقالة موثّقة جيداً لكن غير موصولة وظيفياً**؛ لن يصادق ضد SAS كما هو (تفاصيل في القسم 4).
- **uspot هو الأساس الأنسب** للبناء عليه (مقارنة بالبدائل في القسم 2)، لأنه يملك أصلاً: RADIUS auth، MAC auth، محاسبة interim، **CoA/Disconnect** (RFC 5176 عبر `radius-das.c`)، ومسار **CHAP** في وضع UAM. الناقص فقط: **سمات MikroTik VSA** و**رندر قوالب صفحات MikroTik** وواجهة **MAC bypass محلي**.
- الخطة تحوّل uspot إلى «ميكروتيك افتراضي» بأربعة تعديلات محدّدة + كونفيج صحيح + تسجيل NAS في SAS بنوع Mikrotik.

---

## 1. عقد RADIUS الحقيقي مع SAS (مستخرَج من كود السيرفر)

مصادر الاستخراج: `sites-enabled/default`، `mods-enabled/sasauth`، `mods-enabled/carduser`، `mods-enabled/sql`، `clients.conf`.

| العملية | ما يتطلبه SAS بالضبط (سطر الكود) | ما يقع على الراوتر |
| :--- | :--- | :--- |
| **تسجيل الـ NAS** | `read_clients = yes`، `client_table = "sas_nas"` — يقرأ الراوترات من قاعدة البيانات. النوع من `sas_nas.type` (0=Generic, **1=Mikrotik**, 2=Cisco, 3=UBNT, 4=EdgeRouter, 5=Nokia). | لازم يتسجّل الراوتر في لوحة SAS كـ **Mikrotik** بـ IP + secret + coa_port؛ و`NAS-IP-Address`/secret في uspot يطابقان السجل. |
| **دخول مشترك** | `authenticate { Auth-Type PAP{pap} Auth-Type CHAP{chap} Auth-Type MS-CHAP{mschap} }` — يدعم الثلاثة. التحقق من كلمة السر من SQL. | uspot يرسل Access-Request (CHAP كالميكروتيك، أو PAP). |
| **كروت/فاوتشر** | `carduser: register_card_user %{User-Name} %{Calling-Station-Id}` في authorize — **يسجّل الكارت تلقائياً أول دخول**؛ اسم المستخدم = كود الكارت. ثم `sas_cli user_exists` ومسار `false,accept` مع `Auth-Type := Accept`. | نفس مسار الدخول العادي؛ لا حاجة لأي منطق خاص بالراوتر — الكارت يُنشأ في السيرفر. |
| **دخول MAC أوتوماتيك** | `if (User-Password=='') { User-Password := "%{User-Name}" }` — أي **MAC-Auth = User-Name يساوي الماك، والباسورد يساوي الماك**. | uspot MAC-auth يرسل `User-Name=<mac>` و`User-Password=<mac>` بصيغة الماك المتوقعة. مستخدم الماك لازم يكون معرّفاً في SAS بباسورد = الماك. |
| **السرعة والكوتا** | `sasauth` في post-auth يولّد سمات **MikroTik VSA** (Vendor 14988): `Mikrotik-Rate-Limit` (attr 8)، `Mikrotik-Total-Limit` (attr 17)، مع `Session-Timeout` و`Acct-Interim-Interval`. | الراوتر يقرأ هذه السمات ويطبّق rate-limit + quota + مؤقّت الجلسة. **(هنا التعديل الأساسي في uspot).** |
| **المحاسبة** | `sas_acct start/update/stop %{Acct-Unique-Session-Id} %{Acct-Output-Gigawords} %{Acct-Output-Octets} %{Acct-Input-Gigawords} %{Acct-Input-Octets} %{Acct-Session-Time}` | uspot يرسل Start + Interim دوري + Stop بعدادات صحيحة (Octets + Gigawords) و`Acct-Session-Id` ثابت. |
| **الفصل اللحظي (انتهاء الكوتا)** | `sas_dispoller` يرسل `Disconnect-Request` (RFC 5176) على بورت CoA. | uspot يستمع على `das_port` بنفس الـ secret وينفّذ الفصل فوراً. |

### صيغ الماك المتوقعة
- `Calling-Station-Id` = ماك العميل. MikroTik يرسله بصيغة `AA:BB:CC:DD:EE:FF` (حروف كبيرة، نقطتان). لازم `format_mac` في uspot يطابق ذلك.
- `Called-Station-Id` = عند MikroTik غالباً `<AP-MAC>:<SSID>` أو اسم سيرفر الهوتسبوت. يُضبط عبر `nasmac`/`location` في uspot.

---

## 2. لماذا uspot وليس بديلاً آخر؟ (إجابة سؤال «غير uspot»)

لا يوجد أي بوابة OpenWrt جاهزة ترندر قوالب صفحات MikroTik (`$(chap-id)`, `$(link-login-only)`) *أصلاً* — هذه ميزة حصرية لـ RouterOS. لذلك **أي حل سيتطلب كوداً مخصصاً** لمحاكاة الميكروتيك؛ السؤال الحقيقي: أي أساس يعطي أقل جهد وأعلى استقرار.

| المحرّك | المزايا | العيوب لهدفنا | الحكم |
| :--- | :--- | :--- | :--- |
| **uspot** (الحالي) | ucode سهل الترقيع، حديث، مدموج مع firewall4/nftables وLuCI، فيه RADIUS + MAC auth + accounting + **CoA/Disconnect** + مسار **CHAP/UAM** جاهز. مدمج بالفعل في البناء. | يحتاج ترقيع لسمات MikroTik VSA ورندر قوالب MikroTik. | ✅ **الأساس المختار** — أقل مسافة للهدف وأسهل صيانة. |
| **CoovaChilli** | عريق ومجرَّب 15+ سنة، UAM/CHAP قوي، WISPr/ChilliSpot، CoA، walled garden. | مكتوب بلغة C (ترقيع أصعب بكثير من ucode)، لا يقرأ MikroTik VSA أصلاً، تكامل LuCI/nftables أضعف على 24.10، لا يرندر قوالب MikroTik. | بديل معقول لكن جهد الصيانة أعلى. |
| **opennds / nodogsplash** | خفيف وبسيط (FAS). | RADIUS عبر إضافة محدودة، لا CHAP MikroTik، أبعد ما يكون عن محاكاة ميكروتيك. | غير مناسب. |
| **حل مخصّص كامل** | تحكّم تام. | إعادة اختراع محاسبة/CoA/جدار حماية مجرّبة — مخاطرة عالية. | غير مبرّر. |

**التوصية:** الاستمرار مع **uspot** وإضافة طبقة «MikroTik Emulation» فوقه. هذا يعيد استخدام أصعب الأجزاء (المحاسبة، CoA، جدار الحماية) الجاهزة والمجرّبة، ويحصر التطوير في الترجمة والقوالب.

---

## 3. المخطط الفعلي لـ uspot الرسمي (أرضية التعديل)

من مصدر `f00b4r0/uspot` (فرع `next`) — الأسماء الحقيقية للاعتماد عليها في الترقيع:

**المعالِجات (ucode handlers) عبر uhttpd:**
- `/usr/share/uspot/handler.uc` — البوابة الرئيسية (رندر صفحة الدخول).
- `/usr/share/uspot/handler-uam.uc` — مسار `/logon` (مصادقة UAM، **هنا مسار CHAP**).
- `/usr/share/uspot/handler-cpd.uc` — كشف الكابتف بورتال (CPD).
- `/usr/share/uspot/handler-api.uc` — RFC 8908 (Captive Portal API).
- `radius-das.c` — سيرفر CoA/Disconnect (RFC 5176) على `das_port` (افتراضي 3799).

**خيارات الكونفيج الحقيقية `/etc/config/uspot`:**
`auth_mode` (`click-to-continue`|`credentials`|`radius`|`uam`)، `interface`، `setname` (اسم ipset)، `idle_timeout`، `session_timeout`، `disconnect_delay`، `ratelimit_def`، `debug`،
RADIUS: سيرفر أساسي/احتياطي + منافذ auth/acct + secret، `nasid`، `nasmac`، `format_mac`، `mac_auth`، `mac_passwd`، `mac_suffix`، `das_port`،
UAM: `uam_port` (3990)، `uam_secret`، `uam_server`، `challenge`، `uam_sslurl`،
CPA: `cpa_can_extend`، `cpa_venue_url`.

**آليات مهمة جاهزة:**
- **MAC bypass محلي:** `ubus call uspot client_auth {mac}` ثم `ubus call uspot client_enable {mac}` — يسمح بتفويض ماك محلياً بدون RADIUS (أساس ميزة «فتح النت بدون ريديس»).
- **CHAP:** في وضع UAM، `challenge` يُستخدم كتحدّي CHAP — نقطة الارتكاز لمحاكاة CHAP بتاع MikroTik.

---

## 4. تحليل الفجوات: الحالي مقابل المطلوب

| # | العنصر الحالي في المشروع | المشكلة | الأثر |
| :-- | :--- | :--- | :--- |
| 1 | `files_ap/etc/config/uspot` | يستخدم خيارات **مخترَعة** (`radius_server_1`, `uam_server`, `radius_nas_id`, `hybrid_mikrotik`, `strict_dns_hijack`, `block_ipv6`) ليست من مخطط uspot، و`enabled '0'`. | uspot يتجاهلها → **لا مصادقة إطلاقاً**. |
| 2 | `files_ap/usr/share/uspot/hybrid_mikrotik.uc` | uspot الرسمي **لا يستدعيه**؛ + باج: `let match = match(...)` يظلّل الدالة. | **كود ميت**؛ سمات MikroTik لا تُقرأ → لا سرعات ولا كوتا. |
| 3 | `files_ap/www/uspot/login.html` | stub فاضي، بلا فورم ولا قوالب MikroTik. | لا صفحة دخول فعلية. |
| 4 | واجهات LuCI في `www/luci-static/.../uspot_custom/` | مبنية حول الخيارات المخترَعة (nas.js/settings.js/advanced.js). | تحرّر كونفيج لا يفهمه uspot. |
| 5 | `10-horus-spot-security.nft` | موجود لكن غير مربوط بحالة uspot (ipset `setname`). | قواعد الحماية قد لا تُستثني منها الأجهزة المصرّح لها. |
| ✅ | `05-configure.sh:282 cp -r ../files_ap/* files/` | يعمل. | الملفات **تُنسخ فعلاً** للصورة (هذه النقطة سليمة). |

---

## 5. التصميم التفصيلي لكل عملية

### 5.1 دخول المشترك (username/password) — بأسلوب MikroTik CHAP
- **الوضع:** `auth_mode 'uam'` (يفعّل CHAP + استضافة صفحة على 3990) مع RADIUS backend لـ SAS.
- **التدفق:**
  1. جهاز غير مصرّح → إعادة توجيه إلى صفحة الدخول (`handler.uc`).
  2. الصفحة (قالب MikroTik) تحتوي `$(chap-id)` + `$(chap-challenge)` يولّدهما uspot لكل جلسة.
  3. جافاسكربت MikroTik: `password = hexMD5(chap-id + plaintext + chap-challenge)` ثم POST إلى `$(link-login-only)`.
  4. `handler-uam.uc` يبني `Access-Request` بـ `CHAP-Password = 0x<chap-id> + <16-byte hash>` و`CHAP-Challenge = <challenge>`.
  5. SAS `Auth-Type CHAP { chap }` يتحقق مقابل Cleartext-Password من SQL → `Access-Accept` + سمات MikroTik.
- **التعديل المطلوب:** ربط `$(chap-id)/$(chap-challenge)` بتحدّي uspot لكل جلسة (بدل `challenge` الثابت)، وقبول أسماء حقول MikroTik (`username`, `password`, `dst`, `popup`).

### 5.2 الكروت/الفاوتشر (carduser)
- **لا منطق خاص على الراوتر.** الكارت = مستخدم عادي اسمه كود الكارت. `carduser` في SAS ينشئه/يفعّله أول دخول.
- الصفحة يمكن أن تحوي تبويب «كارت» يضع الكود في حقلي username وpassword (أو username فقط والباسورد يساويه عبر قاعدة `User-Password==''`).
- **قبول:** إدخال كود كارت جديد → ينجح الدخول ويظهر الكارت مُفعّلاً في لوحة SAS.

### 5.3 دخول MAC أوتوماتيك (بدون كتابة بيانات)
- **الوضع:** `mac_auth '1'` + `mac_passwd` مضبوط بحيث `User-Password = <mac>` (مطابقة قاعدة SAS).
- **التدفق:** قبل عرض الصفحة، uspot يجرّب Access-Request بـ `User-Name=<mac>` و`User-Password=<mac>`. لو المستخدم موجود في SAS (ماك مسجّل) → دخول صامت؛ غير ذلك → تُعرض صفحة الدخول.
- **صيغة الماك:** `format_mac` = `AA:BB:CC:DD:EE:FF` (حروف كبيرة) لمطابقة توقّع SAS.
- **التعديل المطلوب:** ضبط `mac_suffix`/`mac_passwd` لإنتاج «الباسورد = الماك» بدل باسورد ثابت.

### 5.4 السرعة والكوتا — قراءة MikroTik VSA (التعديل الجوهري)
- **الناقص:** uspot يقرأ WISPr/ChilliSpot، وSAS يرسل `Mikrotik-Rate-Limit` + `Mikrotik-Total-Limit`.
- **الحل:** ترقيع معالج رد RADIUS في uspot (ucode) لتفسير:
  - `Mikrotik-Rate-Limit` (14988-8): الصيغة `rx-rate[/tx-rate] [burst...]`؛ `rx=رفع العميل`، `tx=تنزيل العميل`. تُترجم إلى rate-limit في uspot/nft/tc. (منطق `hybrid_mikrotik.uc` يُعاد استخدامه بعد إصلاح الباج ودمجه فعلياً.)
  - `Mikrotik-Total-Limit` (14988-17): حد إجمالي البايتات → كوتا محلية.
  - Fallback: WISPr-Bandwidth-Max-Up/Down لو وُجدت.
- الوحدات: `k`/`M`/`G` مدعومة.

### 5.5 المحاسبة (Accounting)
- **الوضع:** RADIUS accounting مفعّل بـ `Acct-Interim-Interval` من الرد (افتراضي 60ث).
- uspot يرسل Start عند الدخول، Interim دورياً، Stop عند الخروج/الفصل — مع `Acct-Input/Output-Octets` + `-Gigawords` و`Acct-Session-Time` و`Acct-Session-Id` ثابت. (uspot يدعم هذا أصلاً؛ فقط نضبط الفاصل والصيغة.)
- **قبول:** عدادات لوحة SAS تتحرّك بدقة أثناء الجلسة.

### 5.6 الفصل اللحظي عند انتهاء الكوتا (CoA/Disconnect)
- **جاهز في uspot** عبر `radius-das.c`. نضبط فقط `das_port` (3799) ونفس الـ secret ونحصر مصدر الـ CoA على IP سيرفر SAS (لأن السيرفر «بسيط بلا حماية» حسب التوثيق).
- **التدفق:** تنتهي جيجات المشترك → `sas_dispoller` يرسل `Disconnect-Request` بمُعرّف الجلسة/الماك → uspot يفصل فوراً.
- **قبول:** `radclient ... disconnect` من SAS يقطع الجهاز خلال أجزاء الثانية.

### 5.7 صفحات هوتسبوت MikroTik (رندر `$()` + CHAP)
- **المطلوب:** رفع صفحات MikroTik كما هي وتشغيلها. نضيف طبقة رندر في `handler.uc` تستبدل متغيرات MikroTik:
  - روابط: `$(link-login)`, `$(link-login-only)`, `$(link-logout)`, `$(link-status)`, `$(link-orig)`.
  - CHAP: `$(chap-id)`, `$(chap-challenge)`.
  - بيانات: `$(mac)`, `$(ip)`, `$(username)`, `$(session-id)`, `$(server-name)`, `$(hostname)`, `$(trial)`.
  - أخطاء: `$(error)`, `$(error-orig)`.
- ملفات القوالب توضع في `/www/uspot/` (login.html, alogin.html, status.html, logout.html, error.html, md5.js) بأسماء MikroTik.
- **قبول:** ملف `login.html` قياسي من مصمم صفحات MikroTik/SAS يعمل بلا تعديل.

### 5.8 فتح النت بدون RADIUS — MAC bypass بواجهة + كومنت (مثل IP-Binding=bypassed)
- **التخزين:** قسم في `/etc/config/uspot` أو ملف جانبي: `config whitelist` بحقول `mac` + `comment` + `enabled`.
- **التطبيق:** سكربت `uspot-maclist.sh` يمرّ على القائمة وينفّذ `ubus call uspot client_auth/client_enable` لكل ماك (أو يضيفه لـ ipset المصرّح `setname`) — بدون أي RADIUS. يُعاد التطبيق عبر hotplug عند إعادة اتصال الجهاز/الإقلاع.
- **الواجهة:** صفحة LuCI (توسيع `clients.js`) بجدول: إضافة/حذف ماك + كومنت + زر تفعيل/تعطيل، وعرض حالة (مصرّح محلياً / RADIUS / غير مصرّح).
- **قبول:** إضافة ماك في الواجهة → الجهاز ينفتح له النت فوراً بدون سيرفر، ويظل بعد إعادة التشغيل.

### 5.9 الحماية ضد التخطي (nftables)
- مراجعة `10-horus-spot-security.nft` لضمان أنه يستثني ipset الأجهزة المصرّح لها (`setname`) ولا يكسر MAC bypass، مع إبقاء: hijack DNS، إسقاط IPv6/QUIC/ICMP للـ WAN قبل الدخول، والربط IP+MAC.

---

## 6. مخطط `/etc/config/uspot` النهائي (بالمخطط الصحيح — للمراجعة)

```
config uspot 'hotspot'
    option auth_mode        'uam'          # UAM: يفعّل CHAP + استضافة الصفحة
    option interface        'captive'      # واجهة/شبكة الهوتسبوت المخصّصة
    option setname          'uspot'        # ipset المصرّح لهم
    option idle_timeout     '600'
    option session_timeout  '0'            # 0 = من RADIUS (Session-Timeout)
    option format_mac       'aa:bb:cc:dd:ee:ff'  # حروف كبيرة، نقطتان

    # RADIUS (SAS)
    option auth_server      '<SAS_IP>'
    option auth_port        '1812'
    option acct_server      '<SAS_IP>'
    option acct_port        '1813'
    option auth_secret      '<SHARED_SECRET>'   # = secret في سجل sas_nas
    option acct_secret      '<SHARED_SECRET>'
    option nasid            'HorusNAS'           # = NAS-Identifier في SAS
    option nasmac           '<AP_MAC>'
    option acct_interval    '60'

    # MAC auto-login (الباسورد = الماك)
    option mac_auth         '1'

    # UAM / CHAP
    option uam_port         '3990'
    option uam_server       'http://<ROUTER_IP>/uspot/login.html'

    # CoA / Disconnect (فصل الكوتا)
    option das_port         '3799'
    option das_secret       '<SHARED_SECRET>'
    list   das_allowed_ip   '<SAS_IP>'          # حصر مصدر CoA على SAS

# فتح النت بدون RADIUS (bypass محلي)
config whitelist
    option mac      'AA:BB:CC:DD:EE:FF'
    option comment  'مدير الشبكة - مكتب'
    option enabled  '1'
```
> أسماء الخيارات النهائية تُثبَّت مقابل نسخة uspot المستخدمة في 24.10 أثناء التنفيذ (قد تختلف `auth_secret` مقابل `radius_secret` إلخ حسب الإصدار الدقيق).

---

## 7. نقاط التعديل (Patches) وطريقة توليدها

يُتبع نفس أسلوب باتشات ath10k عبر `scripts/gen_package_patches.py` + `scripts/10-gen-package-patches.sh`:

1. **Patch A — MikroTik VSA parsing:** في معالج رد RADIUS بـ uspot (ucode) — دمج منطق `hybrid_mikrotik.uc` (بعد إصلاح الباج) لتفسير `Mikrotik-Rate-Limit` + `Mikrotik-Total-Limit` وتطبيقهما.
2. **Patch B — MikroTik template rendering:** في `handler.uc` — دالة استبدال متغيرات `$()` + توليد chap-id/chap-challenge لكل جلسة.
3. **Patch C — MikroTik CHAP login:** في `handler-uam.uc` — قبول حقول MikroTik وبناء `CHAP-Password/CHAP-Challenge`.
4. **Patch D — MAC-as-password:** ضبط توليد `User-Password=<mac>` في مسار mac_auth.
5. **غير مرقّع (ملفات overlay فقط):** قوالب `/www/uspot/*`، سكربت `uspot-maclist.sh`، قسم whitelist، واجهات LuCI، قواعد nft، dictionary الميكروتيك.

> إن لم يقبل الإصدار الترقيع نظيفاً، البديل: استبدال ملفات `/usr/share/uspot/*.uc` كاملة عبر overlay (نسخ ملفاتنا فوق ملفات الباكدج) بدل diff — أبسط للصيانة عبر الإصدارات.

---

## 8. تسجيل الراوتر في SAS (خطوات اللوحة)

1. NAS جديد في لوحة SAS: `nasname=<ROUTER_IP>`، `type=Mikrotik`، `secret=<SHARED_SECRET>`، `coa_port=3799`.
2. مستخدمو الماك (auto-login): إنشاء مستخدم لكل ماك، الباسورد = الماك، بصيغة `AA:BB:CC:DD:EE:FF`.
3. التأكد أن FreeRADIUS يعيد تحميل جدول `sas_nas` (dynamic clients).

---

## 9. إصلاحات لازمة في الملفات الحالية

- **حذف/إعادة كتابة** `files_ap/etc/config/uspot` بالمخطط الصحيح (القسم 6).
- **إصلاح الباج** في `hybrid_mikrotik.uc` سطر 22: `let match = match(...)` → استخدام اسم متغير مختلف (مثل `let m = match(...)`)، ثم دمجه في Patch A.
- **بناء** `login.html` + بقية القوالب بصيغة MikroTik (القسم 5.7) بدل الـ stub.
- **مواءمة** واجهات LuCI (`nas.js/settings.js/clients.js/advanced.js`) مع الخيارات الصحيحة + جدول whitelist.
- **مراجعة** `10-horus-spot-security.nft` لاستثناء ipset المصرّح لهم.
- **توسيع** `98-horus-spot-setup` لتطبيق قائمة الماك عند الإقلاع + تفعيل الخدمة.

---

## 10. خطة التنفيذ على مراحل + معايير القبول

| المرحلة | المحتوى | معيار القبول (اختبار ميداني) |
| :-- | :--- | :--- |
| **M1 — أساس RADIUS** | كونفيج صحيح + تسجيل NAS + دخول مشترك PAP/CHAP. | مشترك يدخل باسمه/باسورده ويتصل بالنت؛ يظهر Online في SAS. |
| **M2 — الكروت + MAC** | تبويب كارت + mac_auth بالباسورد=الماك. | كارت جديد يُفعّل ويدخل؛ جهاز بماك مسجّل يدخل صامتاً. |
| **M3 — السرعة/الكوتا (Patch A)** | تفسير MikroTik VSA. | `tc/nft` يُظهر السرعة القادمة من بروفايل SAS؛ الكوتا تُحترم. |
| **M4 — المحاسبة + CoA** | interim + Stop + فصل الكوتا. | عدادات SAS تتحرك؛ انتهاء الجيجا يفصل الجهاز فوراً عبر Disconnect. |
| **M5 — قوالب MikroTik (Patch B/C)** | رندر `$()` + CHAP JS. | رفع `login.html` من مصمم MikroTik يعمل بلا تعديل. |
| **M6 — MAC bypass UI** | واجهة + سكربت + كومنت. | إضافة ماك بكومنت يفتح النت بدون RADIUS ويبقى بعد الريستارت. |
| **M7 — تصليب الحماية** | مراجعة nft + اختبار تخطي. | لا تسريب DNS/IPv6/QUIC قبل الدخول؛ لا كسر للأجهزة المصرّح لها. |

أوامر تحقق مرجعية: `ubus call uspot status`، `tc -s qdisc show dev br-<if>`، `radclient <ip>:3799 disconnect <secret>`، مراقبة `logread` أثناء الدخول.

---

## 11. مخاطر وقرارات مفتوحة

1. **إصدار uspot الدقيق في 24.10:** أسماء بعض الخيارات/الدوال قد تختلف؛ أول خطوة تنفيذية = تثبيت مصدر uspot المستخدم فعلياً في البناء ومطابقة نقاط الترقيع.
2. **Overlay مقابل Patch:** لو صيانة الـ diff صعبة عبر الإصدارات، نتبنّى استبدال ملفات `.uc` كاملة (أوضح وأثبت).
3. **حماية CoA:** سيرفر DAS في uspot بلا مصادقة قوية — حصر IP سيرفر SAS إلزامي.
4. **تعارض الكوتا:** الاعتماد على فصل SAS عبر CoA (المصدر الموثوق) بدل حساب كوتا محلي مزدوج، لتفادي اختلاف العدّ.
5. **CHAP لكل جلسة:** التأكد أن uspot يولّد challenge لكل جلسة (وليس ثابتاً) لمطابقة سلوك MikroTik.

---

## 12. مُلحق (v2): آليات مُتحقَّقة من مصدر uspot + تبسيط الخطة

بعد قراءة مصدر uspot الفعلي (`f00b4r0/uspot`, فرع `next`)، اتّضحت تفاصيل تُبسّط التنفيذ وتجعل **معظمه إضافة ملفات (overlay) بدون ترقيع نواة**:

### 12.1 حقائق مُتحقَّقة
- **وضع `auth_mode 'uam'` يجمع ثلاثتها في تدفق واحد:** MAC-auth أولاً → إعادة توجيه للبوابة → دخول CHAP. فهو الأساس الأمثل للمحاكاة.
- **UAM في uspot أسلوب CoovaChilli** (redirect لبوابة بمعامِل `&challenge=` ثم POST بـ `&response=`) — وليس أسلوب MikroTik. التحدّي: `challenge = MD5(config.challenge + MAC)` كـ hex (من `src/uam.c`).
- **CHAP ident = 0 ثابت** (في `src/radius-client.c: cb_chap_passwd`): `CHAP-Password = 0x00 + MD5(chr(0) + password + challenge_bin)`. لذلك صفحة MikroTik لازم تستخدم chap-id = 0.
- **سمات الرد تُقرأ بشكل عام من قاموس radcli** (`rc_avpair_tostr`) وتُعاد إلى ucode كـ `auth.reply[<name>]`. ⇒ **دعم MikroTik VSA = إضافة قاموس MikroTik إلى radcli + قراءة `Mikrotik-Rate-Limit`/`Mikrotik-Total-Limit` في `uspot.uc`** — **بدون تعديل كود C إطلاقاً**.
- **MAC auto-login جاهز:** `mac_auth '1'` وبترك `mac_passwd` فارغاً يصبح **الباسورد = الماك** = قاعدة SAS بالضبط. **صفر ترقيع.**
- **CoA/Disconnect جاهز:** تفعيل بوضع `das_secret` + `das_port` (init.d يطلق `uspot-das` لكل قسم). **صفر ترقيع.**
- **المحاسبة جاهزة:** `counters '1'` + `acct_*` + `acct_interval`. **صفر ترقيع.**

### 12.2 التصميم المُنقّح (overlay-first)
| البند | الطريقة النهائية | ترقيع نواة؟ |
| :-- | :-- | :-- |
| دخول مشترك/كارت | `auth_mode 'uam'` + بوابة محلية → `client_auth` (RADIUS) | ❌ لا |
| MAC auto-login | `mac_auth '1'` + `mac_passwd` فارغ | ❌ لا |
| محاسبة | `counters '1'` + `acct_*` | ❌ لا |
| فصل الكوتا (CoA) | `das_secret` + `das_port 3799` | ❌ لا |
| **صفحات MikroTik** | **معالِج overlay جديد `handler-mikrotik.uc`** يرندر متغيرات `$()` ويستقبل POST (يحوّل حقل `password` المُهشّر إلى CHAP response) ويستدعي `portal.uspot_auth` — يعيد استخدام `portal.uc`/`uam.c` كما هما + إضافة مسار uhttpd | ❌ لا (إضافة فقط) |
| **سرعة/كوتا MikroTik VSA** | **قاموس radcli لـ MikroTik** + تعديل صغير في `uspot.uc` حيث تُطبَّق حدود WISPr ليقرأ أيضاً `Mikrotik-Rate-Limit`/`Total-Limit` | ⚠️ تعديل ucode واحد صغير في `uspot.uc` |
| MAC bypass بواجهة | قسم `config whitelist` + سكربت `ubus client_enable` + LuCI | ❌ لا |

> النتيجة: **تعديل ucode واحد فقط داخل `uspot.uc`** (قراءة سمات MikroTik)، وكل الباقي إضافة ملفات overlay + كونفيج. أبسط وأثبت بكثير من الترقيع العميق. `hybrid_mikrotik.uc` القديم يُستبدَل بمنطق مُدمج في `uspot.uc` (مع إصلاح باج `match`).

### 12.3 حالة التنفيذ
- ✅ **M1 (أساس RADIUS):** أُعيدت كتابة `files_ap/etc/config/uspot` بالمخطط الحقيقي (uam + RADIUS auth/acct + DAS + mac_auth + counters + mac_format).
- ✅ **M5 جوهر (صفحات MikroTik):** بعد مراجعة صفحات المستخدم الحقيقية (مجموعة MikroTik قياسية: login/alogin/status/logout/error/redirect/rlogin/radvert + md5.js). تم:
  - نقل الصفحات إلى `files_ap/www/uspot/` (أصول البوابة).
  - `files_ap/usr/share/uspot/mikrotik.uc`: محرك قوالب MikroTik (`$(var)`, `$(if/elif/else/endif)`, `==`/`!=`, octal-escape للـ CHAP).
  - `files_ap/usr/share/uspot/handler-mikrotik.uc`: معالج `/login` (GET يرندر + MAC auto-login، POST يصادق CHAP)، `/status`، `/logout` — يعيد استخدام `portal.uc`/`uam.c` بلا تعديل.
  - **مؤكَّد من المصدر:** CHAP ident=0 (`radius-client.c`)، `md5.js` يقرأ octal escapes كـ bytes، backend يبني CHAP من (password+challenge) (`uspot.uc:902`)، MAC-auth بباسورد=الماك (`uspot.uc:899`).
  - `docs/Horus-Spot-Wiring.md`: أوامر ربط uhttpd/الجدار/شبكة الكابتف (تُطبَّق يدوياً — لتفادي تعارض بورت 80 مع LuCI).
- ⚠️ **لم يُختبر على جهاز بعد** — كود ucode جديد؛ التحقق الميداني عبر `logread -e uspot` بعد التفليش والربط.
- ✅ **M6 + واجهة LuCI كاملة:** قسم «Horus Spot» بـ 6 تبويبات، أُعيد بناؤها على الكونفيج الحقيقي:
  1. General (`settings.js`) — auth_mode/interface/mac_format/timeouts/counters/debug.
  2. SAS / RADIUS (`nas.js`) — auth/acct server+port+secret، nasid/nasmac، das_secret/das_port، mac_auth، uam_server، challenge.
  3. Portal Pages (`pages.js`) — رفع/إدارة الصفحات في `/www/uspot` (كان شغالاً).
  4. Connected Clients (`clients.js`) — جدول حي عبر `uspot clients`.
  5. **MAC Bypass (`bypass.js`) — جديد:** جدول ماك+كومنت+تفعيل؛ يفتح النت بدون RADIUS عبر `uspotfilter client_set` (سكربت `uspot-maclist.sh` + hotplug إعادة تطبيق).
  6. Advanced (`advanced.js`) — محرر الكونفيج الخام.
  + تحديث menu.d (تبويب bypass) وacl.d (صلاحيات uspotfilter + السكربتات).
- ✅ **M3 (السرعة والكوتا من SAS):**
  - `files_ap/etc/radcli/dictionary.mikrotik`: قاموس MikroTik (Vendor 14988) لـ radcli.
  - `98-horus-spot-setup`: يضيف `$INCLUDE` للقواميس (WISPr/chillispot/mikrotik) في `/etc/radcli/dictionary` (idempotent) ⇒ سمات MikroTik تُعاد بالاسم من radius-client.
  - **overlay** `files_ap/usr/share/uspot/uspot.uc` (نسخة كاملة من فرع next + تعديلين صغيرين معلَّمين Horus):
    - `client_ratelimit`: يفسّر `Mikrotik-Rate-Limit` ("rx/tx" وحدات k/M/G؛ rx=رفع، tx=تنزيل) بأولوية على WISPr/ChilliSpot.
    - `client_quotalimit`: يقرأ `Mikrotik-Total-Limit`(+Gigawords) وRecv/Xmit-Limit ⇒ كوتا. عند بلوغها uspot يفصل محلياً (`max total octets reached`) + SAS يفصل عبر CoA.
  - حُذف `hybrid_mikrotik.uc` القديم (استُبدل).
  - ⚠️ الـ overlay مبني على فرع `next`؛ لو نسخة uspot المبنية مختلفة يُعاد مزامنة الملف (التعديلات معلَّمة `Horus/MikroTik`).
- ⏭️ المتبقي: **M4** (تحقّق محاسبة+CoA ميدانياً) → **M7** (تصليب nft). وربط CPD ليحوّل غير المسجّل إلى `/login` (في دليل الربط عبر `error_page`).
- 🗑️ يُحذف لاحقاً: `hybrid_mikrotik.uc` (استُبدل)، وواجهات luci القديمة `uspot_custom` (مبنية على خيارات مخترعة).

---
*مسوّدة مواصفات v2 — مشروع Horus OpenWrt Final — 2026. المسار: overlay-first مع تعديل ucode واحد فقط في uspot.uc.*
