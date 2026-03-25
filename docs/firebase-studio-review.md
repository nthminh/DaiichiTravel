# Hướng dẫn Review trên Firebase Studio trước khi Merge vào nhánh chính

## Firebase Studio là gì?

**Firebase Studio** (trước đây là Project IDX) là môi trường phát triển trực tuyến (cloud IDE) do Google cung cấp, tích hợp sẵn với các dịch vụ Firebase. Bạn có thể mở project, chạy ứng dụng ngay trên trình duyệt và review code thay đổi mà không cần cài đặt gì trên máy tính.

---

## 1. Cách mở project trên Firebase Studio

1. Truy cập [https://studio.firebase.google.com](https://studio.firebase.google.com)
2. Đăng nhập bằng tài khoản Google (cần có quyền truy cập vào repo GitHub của project).
3. Nhấn **"Import"** hoặc **"Open from GitHub"** → chọn repo `nthminh/DaiichiTravel`.
4. Firebase Studio sẽ tự động clone repo và cài đặt dependencies.

---

## 2. Review nhánh Pull Request trước khi merge

### Bước 1 – Checkout nhánh cần review

Trong terminal của Firebase Studio (hoặc giao diện Source Control):

```bash
# Lấy danh sách các nhánh từ remote
git fetch origin

# Chuyển sang nhánh của Pull Request cần review
git checkout <tên-nhánh>
# Ví dụ:
git checkout copilot/redesign-home-page
```

### Bước 2 – Cài đặt dependencies và chạy ứng dụng

```bash
# Cài đặt packages
npm install

# Chạy server phát triển
npm run dev
```

Firebase Studio sẽ tự động mở **Preview Window** (cửa sổ xem trước) cho phép bạn dùng thử ứng dụng ngay trên trình duyệt.

### Bước 3 – Kiểm tra các thay đổi

Trong tab **Source Control** (biểu tượng nhánh cây ở thanh sidebar trái):

- Xem **diff** từng file đã thay đổi so với nhánh `main`.
- Nhấn vào từng file để xem chi tiết phần code đã thêm (màu xanh) và xoá (màu đỏ).
- Kiểm tra UI trực tiếp ở Preview Window bên phải.

### Bước 4 – So sánh với nhánh main

```bash
# Xem danh sách commit khác biệt so với main
git log origin/main..HEAD --oneline

# Xem tổng hợp các file thay đổi
git diff origin/main --name-only

# Xem chi tiết diff so với main
git diff origin/main
```

---

## 3. Chạy kiểm tra chất lượng code (Build & Type Check)

Trước khi quyết định merge, hãy chạy các lệnh sau để đảm bảo không có lỗi:

```bash
# Kiểm tra TypeScript (type errors)
npx tsc --noEmit

# Build production để kiểm tra bundle
npm run build
```

Nếu cả hai lệnh trên **không báo lỗi**, code an toàn để merge.

---

## 4. Quy trình Review hoàn chỉnh (Checklist)

Trước khi nhấn **Merge** trên GitHub, hãy đảm bảo:

- [ ] Checkout nhánh PR và chạy `npm install` thành công
- [ ] `npm run dev` chạy được, không có lỗi đỏ trong console
- [ ] Giao diện hiển thị đúng trên **Preview Window** (mobile & desktop)
- [ ] `npx tsc --noEmit` không có lỗi TypeScript
- [ ] `npm run build` thành công
- [ ] Kiểm tra diff trên GitHub (tab **Files changed** trong Pull Request)
- [ ] Test các tính năng liên quan: tìm kiếm, đặt vé, điều hướng tab
- [ ] Đảm bảo không có secret / API key nào bị commit vào code

---

## 5. Merge vào nhánh chính

Sau khi review xong và tất cả checklist đã ✅:

1. Truy cập Pull Request trên GitHub: `https://github.com/nthminh/DaiichiTravel/pulls`
2. Chọn PR cần merge → nhấn **"Approve"** nếu bạn là reviewer.
3. Nhấn **"Merge pull request"** → chọn kiểu merge:
   - **Squash and merge** *(khuyến nghị)*: gộp tất cả commit thành 1 commit sạch vào `main`.
   - **Rebase and merge**: giữ nguyên từng commit.
   - **Create a merge commit**: tạo merge commit (giữ lịch sử đầy đủ).
4. Nhấn **"Confirm merge"** → nhánh PR sẽ được merge vào `main`.
5. Sau khi merge, Firebase Hosting sẽ tự động deploy (nếu CI/CD đã cấu hình).

---

## 6. Xem kết quả deploy trên Firebase Hosting

```bash
# Kiểm tra trạng thái deploy (trong Firebase Studio terminal)
firebase hosting:channel:list

# Hoặc truy cập trực tiếp URL production
# https://daiichitravel-f49fd.web.app/
```

---

## 7. Xử lý xung đột (Conflicts)

Nếu PR có conflict với `main`:

```bash
# Cập nhật nhánh main local
git fetch origin main

# Merge main vào nhánh hiện tại để giải quyết conflict
git merge origin/main

# Giải quyết conflict trong editor, sau đó:
git add .
git commit -m "fix: resolve merge conflicts with main"
git push
```

---

## Tài liệu liên quan

- [Firebase Studio Documentation](https://firebase.google.com/docs/studio)
- [GitHub Pull Request Review Guide](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/about-pull-request-reviews)
- [Firebase Hosting Deploy](https://firebase.google.com/docs/hosting/github-integration)
