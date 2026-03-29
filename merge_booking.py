#!/usr/bin/env python3
"""
Script to merge pre-booking form into compact confirm panel in SeatMappingPage.tsx
"""

FILE = '/home/runner/work/DaiichiTravel/DaiichiTravel/src/pages/SeatMappingPage.tsx'

with open(FILE, 'r', encoding='utf-8') as f:
    content = f.read()

original_len = len(content)

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 1: shouldShowMobileBackdrop – remove showPreBookingInfo ||
# ─────────────────────────────────────────────────────────────────────────────
old1 = (
    "  const shouldShowMobileBackdrop =\n"
    "    showPreBookingInfo ||\n"
    "    showBookingConfirmation ||"
)
new1 = (
    "  const shouldShowMobileBackdrop =\n"
    "    showBookingConfirmation ||"
)
assert old1 in content, "CHANGE 1 not found"
content = content.replace(old1, new1, 1)
print("CHANGE 1 done")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 2: Back button – remove the else if (showPreBookingInfo) branch
# ─────────────────────────────────────────────────────────────────────────────
old2 = (
    "              } else if (showBookingForm) {\n"
    "                // If booking form is open, close it (go back to seat selection)\n"
    "                setShowBookingForm(null);\n"
    "                setExtraSeatIds([]);\n"
    "                setAddonQuantities({});\n"
    "              } else if (showPreBookingInfo) {\n"
    "                // Pre-booking info form is shown after seat selection – go back to seat map\n"
    "                setShowPreBookingInfo(false);\n"
    "              } else {\n"
    "                // At seat map – go back to trip search\n"
    "                setActiveTab(previousTab);\n"
    "              }"
)
new2 = (
    "              } else if (showBookingForm) {\n"
    "                // If booking form is open, close it (go back to seat selection)\n"
    "                setShowBookingForm(null);\n"
    "                setExtraSeatIds([]);\n"
    "                setAddonQuantities({});\n"
    "              } else {\n"
    "                // At seat map – go back to trip search\n"
    "                setActiveTab(previousTab);\n"
    "              }"
)
assert old2 in content, "CHANGE 2 not found"
content = content.replace(old2, new2, 1)
print("CHANGE 2 done")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 3: Add validation variables after canConfirmBooking
# ─────────────────────────────────────────────────────────────────────────────
old3 = (
    "  const canConfirmBooking = isFreeSeatingTrip\n"
    "    ? !hasFareBlocker\n"
    "    : (extraSeatsNeeded === 0 || extraSeatIds.length >= extraSeatsNeeded) && !hasFareBlocker;"
)
new3 = (
    "  const canConfirmBooking = isFreeSeatingTrip\n"
    "    ? !hasFareBlocker\n"
    "    : (extraSeatsNeeded === 0 || extraSeatIds.length >= extraSeatsNeeded) && !hasFareBlocker;\n"
    "  const hasPickupOrDropoffOptions = (tripRoute?.routeStops?.length ?? 0) > 0 || pickupStops.length > 0 || dropoffStops.length > 0;\n"
    "  const hasPickupOrDropoffSelection = !!(pickupPoint || pickupAddress || dropoffPoint || dropoffAddress);\n"
    "  const pickupDropoffValid = !hasPickupOrDropoffOptions || hasPickupOrDropoffSelection;"
)
assert old3 in content, "CHANGE 3 not found"
content = content.replace(old3, new3, 1)
print("CHANGE 3 done")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 4a: Remove ternary opener + pre-booking form + compact summary bar
#   (from "{showPreBookingInfo ? (" up to just before the addons section)
# ─────────────────────────────────────────────────────────────────────────────
idx_ternary = content.find('      {showPreBookingInfo ? (\n')
assert idx_ternary >= 0, "ternary opener not found"
idx_addons = content.find('          {!showBookingForm && (selectedTrip.addons || []).length > 0 && (\n', idx_ternary)
assert idx_addons >= 0, "addons section not found after ternary"
removed = content[idx_ternary:idx_addons]
print(f"CHANGE 4a: removing {len(removed)} chars: {removed[:60]!r}...{removed[-60:]!r}")
content = content[:idx_ternary] + content[idx_addons:]
print("CHANGE 4a done")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 4b: Remove the closing </> and )} of the ternary/fragment
# ─────────────────────────────────────────────────────────────────────────────
old4b = (
    "        </>\n"
    "      )}\n"
    "    </div>"
)
new4b = "    </div>"
assert old4b in content, "CHANGE 4b closing not found"
content = content.replace(old4b, new4b, 1)
print("CHANGE 4b done")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 5: Update compact confirm panel title
# ─────────────────────────────────────────────────────────────────────────────
old5 = (
    "                  {isFreeSeatingTrip\n"
    "                    ? (language === 'vi' ? '\U0001FA91 Xác nhận đặt vé' : language === 'ja' ? '\U0001FA91 予約確認' : '\U0001FA91 Confirm Booking')\n"
    "                    : `${t.booking_title}: ${showBookingForm}`}"
)
new5 = (
    "                  {isFreeSeatingTrip\n"
    "                    ? (language === 'vi' ? '\U0001F4DD Nhập thông tin' : language === 'ja' ? '\U0001F4DD 情報入力' : '\U0001F4DD Enter Information')\n"
    "                    : (language === 'vi' ? `\U0001F4DD Nhập thông tin: ${showBookingForm}` : language === 'ja' ? `\U0001F4DD 情報入力: ${showBookingForm}` : `\U0001F4DD Enter Information: ${showBookingForm}`)}"
)
assert old5 in content, "CHANGE 5 not found"
content = content.replace(old5, new5, 1)
print("CHANGE 5 done")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 6: Replace simple pickup/dropoff selectors with full sections
# ─────────────────────────────────────────────────────────────────────────────
old6 = (
    "                {/* Pickup address (sub-stop selection) */}\n"
    "                {pickupStopNames.length > 0 && !pickupSectionDisabled && (\n"
    "                  <div>\n"
    "                    <label className=\"text-xs font-bold text-gray-500 uppercase\">{t.pickup_address || 'Điểm đón'}</label>\n"
    "                    <SearchableSelect\n"
    "                      options={pickupStopNames}\n"
    "                      optionDetails={pickupStopAddresses}\n"
    "                      value={pickupAddress}\n"
    "                      onChange={(val) => {\n"
    "                        setPickupAddress(val);\n"
    "                        const matchedStop = stops.find(s => s.name === val && pickupStopNames.includes(val));\n"
    "                        setPickupAddressSurcharge(matchedStop?.surcharge || 0);\n"
    "                        setPickupStopAddress(matchedStop?.address || '');\n"
    "                      }}\n"
    "                      placeholder={t.pickup_address_ph || 'Chọn hoặc nhập điểm đón...'}\n"
    "                      className=\"mt-1\"\n"
    "                      inputClassName=\"!px-3 !py-1.5 !text-xs !rounded-lg\"\n"
    "                    />\n"
    "                  </div>\n"
    "                )}\n"
    "                {/* Dropoff address (sub-stop selection) */}\n"
    "                {dropoffStopNames.length > 0 && !dropoffSectionDisabled && (\n"
    "                  <div>\n"
    "                    <label className=\"text-xs font-bold text-gray-500 uppercase\">{t.dropoff_address || 'Điểm trả'}</label>\n"
    "                    <SearchableSelect\n"
    "                      options={dropoffStopNames}\n"
    "                      optionDetails={dropoffStopAddresses}\n"
    "                      value={dropoffAddress}\n"
    "                      onChange={(val) => {\n"
    "                        setDropoffAddress(val);\n"
    "                        const matchedStop = stops.find(s => s.name === val && dropoffStopNames.includes(val));\n"
    "                        setDropoffAddressSurcharge(matchedStop?.surcharge || 0);\n"
    "                        setDropoffStopAddress(matchedStop?.address || '');\n"
    "                      }}\n"
    "                      placeholder={t.dropoff_address_ph || 'Chọn hoặc nhập điểm trả...'}\n"
    "                      className=\"mt-1\"\n"
    "                      inputClassName=\"!px-3 !py-1.5 !text-xs !rounded-lg\"\n"
    "                    />\n"
    "                  </div>\n"
    "                )}"
)

new6 = (
    "                {/* Departure Stop (Điểm xuất phát) + Pickup Address */}\n"
    "                {(() => {\n"
    "                  const hasRouteFares = (tripRoute?.routeStops?.length ?? 0) > 0;\n"
    "                  const pickupOptions = hasRouteFares && tripRoute?.routeStops\n"
    "                    ? [...tripRoute.routeStops].sort((a, b) => a.order - b.order).map(rs => rs.stopName)\n"
    "                    : stops.map(s => s.name);\n"
    "                  const defaultDeparture = tripRoute?.departurePoint || '';\n"
    "                  return (\n"
    "                    <>\n"
    "                      <div>\n"
    "                        <SearchableSelect\n"
    "                          options={pickupOptions}\n"
    "                          value={pickupPoint}\n"
    "                          inlineLabel={t.pickup_point}\n"
    "                          onChange={(val) => {\n"
    "                            setPickupPoint(val);\n"
    "                            setPickupAddress('');\n"
    "                            setPickupStopAddress('');\n"
    "                            setPickupAddressSurcharge(0);\n"
    "                            const routeStop = tripRoute?.routeStops?.find(rs => rs.stopName === val);\n"
    "                            const globalStop = stops.find(s => s.name === val);\n"
    "                            const newFromId = routeStop?.stopId || globalStop?.id || '';\n"
    "                            setPickupSurcharge(globalStop?.surcharge || 0);\n"
    "                            setFromStopId(newFromId);\n"
    "                            setFareAmount(null);\n"
    "                            setFareError('');\n"
    "                            if (newFromId && toStopId && hasRouteFares) {\n"
    "                              lookupFare(tripRoute, newFromId, toStopId);\n"
    "                            }\n"
    "                          }}\n"
    "                          placeholder={pickupPoint ? t.select_pickup : (defaultDeparture || t.select_pickup)}\n"
    "                        />\n"
    "                        {!pickupPoint && defaultDeparture && (\n"
    "                          <p className=\"mt-1 text-[10px] text-gray-400\">{language === 'vi' ? `Mặc định: ${defaultDeparture}` : `Default: ${defaultDeparture}`}</p>\n"
    "                        )}\n"
    "                      </div>\n"
    "                      <div className=\"pl-3 border-l-2 border-gray-200\">\n"
    "                        <label className=\"text-[10px] font-semibold text-gray-500 uppercase\">{t.pickup_address || 'Điểm đón'}</label>\n"
    "                        <SearchableSelect\n"
    "                          options={pickupStopNames}\n"
    "                          optionDetails={pickupStopAddresses}\n"
    "                          value={pickupAddress}\n"
    "                          onChange={(val) => {\n"
    "                            setPickupAddress(val);\n"
    "                            const matchedStop = stops.find(s => s.name === val && pickupStopNames.includes(val));\n"
    "                            setPickupAddressSurcharge(matchedStop?.surcharge || 0);\n"
    "                            setPickupStopAddress(matchedStop?.address || '');\n"
    "                          }}\n"
    "                          placeholder={t.pickup_address_ph || 'Chọn hoặc nhập điểm đón...'}\n"
    "                          className=\"mt-0.5\"\n"
    "                          inputClassName=\"!px-3 !py-1.5 !text-xs !rounded-lg\"\n"
    "                          disabled={pickupSectionDisabled}\n"
    "                        />\n"
    "                        <input\n"
    "                          type=\"text\"\n"
    "                          value={pickupAddressDetail}\n"
    "                          onChange={e => setPickupAddressDetail(e.target.value)}\n"
    "                          placeholder={language === 'vi' ? 'Chi tiết (số nhà, tầng...)' : language === 'ja' ? '詳細（番地など）' : 'Detail (house no., floor...)'}\n"
    "                          className=\"mt-1 w-full px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-daiichi-red/10\"\n"
    "                          disabled={pickupSectionDisabled}\n"
    "                        />\n"
    "                        {pickupSectionDisabled && (\n"
    "                          <p className=\"mt-1 text-[10px] text-orange-500\">{language === 'vi' ? 'Điểm đón đã bị vô hiệu hóa cho tuyến này' : 'Pickup address input is disabled for this route'}</p>\n"
    "                        )}\n"
    "                      </div>\n"
    "                    </>\n"
    "                  );\n"
    "                })()}\n"
    "\n"
    "                {/* Destination Stop (Điểm đến) + Dropoff Address */}\n"
    "                {(() => {\n"
    "                  const hasRouteFares = (tripRoute?.routeStops?.length ?? 0) > 0;\n"
    "                  const dropoffOptions = hasRouteFares && tripRoute?.routeStops\n"
    "                    ? [...tripRoute.routeStops].sort((a, b) => a.order - b.order).map(rs => rs.stopName)\n"
    "                    : stops.map(s => s.name);\n"
    "                  const defaultArrival = tripRoute?.arrivalPoint || '';\n"
    "                  return (\n"
    "                    <>\n"
    "                      <div>\n"
    "                        <SearchableSelect\n"
    "                          options={dropoffOptions}\n"
    "                          value={dropoffPoint}\n"
    "                          inlineLabel={t.dropoff_point}\n"
    "                          onChange={(val) => {\n"
    "                            setDropoffPoint(val);\n"
    "                            setDropoffAddress('');\n"
    "                            setDropoffStopAddress('');\n"
    "                            setDropoffAddressSurcharge(0);\n"
    "                            const routeStop = tripRoute?.routeStops?.find(rs => rs.stopName === val);\n"
    "                            const globalStop = stops.find(s => s.name === val);\n"
    "                            const newToId = routeStop?.stopId || globalStop?.id || '';\n"
    "                            setDropoffSurcharge(globalStop?.surcharge || 0);\n"
    "                            setToStopId(newToId);\n"
    "                            setFareAmount(null);\n"
    "                            setFareError('');\n"
    "                            if (fromStopId && newToId && hasRouteFares) {\n"
    "                              lookupFare(tripRoute, fromStopId, newToId);\n"
    "                            }\n"
    "                          }}\n"
    "                          placeholder={dropoffPoint ? t.select_dropoff : (defaultArrival || t.select_dropoff)}\n"
    "                        />\n"
    "                        {!dropoffPoint && defaultArrival && (\n"
    "                          <p className=\"mt-1 text-[10px] text-gray-400\">{language === 'vi' ? `Mặc định: ${defaultArrival}` : `Default: ${defaultArrival}`}</p>\n"
    "                        )}\n"
    "                      </div>\n"
    "                      <div className=\"pl-3 border-l-2 border-gray-200\">\n"
    "                        <label className=\"text-[10px] font-semibold text-gray-500 uppercase\">{t.dropoff_address || 'Điểm trả'}</label>\n"
    "                        <SearchableSelect\n"
    "                          options={dropoffStopNames}\n"
    "                          optionDetails={dropoffStopAddresses}\n"
    "                          value={dropoffAddress}\n"
    "                          onChange={(val) => {\n"
    "                            setDropoffAddress(val);\n"
    "                            const matchedStop = stops.find(s => s.name === val && dropoffStopNames.includes(val));\n"
    "                            setDropoffAddressSurcharge(matchedStop?.surcharge || 0);\n"
    "                            setDropoffStopAddress(matchedStop?.address || '');\n"
    "                          }}\n"
    "                          placeholder={t.dropoff_address_ph || 'Chọn hoặc nhập điểm trả...'}\n"
    "                          className=\"mt-0.5\"\n"
    "                          inputClassName=\"!px-3 !py-1.5 !text-xs !rounded-lg\"\n"
    "                          disabled={dropoffSectionDisabled}\n"
    "                        />\n"
    "                        <input\n"
    "                          type=\"text\"\n"
    "                          value={dropoffAddressDetail}\n"
    "                          onChange={e => setDropoffAddressDetail(e.target.value)}\n"
    "                          placeholder={language === 'vi' ? 'Chi tiết (số nhà, tầng...)' : language === 'ja' ? '詳細（番地など）' : 'Detail (house no., floor...)'}\n"
    "                          className=\"mt-1 w-full px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-daiichi-red/10\"\n"
    "                          disabled={dropoffSectionDisabled}\n"
    "                        />\n"
    "                        {dropoffSectionDisabled && (\n"
    "                          <p className=\"mt-1 text-[10px] text-orange-500\">{language === 'vi' ? 'Điểm trả đã bị vô hiệu hóa cho tuyến này' : 'Dropoff address input is disabled for this route'}</p>\n"
    "                        )}\n"
    "                      </div>\n"
    "                    </>\n"
    "                  );\n"
    "                })()}"
)

assert old6 in content, "CHANGE 6 not found"
content = content.replace(old6, new6, 1)
print("CHANGE 6 done")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 7: Add fare info + Xem chi tiết giá button before Price Summary
# ─────────────────────────────────────────────────────────────────────────────
old7 = (
    "                {/* Price Summary */}\n"
    "                <div className=\"p-4 bg-daiichi-accent/20 rounded-xl border border-daiichi-accent/30 space-y-2\">"
)
new7 = (
    "                {/* Fare info + Xem chi tiết giá */}\n"
    "                {fareLoading && (\n"
    "                  <p className=\"text-xs text-blue-500 animate-pulse\">{t.fare_loading || 'Looking up fare...'}</p>\n"
    "                )}\n"
    "                {!fareLoading && fareAmount !== null && (\n"
    "                  <div className=\"flex items-center gap-2 flex-wrap\">\n"
    "                    <p className=\"text-xs text-emerald-600 font-bold\">\n"
    "                      {t.fare_based_price || 'Fare table price'}: {fareAmount.toLocaleString()}đ/{t.per_person || 'người'}\n"
    "                    </p>\n"
    "                    <button\n"
    "                      type=\"button\"\n"
    "                      onClick={() => setShowPriceDetail(true)}\n"
    "                      className=\"text-[10px] text-blue-600 font-bold px-2 py-0.5 rounded-full bg-blue-50 hover:bg-blue-100 transition-colors flex items-center gap-1\"\n"
    "                    >\n"
    "                      <Info size={10} />\n"
    "                      {language === 'vi' ? 'Xem chi tiết giá' : language === 'ja' ? '料金詳細を見る' : 'View price details'}\n"
    "                    </button>\n"
    "                  </div>\n"
    "                )}\n"
    "                {/* Price Summary */}\n"
    "                <div className=\"p-4 bg-daiichi-accent/20 rounded-xl border border-daiichi-accent/30 space-y-2\">"
)
assert old7 in content, "CHANGE 7 not found"
content = content.replace(old7, new7, 1)
print("CHANGE 7 done")

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE 8: Update "Tiếp theo" button + add validation message
# ─────────────────────────────────────────────────────────────────────────────
old8 = (
    "                <button type=\"button\" onClick={() => setShowBookingConfirmation(true)} disabled={!canConfirmBooking} className={cn(\"w-full py-4 text-white rounded-xl font-bold shadow-lg\", canConfirmBooking ? \"bg-daiichi-red shadow-daiichi-red/20\" : \"bg-gray-300 shadow-gray-200 cursor-not-allowed\")}>\n"
    "                  {language === 'vi' ? '✅ Tiếp theo: Xác nhận →' : language === 'ja' ? '✅ 次へ：確認する →' : '✅ Next: Confirm →'}\n"
    "                </button>"
)
new8 = (
    "                {!pickupDropoffValid && (\n"
    "                  <p className=\"text-xs text-red-500 font-medium\">\n"
    "                    {language === 'vi' ? 'Vui lòng chọn ít nhất một điểm đón hoặc điểm trả.' : language === 'ja' ? '乗車地または降車地を少なくとも1つ選択してください。' : 'Please select at least one pickup or dropoff point.'}\n"
    "                  </p>\n"
    "                )}\n"
    "                <button type=\"button\" onClick={() => setShowBookingConfirmation(true)} disabled={!canConfirmBooking || !pickupDropoffValid} className={cn(\"w-full py-4 text-white rounded-xl font-bold shadow-lg\", (canConfirmBooking && pickupDropoffValid) ? \"bg-daiichi-red shadow-daiichi-red/20\" : \"bg-gray-300 shadow-gray-200 cursor-not-allowed\")}>\n"
    "                  {language === 'vi' ? '✅ Tiếp theo: Xác nhận →' : language === 'ja' ? '✅ 次へ：確認する →' : '✅ Next: Confirm →'}\n"
    "                </button>"
)
assert old8 in content, "CHANGE 8 not found"
content = content.replace(old8, new8, 1)
print("CHANGE 8 done")

# ─────────────────────────────────────────────────────────────────────────────
# Write result
# ─────────────────────────────────────────────────────────────────────────────
with open(FILE, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nDone! Original size: {original_len}, new size: {len(content)}, delta: {len(content)-original_len}")
