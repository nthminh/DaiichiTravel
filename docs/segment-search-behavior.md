# Hành vi Tìm kiếm Theo Chặng (Partial-Segment Search)

> Tài liệu giải thích tại sao kết quả tìm kiếm chuyến xe có thể hiển thị các tuyến không được đặt tên trực tiếp theo hành trình bạn nhập.

---

## 🔍 Tình huống minh hoạ

Người dùng tìm kiếm: **Hà Nội → Ninh Bình**

Kết quả hiển thị: **HÀ NỘI - CÁT BÀ BUS (TÀU CAO TỐC) (XE 45 CHỖ)**

→ Điểm hiển thị trên thẻ kết quả:
- 🔴 Hà Nội (đón trả Phố Cổ Hà Nội miễn phí)
- 🔵 Ninh Bình

Người dùng chưa tạo tuyến riêng **"Hà Nội - Ninh Bình"**, nhưng kết quả vẫn xuất hiện. **Đây là hành vi có chủ ý (by design)** của hệ thống, không phải lỗi.

---

## 🧠 Nguyên nhân: Cơ chế khớp chặng con (Partial-Segment Matching)

### 1. Cách hệ thống lọc chuyến

Hàm `filterTrip` trong `src/pages/BookTicketPage.tsx` thực hiện lọc chuyến theo các bước:

```
Bước 1 – Xây dựng danh sách điểm dừng theo thứ tự:
  orderedStops = [
    route.departurePoint,            // Hà Nội
    ...route.routeStops (sort by order), // Ninh Bình (order=1), Hải Phòng (order=2), ...
    route.arrivalPoint               // Cát Bà
  ]

Bước 2 – Tìm vị trí điểm ĐI trong danh sách:
  fromIdx = index của "Hà Nội" → 0

Bước 3 – Tìm vị trí điểm ĐẾN trong danh sách:
  toIdx = index của "Ninh Bình" → 1

Bước 4 – Kiểm tra tính hợp lệ của chặng:
  Điều kiện: fromIdx < toIdx  →  0 < 1  →  ✅ Hợp lệ
  → Chuyến này ĐƯỢC hiển thị
```

### 2. Lý do thiết kế như vậy

Hệ thống hỗ trợ **tuyến xe đa điểm dừng** (`routeStops`). Một chuyến xe từ Hà Nội → Cát Bà có thể dừng đón/trả khách tại Ninh Bình, Hải Phòng, v.v. Khi khách tìm "Hà Nội → Ninh Bình", họ có thể:

- Mua vé **lên ở Hà Nội** và **xuống ở Ninh Bình** ngay trên chiếc xe đang chạy đến Cát Bà
- Đây là mô hình **đặt vé theo chặng con** (sub-segment booking) — tương tự như tàu liên tỉnh

### 3. Thư viện đối sánh tên (`searchUtils.ts`)

Bước đối sánh tên điểm dừng sử dụng `matchesSearch()` với các tính năng:

| Tính năng | Ví dụ |
|-----------|-------|
| Bỏ dấu tiếng Việt | `"Ha Noi"` khớp `"Hà Nội"` |
| Bỏ khoảng trắng | `"ninhbinh"` khớp `"Ninh Bình"` |
| Fuzzy (Levenshtein) | `"Nin Bih"` vẫn có thể khớp `"Ninh Bình"` |
| Token-level matching | `"Ninh"` khớp với bất kỳ tên nào chứa token "Ninh" |

---

## 🗺️ Sơ đồ nguyên nhân

```
Cấu hình tuyến "Hà Nội - Cát Bà Bus":
  ┌───────────┐   routeStops   ┌────────────┐   routeStops   ┌───────────┐
  │  Hà Nội   │ ─────────────▶ │  Ninh Bình │ ─────────────▶ │   Cát Bà  │
  │ (depart.) │   (order=1)    │ (intermed.)│   (order=2)    │ (arrival) │
  └───────────┘                └────────────┘                └───────────┘

Người dùng tìm: "Hà Nội" → "Ninh Bình"
  fromIdx = 0  (Hà Nội ở vị trí 0)
  toIdx   = 1  (Ninh Bình ở vị trí 1)
  0 < 1 → ✅ HIỂN THỊ chuyến này
```

---

## ⚙️ Các trường hợp có thể xảy ra

| Tình huống | Kết quả |
|------------|---------|
| Tuyến "Hà Nội - Cát Bà" có `routeStop` Ninh Bình (order=1) | ✅ Xuất hiện khi tìm "Hà Nội → Ninh Bình" |
| Tuyến "Hà Nội - Cát Bà" **không có** `routeStop` Ninh Bình | ❌ Không xuất hiện |
| Tìm ngược "Ninh Bình → Hà Nội" trên tuyến cùng chiều | ❌ Không xuất hiện (toIdx ≥ fromIdx) |
| Tuyến không tìm thấy trong `routeByName` (lỗi dữ liệu) | Fallback: khớp theo **tên tuyến** dạng chuỗi |

---

## 📋 Hướng xử lý theo từng mục tiêu

### ✅ Trường hợp 1: Đây là hành vi mong muốn

Nếu bạn **muốn** khách hàng có thể đặt vé Hà Nội → Ninh Bình trên xe Cát Bà:

→ **Không cần làm gì.** Hệ thống đang hoạt động đúng. Đảm bảo "Ninh Bình" được cấu hình đúng trong `routeStops` của tuyến với `order` phù hợp.

---

### ⚠️ Trường hợp 2: Không muốn Ninh Bình là điểm trả khách

Nếu xe không thực sự dừng ở Ninh Bình để trả khách nhưng "Ninh Bình" đang xuất hiện là một `routeStop`:

**Nguyên nhân cụ thể:** `routeStops` của tuyến "Hà Nội - Cát Bà Bus" có một entry với `stopName: "Ninh Bình"`.

**Hướng khắc phục:**
1. Vào trang **Quản lý tuyến đường** (Route Management)
2. Chọn tuyến "Hà Nội - Cát Bà Bus"
3. Kiểm tra mục **Điểm dừng trung gian (routeStops)**
4. Xóa hoặc đổi tên điểm dừng "Ninh Bình" nếu xe không dừng ở đó

---

### ✅ Trường hợp 3: Kết quả xuất hiện dù không có routeStop "Ninh Bình" — ĐÃ XỬ LÝ

Nếu kiểm tra tuyến và **không thấy Ninh Bình trong routeStops** nhưng kết quả vẫn hiện:

**Nguyên nhân đã xác định và khắc phục:**

> **Lỗi fuzzy matching token trùng lặp** *(đã fix trong `src/lib/searchUtils.ts`)*
>
> Tên điểm dừng "Hải Phòng ( đón trả miễn phí **bán kính** 15 km)" chứa từ "**kính**". Hai token tìm kiếm "**ninh**" và "**binh**" (từ "Ninh Bình") đều có khoảng cách Levenshtein = 1 so với "**kinh**" (dạng bỏ dấu của "kính"). Trước khi sửa, cả hai token cùng khớp một token văn bản, khiến `matchesSearch()` trả về `true` — nghĩa là tuyến Hà Nội – Cát Bà xuất hiện trong kết quả tìm "Hà Nội → Ninh Bình" dù không có điểm dừng Ninh Bình.
>
> **Giải pháp:** Áp dụng *deduplication* theo chỉ số — mỗi token văn bản chỉ được đối sánh với một token tìm kiếm. Khi "ninh" đã dùng "kinh", "binh" không còn token nào để khớp → hàm trả về `false` đúng.

**Các nguyên nhân khác có thể xảy ra (nếu vẫn còn):**

1. **Fallback text matching:** Tên tuyến (`trip.route`) có thể chứa chuỗi gần giống "Ninh Bình". Hàm `matchesSearch()` sử dụng fuzzy matching nên "Ninh" có thể khớp với token trong tên tuyến.
   - Kiểm tra: Tên tuyến có chứa "Ninh" không? (ví dụ "Hà Nội - Quảng **Ninh**")

2. **routeByName lookup thất bại:** Nếu `trip.route` (tên chuyến) không khớp chính xác với `route.name` trong Firestore (do đổi tên tuyến sau khi tạo chuyến), hệ thống sẽ dùng fallback matching theo tên tuyến dạng chuỗi.
   - Kiểm tra: So sánh `trip.route` với `route.name` trong Firestore

---

### 🔧 Trường hợp 4: Muốn chỉ hiện tuyến có đích đến chính xác

Đây là **thay đổi logic nghiệp vụ** quan trọng. Hiện tại hệ thống được thiết kế cho đặt vé theo chặng con. Nếu muốn chỉ hiện tuyến có `arrivalPoint` đúng với điểm đến tìm kiếm:

→ Đây là yêu cầu thay đổi code, cần thảo luận riêng về impact với các đại lý và khách hàng hiện tại đang đặt vé chặng con.

---

## 🔍 Hướng dẫn debug nhanh

Để xác định chính xác tại sao một tuyến xuất hiện trong kết quả tìm kiếm:

1. **Kiểm tra routeStops của tuyến:**
   - Firestore Console → Collection `routes` → Document tuyến cần xem
   - Xem mảng `routeStops`: có `stopName: "Ninh Bình"` không?

2. **Kiểm tra tên khớp:**
   - `route.departurePoint` có khớp "Hà Nội" không? (dùng bỏ dấu để so sánh)
   - `route.routeStops[*].stopName` có entry nào khớp "Ninh Bình" không?

3. **Kiểm tra thứ tự:**
   - `order` của "Ninh Bình" phải lớn hơn "Hà Nội" (Hà Nội = 0 trong `orderedStops`)

---

## 📚 File liên quan

| File | Vai trò |
|------|---------|
| `src/pages/BookTicketPage.tsx` | Hàm `filterTrip()` – logic lọc chuyến theo chặng |
| `src/lib/searchUtils.ts` | `matchesSearch()` – đối sánh tên điểm dừng (fuzzy, accent-free) |
| `src/lib/segmentUtils.ts` | `getSegmentInfo()` – nhãn hiển thị loại chặng (full/partial/multi) |
| `src/types.ts` | Interface `Route`, `RouteStop`, `Trip`, `Seat` |

---

## 📝 Tóm tắt

| Câu hỏi | Trả lời |
|---------|---------|
| Tại sao "Hà Nội - Cát Bà Bus" xuất hiện khi tìm "Hà Nội → Ninh Bình"? | Tuyến này có "Ninh Bình" là điểm dừng trung gian (`routeStop`). Hệ thống hiểu khách có thể xuống tại Ninh Bình. |
| Đây có phải lỗi không? | Không. Đây là tính năng đặt vé theo chặng con (sub-segment booking). |
| Không muốn kết quả này? | Xóa "Ninh Bình" khỏi `routeStops` của tuyến Cát Bà nếu xe không dừng đó. |
| Logic nằm ở đâu? | `filterTrip()` trong `BookTicketPage.tsx`, dòng 951–1002. |
