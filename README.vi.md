<div align="center">
  <img src="https://raw.githubusercontent.com/hungson1002/Loi-Code/main/docs/assets/hero.png" alt="Lối — AI Coding Agent" width="100%">
  <br><br>
  <strong>Không gian lập trình AI cho VS Code và Antigravity — dùng model của bạn, công cụ của bạn và luôn giữ quyền kiểm soát.</strong>
  <br><br>
  <a href="https://github.com/hungson1002/Loi-Code/blob/main/README.md">English</a> · <a href="https://github.com/hungson1002/Loi-Code/blob/main/README.vi.md">Tiếng Việt</a>
</div>

---

## Lối là gì?

Lối đưa ba chế độ **Agent**, **Chat** và **Plan** vào một sidebar tập trung. Bạn có thể kết nối API cloud, model local hoặc 9Router; giao việc cho Agent; theo dõi terminal và công cụ đang chạy; sau đó xem lại từng file trước khi chấp nhận.

Lối dành cho người muốn sử dụng coding agent đa model nhưng vẫn nhìn thấy và kiểm soát mọi thay đổi.

<p align="center">
  <img src="https://raw.githubusercontent.com/hungson1002/Loi-Code/main/docs/assets/workflow.png" alt="Quy trình giao việc, thực hiện, xem lại và chấp nhận hoặc hoàn tác" width="100%">
</p>

## Chức năng nổi bật

| Nhóm | Chức năng |
| --- | --- |
| **Agent, Chat và Plan** | Dùng Agent cho công việc trong workspace, Chat cho câu hỏi trực tiếp và Plan để lập kế hoạch trước. |
| **Nhiều nguồn model** | 9Router, OpenAI, Anthropic Claude, API tương thích OpenAI, Ollama và LM Studio. |
| **Theo dõi khi thực hiện** | Xem lệnh, output terminal, tool call và tiến trình ngay trong cuộc trò chuyện. |
| **Xem lại thay đổi** | Kiểm tra từng file hoặc từng hunk, sau đó Accept hay Undo theo file, tác vụ hoặc toàn bộ. |
| **Chính sách quyền** | Hỏi trước, cho phép sửa file hoặc bật Full access với bước xác nhận rõ ràng. |
| **Chạy an toàn hơn** | Workspace Trust, chính sách lệnh, Git checkpoint và sandbox Docker/Podman tùy chọn. |
| **Công cụ MCP** | Kết nối dịch vụ qua OAuth, API key, HTTP hoặc MCP stdio chạy local. |
| **Kiểm tra model** | Xem model nào hoạt động, lưu yêu thích và thiết lập fallback có xác nhận. |
| **Theo dõi sử dụng** | Xem token, chi phí ước tính, độ trễ và thông tin rate limit nếu provider cung cấp. |
| **Lưu trạng thái** | Lịch sử chat, thay đổi chờ duyệt, hồ sơ provider và tác vụ đang chạy được khôi phục sau reload. |
| **Tiếng Việt và English** | Đổi ngôn ngữ trực tiếp trong popup Cài đặt của extension. |

## Provider được hỗ trợ

| Provider | Xác thực | Endpoint mặc định |
| --- | --- | --- |
| 9Router | API key | `http://localhost:20128/v1` |
| OpenAI | API key | API chính thức của OpenAI |
| Anthropic Claude | API key | Anthropic Messages API |
| OpenAI-compatible | Tùy provider | Endpoint do bạn nhập |
| Ollama | Thường không cần | `http://localhost:11434/v1` |
| LM Studio | Thường không cần | `http://localhost:1234/v1` |

Provider local thường không cần API key, nhưng server local phải đang chạy và máy cần tải model trước.

## Cài đặt

### Cài từ bản phát hành

1. Tải `loi-agent-1.0.0.vsix` tại [trang phát hành của Lối](https://github.com/hungson1002/Loi-Code/releases).
2. Mở VS Code hoặc Antigravity.
3. Chạy **Extensions: Install from VSIX…** trong Command Palette.
4. Chọn file vừa tải và reload IDE.

### Chạy từ source

```powershell
git clone https://github.com/hungson1002/Loi-Code.git
cd Loi-Code
npm install
npm run check
```

Nhấn `F5` để mở Extension Development Host.

## Kết nối lần đầu

1. Mở biểu tượng **Lối** trên Activity Bar.
2. Chọn **Cài đặt**.
3. Chọn provider hoặc tạo hồ sơ provider mới.
4. Nhập endpoint và API key nếu provider yêu cầu.
5. Lưu, chọn model và gửi một câu hỏi thử.

Với 9Router, Lối có thể kiểm tra dịch vụ local, đề nghị cài đặt, tự chạy nền không cần terminal riêng và mở trang quản lý trong trình duyệt.

## Làm việc với Agent

Khung chat hỗ trợ file, ảnh dán từ clipboard và context nhanh:

```text
@selection
@file:path/to/file.ts
@folder:path/to/folder
@terminal
@git-diff
@problems
```

Các lệnh nhanh:

```text
/new
/models
/diagnostics
/mcp
/settings
/logs
/export
```

Sau khi hoàn thành, Lối hiển thị số file đã thay đổi cùng tổng dòng thêm và xóa. Bạn có thể mở **Review** để xem full diff hoặc từng hunk, sau đó chọn **Accept** hay **Undo**. Nếu Agent vừa tạo file mới, Undo sẽ xóa file đó.

## Quyền và an toàn

Lối có ba mức quyền:

- **Hỏi mọi thao tác** — xác nhận trước khi Agent thực hiện hành động.
- **Cho phép sửa file** — cho sửa workspace nhưng vẫn giữ lớp bảo vệ với thao tác rủi ro.
- **Full access** — cho sửa file và chạy lệnh không cần hỏi lại liên tục. Việc bật luôn cần xác nhận.

Các lớp bảo vệ quan trọng:

- Workspace phải được Trust trước khi chạy Agent, terminal hoặc MCP.
- Deny list chặn các đoạn lệnh phá hoại đã cấu hình ngay cả khi dùng Full access.
- Nếu workspace là Git repository, Lối cố gắng tạo checkpoint trước mỗi tác vụ Agent.
- Thay đổi chờ duyệt được lưu để khôi phục sau khi IDE reload.
- API key và token MCP được lưu bằng VS Code `SecretStorage`.

## Chạy trong sandbox

Lối có thể sao chép workspace sang thư mục tạm và chạy lệnh trong Docker hoặc Podman:

- **Sandbox bắt buộc** — không chạy nếu thiếu container runtime.
- **Sandbox ưu tiên** — dùng sandbox khi có và hỏi trước khi chuyển sang chạy trực tiếp.
- **Chạy trực tiếp** — làm việc trong workspace thật theo mức quyền đang chọn.

Container được bỏ bớt Linux capabilities, giới hạn CPU/RAM/PID và tắt mạng theo mặc định. Thay đổi trong sandbox chỉ được đưa vào workspace thật sau khi bạn Accept.

> Docker hoặc Podman không bắt buộc. Chế độ chạy trực tiếp vẫn hoạt động khi máy không có container runtime.

## MCP

MCP giúp Agent làm việc với công cụ ngoài như hệ thống thiết kế, issue tracker, tài liệu, trình duyệt hoặc database.

Lối hỗ trợ:

- OAuth qua trình duyệt nếu MCP server cho phép dynamic client registration.
- Xác thực bằng API key hoặc bearer token.
- MCP server Streamable HTTP.
- MCP stdio local với biến môi trường bí mật được lưu riêng.

Một số dịch vụ chỉ cho phép OAuth với ứng dụng đã được phê duyệt. Khi đó, hãy dùng MCP từ ứng dụng desktop của dịch vụ, API key hoặc OAuth app do bạn tự đăng ký.

## Quyền riêng tư

- Lối không vận hành dịch vụ analytics riêng.
- Prompt và context chỉ được gửi đến provider đang chọn.
- Dữ liệu MCP chỉ được gửi đến server do bạn cấu hình.
- Credential được lưu trong `SecretStorage` và không xuất hiện trong gói chẩn đoán.
- Lịch sử chat, telemetry và thay đổi chờ duyệt nằm trên máy local.

Xem đầy đủ tại <a href="https://github.com/hungson1002/Loi-Code/blob/main/PRIVACY.md">PRIVACY.md</a>.

## Giới hạn hiện tại

- Muốn ước tính chi phí cloud, bạn cần nhập giá input/output trong hồ sơ provider.
- Kiểm tra model sẽ gửi một request nhỏ và có thể sử dụng quota.
- Sandbox tắt mạng không thể tải dependency còn thiếu.
- Khả năng OAuth phụ thuộc chính sách của từng nhà cung cấp MCP.
- Chất lượng Agent và khả năng dùng tool phụ thuộc model.

## Phát triển

```powershell
npm install
npm run typecheck
npm test
npm run build
npm run package
```

Dự án yêu cầu Node.js 20+ và VS Code 1.100+.

## Giấy phép

<a href="https://github.com/hungson1002/Loi-Code/blob/main/LICENSE">MIT</a>
