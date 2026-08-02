<div align="center">
  <img src="https://raw.githubusercontent.com/hungson1002/RelayCode/main/media/icon-128.png" alt="Biểu tượng RelayCode" width="72">
  <img src="https://raw.githubusercontent.com/hungson1002/RelayCode/main/docs/assets/hero.png" alt="RelayCode — AI Coding Agent" width="100%">
  <br><br>
  <strong>Không gian lập trình AI cho VS Code và Antigravity — dùng model của bạn, công cụ của bạn và luôn giữ quyền kiểm soát.</strong>
  <br><br>
  <sub>Một sản phẩm của <strong>Huxon</strong></sub>
  <br><br>
  <a href="https://github.com/hungson1002/RelayCode/blob/main/README.md">English</a> · <a href="https://github.com/hungson1002/RelayCode/blob/main/README.vi.md">Tiếng Việt</a>
</div>

---

## RelayCode là gì?

RelayCode của **Huxon** đưa ba chế độ **Agent**, **Chat** và **Plan** vào một sidebar tập trung. Bạn có thể kết nối API cloud, model local hoặc 9Router; giao việc cho Agent; theo dõi terminal và công cụ đang chạy; sau đó xem lại từng file trước khi chấp nhận.

RelayCode dành cho người muốn sử dụng coding agent đa model nhưng vẫn nhìn thấy và kiểm soát mọi thay đổi.

<p align="center">
  <img src="https://raw.githubusercontent.com/hungson1002/RelayCode/main/docs/assets/workflow.png" alt="Ask, work, review, accept or undo workflow" width="100%">
</p>

## Chức năng nổi bật

| Nhóm | Chức năng |
| --- | --- |
| **Agent, Chat và Plan** | Dùng Agent cho công việc trong workspace, Chat cho câu hỏi trực tiếp và Plan để lập kế hoạch trước. |
| **Nhiều nguồn model** | 9Router, Cockpit Tools, OpenCode, OpenAI, Anthropic Claude, API tương thích OpenAI, Ollama và LM Studio. |
| **Theo dõi khi thực hiện** | Xem lệnh, output terminal, tool call và tiến trình ngay trong cuộc trò chuyện. |
| **Xem lại thay đổi** | Kiểm tra từng file hoặc từng hunk, sau đó Accept hay Undo theo file, tác vụ hoặc toàn bộ. |
| **Chính sách quyền** | Hỏi trước, cho phép sửa file hoặc bật Full access với bước xác nhận rõ ràng. |
| **Chạy an toàn hơn** | Workspace Trust, chính sách lệnh, Git checkpoint chạy nền và thay đổi chờ duyệt. |
| **Công cụ MCP** | Kết nối dịch vụ qua OAuth, API key, HTTP hoặc MCP stdio chạy local. |
| **Kiểm tra model** | Xem model nào hoạt động, lưu yêu thích và thiết lập fallback có xác nhận. |
| **Theo dõi sử dụng** | Xem token, chi phí ước tính, độ trễ và thông tin rate limit nếu provider cung cấp. |
| **Agent tạo ảnh** | Tìm model ảnh, tạo PNG/JPEG/WebP rồi Review, Accept hoặc Undo file kết quả. |
| **Lưu trạng thái** | Lịch sử chat, thay đổi chờ duyệt, hồ sơ provider và tác vụ đang chạy được khôi phục sau reload. |
| **Tiếng Việt và English** | Đổi ngôn ngữ trực tiếp trong popup Cài đặt của extension. |

## Provider được hỗ trợ

| Provider | Xác thực | Endpoint mặc định |
| --- | --- | --- |
| 9Router | API key | `http://127.0.0.1:20128/v1` |
| Cockpit Tools | Client Key | `http://127.0.0.1:1455/v1` |
| OpenCode | API key | `https://console.opencode.ai/inference/openai/v1` |
| OpenAI | API key | API chính thức của OpenAI |
| Anthropic Claude | API key | Anthropic Messages API |
| OpenAI-compatible | Tùy provider | Endpoint do bạn nhập |
| Ollama | Thường không cần | `http://localhost:11434/v1` |
| LM Studio | Thường không cần | `http://localhost:1234/v1` |

Provider local thường không cần API key, nhưng server local phải đang chạy và máy cần tải model trước.

Tạo ảnh chỉ hoạt động trong chế độ **Agent** khi provider hiện tại hỗ trợ endpoint OpenAI-compatible `/images/generations`. Chế độ **Chat** vẫn chỉ trò chuyện với model và không chạy tool hay lệnh.

## Cài đặt

### Cài từ bản phát hành

1. Tải bản `relaycode-huxon-<version>.vsix` mới nhất tại [trang phát hành của RelayCode](https://github.com/hungson1002/RelayCode/releases).
2. Mở VS Code hoặc Antigravity.
3. Chạy **Extensions: Install from VSIX…** trong Command Palette.
4. Chọn file vừa tải và reload IDE.

### Chạy từ source

```powershell
git clone https://github.com/hungson1002/RelayCode.git
cd RelayCode
npm install
npm run check
```

Nhấn `F5` để mở Extension Development Host.

## Kết nối lần đầu

1. Mở biểu tượng **RelayCode** trên Activity Bar.
2. Chọn **Cài đặt**.
3. Chọn provider hoặc tạo hồ sơ provider mới.
4. Nhập endpoint và API key nếu provider yêu cầu.
5. Lưu, chọn model và gửi một câu hỏi thử.

Với 9Router, RelayCode có thể kiểm tra dịch vụ local, đề nghị cài đặt, tự chạy nền không cần terminal riêng và mở trang quản lý trong trình duyệt.

Với Cockpit Tools, hãy bật **API Service**, tạo một **Client Key**, rồi chọn Cockpit trong RelayCode. RelayCode lấy danh sách model qua gateway OpenAI-compatible local của Cockpit và không đọc thông tin đăng nhập tài khoản bên trong Cockpit.

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

Gõ `$` để tìm skill đã cài. RelayCode đọc các gói `SKILL.md` chuẩn từ `.agents/skills` trong workspace và `~/.agents/skills` của người dùng. Nội dung đầy đủ của skill chỉ được nạp khi bạn gọi rõ tên, ví dụ:

```text
$design-frontend Tạo landing page đẹp bằng HTML và CSS thuần.
```

RelayCode cũng đọc `AGENTS.md` ở cấp người dùng và project, bao gồm file gần nhất áp dụng cho file đang mở.

Các lệnh nhanh:

```text
/goal <mục tiêu>
/new
/compact
/skills
/model
/plan
/review
/status
/diagnostics
/mcp
/settings
/logs
/export
```

Sau khi hoàn thành, RelayCode hiển thị số file đã thay đổi cùng tổng dòng thêm và xóa. Bạn có thể mở **Review** để xem full diff hoặc từng hunk, sau đó chọn **Accept** hay **Undo**. Nếu Agent vừa tạo file mới, Undo sẽ xóa file đó.

Phiên Agent giữ lại các lượt gần nhất nên câu tiếp nối như “tiếp tục đi” vẫn có ngữ cảnh của tác vụ hiện tại. Khi provider im lặng, timeline sẽ hiện thời gian đang chờ; bạn có thể đổi giới hạn bằng `nineRouter.agentInactivityTimeoutSeconds`.

## Quyền và an toàn

RelayCode có ba mức quyền:

- **Hỏi mọi thao tác** — xác nhận trước khi Agent thực hiện hành động.
- **Cho phép sửa file** — cho sửa workspace nhưng vẫn giữ lớp bảo vệ với thao tác rủi ro.
- **Full access** — cho sửa file và chạy lệnh không cần hỏi lại liên tục. Việc bật luôn cần xác nhận.

Các lớp bảo vệ quan trọng:

- Workspace phải được Trust trước khi chạy Agent, terminal hoặc MCP.
- Deny list chặn các đoạn lệnh phá hoại đã cấu hình ngay cả khi dùng Full access.
- Nếu workspace là Git repository, RelayCode tạo checkpoint chạy nền ngay trước lần sửa file đầu tiên khi có thể.
- Thay đổi chờ duyệt được lưu để khôi phục sau khi IDE reload.
- API key và token MCP được lưu bằng VS Code `SecretStorage`.

## MCP

MCP giúp Agent làm việc với công cụ ngoài như hệ thống thiết kế, issue tracker, tài liệu, trình duyệt hoặc database.

RelayCode hỗ trợ:

- OAuth qua trình duyệt nếu MCP server cho phép dynamic client registration.
- Xác thực bằng API key hoặc bearer token.
- MCP server Streamable HTTP.
- MCP stdio local với biến môi trường bí mật được lưu riêng.

Một số dịch vụ chỉ cho phép OAuth với ứng dụng đã được phê duyệt. Khi đó, hãy dùng MCP từ ứng dụng desktop của dịch vụ, API key hoặc OAuth app do bạn tự đăng ký.

## Quyền riêng tư

- RelayCode không vận hành dịch vụ analytics riêng.
- Prompt và context chỉ được gửi đến provider đang chọn.
- Dữ liệu MCP chỉ được gửi đến server do bạn cấu hình.
- Credential được lưu trong `SecretStorage` và không xuất hiện trong gói chẩn đoán.
- Lịch sử chat, telemetry và thay đổi chờ duyệt nằm trên máy local.

Xem đầy đủ tại <a href="https://github.com/hungson1002/RelayCode/blob/main/PRIVACY.md">PRIVACY.md</a>.

## Giới hạn hiện tại

- Muốn ước tính chi phí cloud, bạn cần nhập giá input/output trong hồ sơ provider.
- Kiểm tra model sẽ gửi một request nhỏ và có thể sử dụng quota.
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

<a href="https://github.com/hungson1002/RelayCode/blob/main/LICENSE">MIT</a>
