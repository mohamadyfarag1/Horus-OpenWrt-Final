include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-radius-sync
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

LUCI_TITLE:=LuCI Support for RADIUS Sync Dashboard
LUCI_DEPENDS:=+python3-light +python3-urllib +python3-logging +python3-json
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
