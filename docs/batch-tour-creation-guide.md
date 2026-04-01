# Hướng dẫn: Tạo nhiều tour cùng lúc (Batch Create Tours)

## Tổng quan

Tính năng **Tạo nhiều tour** cho phép quản trị viên tạo nhiều lịch tour du lịch chỉ trong một thao tác duy nhất. Đây là phiên bản tương đương với nút **"Tạo nhiều chuyến"** ở trang Điều hành Bus, nhưng được thiết kế dành riêng cho tour du lịch và tích hợp với **Quản lý tài sản**.

---

## Vị trí tính năng

Đường dẫn: **Điều hành Tour → Quản lý Tour**

Nút **⚡ Tạo nhiều tour** (màu xanh dương) nằm ở góc trên bên phải trang, bên cạnh nút "Thêm Tour mới".

---

## Hướng dẫn từng bước

### Bước 1 – Mở modal tạo nhiều tour

Nhấn nút **⚡ Tạo nhiều tour** ở góc trên bên phải trang **Quản lý Tour**.

Modal sẽ hiện ra với các trường cần điền.

---

### Bước 2 – Chọn tour mẫu (tuỳ chọn)

Trong dropdown **"Tour mẫu"**, bạn có thể:

- **Chọn một tour đã có** → Hệ thống sẽ tự điền tên, thời lượng, số đêm, giờ đi, điểm đi, giá vé, hành trình, phòng nghỉ từ tour đó.
- **Để trống** → Bạn điền thủ công tất cả các trường bên dưới.

> **Lưu ý:** Khi dùng tour mẫu, bạn vẫn có thể chỉnh sửa bất kỳ trường nào trước khi tạo.

---

### Bước 3 – Điền thông tin tour

| Trường | Bắt buộc | Mô tả |
|--------|----------|-------|
| **Tên tour** | ✅ | Tên hiển thị cho khách hàng |
| **Thời lượng** | ❌ | VD: "3 ngày 2 đêm" |
| **Số đêm** | ❌ | Dùng để tính `endDate` = `startDate + số_đêm` |
| **Giờ khởi hành** | ❌ | Giờ xe/tàu xuất phát |
| **Giờ trở về** | ❌ | Giờ dự kiến trả khách |
| **Điểm xuất phát** | ❌ | Địa điểm tập hợp khởi hành |
| **Điểm trả khách** | ❌ | Địa điểm kết thúc tour |
| **Giá người lớn (đ)** | ❌ | Giá vé người lớn |
| **Giá trẻ em (đ)** | ❌ | Giá vé trẻ em |

---

### Bước 4 – Liên kết tài sản (Quản lý tài sản)

Dropdown **"Liên kết tài sản (cơ sở lưu trú)"** hiển thị danh sách tất cả tài sản đã được tạo trong module **Quản lý tài sản** (du thuyền, homestay, resort).

- **Chọn một tài sản** → Mỗi tour được tạo sẽ lưu trường `linkedPropertyId` tương ứng, giúp hệ thống biết tour này dùng cơ sở lưu trú nào để quản lý phòng.
- **Để trống** → Tour không liên kết tài sản (phù hợp tour ngày không nghỉ đêm).

> **Cách thêm tài sản:** Vào menu **Quản lý tài sản** → Nhấn **"+ Thêm tài sản"** → Nhập thông tin du thuyền/homestay/resort và các loại phòng.

---

### Bước 5 – Chọn ngày khởi hành

Có **2 cách** để thêm ngày:

#### Cách 1: Thêm từng ngày thủ công

- Nhấn input ngày và chọn từng ngày khởi hành.
- Nhấn **"+ Thêm ngày"** để thêm nhiều ngày riêng lẻ.
- Nhấn biểu tượng 🗑️ để xóa một ngày.

#### Cách 2: Thêm theo khoảng ngày (nhanh hơn)

Trong ô **"Hoặc thêm nhiều ngày theo khoảng"**:

1. Chọn **Từ ngày** (ngày bắt đầu khoảng).
2. Chọn **Đến ngày** (ngày kết thúc khoảng).
3. Nhấn **"Thêm khoảng"** → Hệ thống tự động thêm tất cả các ngày trong khoảng đó (bỏ qua ngày trùng lặp).

**Ví dụ:** Từ 01/06/2025 đến 05/06/2025 → Tạo 5 tour: 01/06, 02/06, 03/06, 04/06, 05/06.

---

### Bước 6 – Xem tóm tắt và xác nhận

Sau khi điền đủ tên tour và ít nhất 1 ngày khởi hành, ô **tóm tắt màu xanh lá** sẽ hiện:

```
✓ Sẽ tạo 5 tour "Tour Hà Nội - Hạ Long 3N2Đ"
Các ngày: 2025-06-01, 2025-06-02, 2025-06-03, 2025-06-04, 2025-06-05
```

---

### Bước 7 – Nhấn "Tạo X tour"

- Nút **"Tạo X tour"** (X = số ngày đã chọn) ở góc dưới bên phải.
- Nút sẽ **bị vô hiệu hóa** nếu chưa điền tên tour hoặc chưa có ngày khởi hành hợp lệ.
- Trong quá trình tạo, nút hiển thị biểu tượng loading.
- Sau khi thành công, modal tự đóng và danh sách tour cập nhật ngay lập tức.

---

## Kết quả

Mỗi tour được tạo sẽ có:

| Trường | Giá trị |
|--------|---------|
| `title` | Tên tour đã nhập |
| `startDate` | Ngày khởi hành (YYYY-MM-DD) |
| `endDate` | `startDate + số_đêm` |
| `departureTime` | Giờ khởi hành |
| `departureLocation` | Điểm xuất phát |
| `returnTime` | Giờ trở về |
| `returnLocation` | Điểm trả khách |
| `priceAdult` | Giá người lớn |
| `priceChild` | Giá trẻ em |
| `linkedPropertyId` | ID tài sản liên kết (nếu có) |
| `description` | Lấy từ tour mẫu (nếu có) |
| `itinerary` | Lịch trình từ tour mẫu (nếu có) |
| `addons` | Dịch vụ đi kèm từ tour mẫu (nếu có) |
| `roomTypes` | Loại phòng từ tour mẫu (nếu có) |
| `images` | Ảnh từ tour mẫu (nếu có) |

---

## Tích hợp Quản lý tài sản

Khi chọn **cơ sở lưu trú** trong bước 4:

- Trường `linkedPropertyId` được lưu vào mỗi tour.
- Hệ thống biết tour này sử dụng tài sản nào.
- Thông tin phòng nghỉ (loại phòng, số lượng, giá) được quản lý tập trung trong **Quản lý tài sản** thay vì nhân đôi dữ liệu.
- Khi khách đặt tour, admin có thể tra cứu tài sản liên kết để kiểm tra tình trạng phòng.

### Ví dụ thực tế

> **Du thuyền Daiichi 01** có 10 cabin (3 loại: Standard, Deluxe, VIP).  
> Admin tạo 4 tour Vịnh Hạ Long cho các thứ Sáu trong tháng 6.  
> Tất cả 4 tour đều liên kết với `linkedPropertyId = "daiichi-01"`.  
> Khi khách đặt, admin vào **Quản lý tài sản → Du thuyền Daiichi 01** để xem và phân công cabin.

---

## So sánh với Tạo nhiều chuyến (Bus)

| Tính năng | Bus (Điều hành) | Tour (Quản lý Tour) |
|-----------|-----------------|---------------------|
| Tạo theo | Khoảng ngày × khung giờ | Danh sách ngày khởi hành |
| Dùng mẫu | Chọn tuyến đường | Chọn tour có sẵn |
| Phương tiện | Xe (biển số) | Cơ sở lưu trú (tài sản) |
| Tài xế | Có | Không áp dụng |
| Giá | Giá vé / Giá đại lý | Giá người lớn / Giá trẻ em |
| Dịch vụ thêm | Batch addons | Lấy từ tour mẫu |

---

## Lưu ý và mẹo

1. **Tránh trùng lặp ngày:** Khi dùng "thêm khoảng", hệ thống tự bỏ qua ngày đã có trong danh sách.
2. **Chỉnh sửa sau khi tạo:** Mỗi tour tạo ra là độc lập → có thể chỉnh sửa riêng lẻ qua nút ✏️.
3. **Hiệu suất:** Tất cả tour được ghi vào Firestore trong một lần `batch write` → nhanh và an toàn.
4. **Phân quyền:** Chỉ tài khoản có vai trò **MANAGER** mới thấy và dùng được tính năng này.

---

*Tài liệu cập nhật: 2025 – DaiichiTravel Admin System*
