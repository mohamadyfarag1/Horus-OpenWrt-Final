#!/bin/bash
# =============================================
# Script 2: Add Horus 9200 device to OpenWrt
# =============================================
set -e

cd openwrt

{
  printf '\n'
  printf 'define Device/h1radio_ti04-708hp\n'
  printf '\t$(call Device/FitImage)\n'
  printf '\t$(call Device/UbiFit)\n'
  printf '\tDEVICE_DTS := qcom-ipq4019-h1radio-ti04-708hp\n'
  printf '\tBLOCKSIZE := 128k\n'
  printf '\tPAGESIZE := 2048\n'
  printf '\tDEVICE_TITLE := Horus 9200\n'
  printf '\tSUPPORTED_DEVICES := H1Radio,ti04-708hp h1radio,ti04-708hp qcom,ipq4019-h1radio-ti04-708hp\n'
  printf '\tDEVICE_PACKAGES := kmod-ath10k-ct-smallbuffers ath10k-firmware-qca4019-ct -kmod-ath10k -ath10k-firmware-qca4019 wpad-basic-mbedtls -wpad-openssl -wpad-basic-wolfssl kmod-usb-core kmod-usb2 kmod-usb3 kmod-usb-storage kmod-usb-storage-extras block-mount kmod-fs-ext4 kmod-fs-vfat e2fsprogs fdisk luci-app-commands relayd luci-proto-relay luci-app-nlbwmon -odhcp6c -odhcpd-ipv6only -luci-proto-ipv6 -luci-app-samba -luci-app-samba4 -samba36-server -samba4-server -luci-i18n-samba-en -luci-i18n-samba4-en\n'
  printf 'endef\n'
  printf 'TARGET_DEVICES += h1radio_ti04-708hp\n'
} >> target/linux/ipq40xx/image/generic.mk

echo "✅ Device definition added to generic.mk"
