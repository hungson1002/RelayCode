<div align="center">
  <img src="https://raw.githubusercontent.com/hungson1002/RelayCode/main/media/icon-128.png" alt="RelayCode" width="72">
  <h1>RelayCode</h1>
  <p><strong>Workspace lập trình AI ưu tiên review dành cho các editor tương thích VS Code.</strong></p>
  <p>Trò chuyện, lập kế hoạch, sửa code, chạy kiểm tra và review thay đổi ngay trong project.</p>
  <p>
    <a href="https://marketplace.visualstudio.com/items?itemName=huxon.relaycode-huxon">Marketplace</a> ·
    <a href="https://open-vsx.org/extension/huxon/relaycode-huxon">Open VSX</a> ·
    <a href="https://github.com/hungson1002/RelayCode/releases">Bản phát hành</a> ·
    <a href="https://github.com/hungson1002/RelayCode/issues">Báo lỗi</a> ·
    <a href="README.md">English</a>
  </p>
</div>

<p align="center">
  <img src="https://raw.githubusercontent.com/hungson1002/RelayCode/main/docs/assets/marketing/relaycode-home.png" alt="Workspace RelayCode" width="680">
</p>

## Tổng quan

RelayCode đưa AI vào workspace hiện tại nhưng vẫn để bạn kiểm soát toàn bộ quy trình. Chọn provider và model, làm việc bằng Chat, Agent hoặc Plan, sau đó kiểm tra thay đổi của file trước khi chấp nhận.

Extension hoạt động trên VS Code, Antigravity, Cursor và các editor tương thích khác.

## Điểm chính

- **Ưu tiên review** — xem diff trước khi chấp nhận hoặc hoàn tác thay đổi.
- **Thao tác rõ ràng** — theo dõi tool, lệnh, kết quả kiểm tra và lỗi trong timeline.
- **Agent harness gọn nhẹ** — quản lý vòng đời, hủy, khôi phục và bảo vệ workspace mà không bắt buộc chạy nền Docker hoặc WSL.
- **Chat, Agent và Plan** — chọn mức tự động hóa phù hợp với từng công việc.
- **Nhiều provider** — tách profile cho dịch vụ cloud, local và endpoint tương thích OpenAI.
- **Công cụ MCP** — mở rộng Agent bằng dịch vụ local hoặc remote đáng tin cậy.
- **Kiểm soát quyền** — quyết định khi nào RelayCode được sửa file hoặc chạy lệnh.

<p align="center">
  <img src="https://raw.githubusercontent.com/hungson1002/RelayCode/main/docs/assets/marketing/relaycode-demo.gif" alt="Quy trình Agent và review của RelayCode" width="680">
</p>

## Bắt đầu nhanh

1. Cài RelayCode từ [Marketplace](https://marketplace.visualstudio.com/items?itemName=huxon.relaycode-huxon), [Open VSX](https://open-vsx.org/extension/huxon/relaycode-huxon) hoặc [Bản phát hành](https://github.com/hungson1002/RelayCode/releases).
2. Mở **RelayCode: Chat** từ Activity Bar.
3. Mở **Settings** và kết nối một provider profile.
4. Chọn model, sau đó chọn **Chat**, **Agent** hoặc **Plan**.

Nếu dùng [9Router](https://github.com/hungson1002/9router) trên máy, hãy cấu hình endpoint tương thích OpenAI:

```text
http://127.0.0.1:20128/v1
```

## Chế độ làm việc

- **Chat** trả lời câu hỏi mà không sửa workspace.
- **Agent** có thể đọc file, sửa code, chạy lệnh đã được duyệt và dùng công cụ MCP.
- **Plan** tạo kế hoạch triển khai để review trước khi thay đổi file.

## Provider

RelayCode hỗ trợ 9Router, Cockpit Tools, OpenCode, OpenAI, Anthropic Claude, Ollama, LM Studio và endpoint tùy chỉnh tương thích OpenAI. Danh sách model được lấy trực tiếp từ provider profile đang hoạt động.

API key được lưu bằng Secret Storage của editor và không được ghi vào file project.

## Kết nối MCP

MCP cho phép RelayCode dùng thêm công cụ như điều khiển trình duyệt, dịch vụ bên ngoài hoặc workflow chuyên biệt. Mở **Settings → MCP**, thêm local process hoặc HTTP server, hoàn tất xác thực nếu cần và chỉ bật công cụ bạn tin cậy cho workspace hiện tại.

Thao tác MCP được hiển thị trong timeline và vẫn tuân theo cơ chế quyền cùng quy trình review của RelayCode.

### ChatGPT Web

Chạy `/chatgpt` hoặc **RelayCode: Manage ChatGPT Web Bridge** để kết nối ChatGPT qua MCP tunnel bảo mật. RelayCode hướng dẫn nhập Tunnel ID và Runtime API key, kiểm tra tunnel client chính thức và lưu key trong Secret Storage.

Khi ChatGPT Web dùng tool RelayCode, một timeline **ChatGPT Web** riêng sẽ xuất hiện trong lịch sử chat. Các thao tác đọc file, tìm code, sửa file, chạy lệnh và lỗi được ghi tại đây. Thay đổi file vẫn dùng quy trình **Review**, **Accept** và **Undo** giống Agent.

MCP chỉ chia sẻ hoạt động của tool, không chia sẻ toàn bộ cuộc trò chuyện ChatGPT. Xem [hướng dẫn Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels) của OpenAI để thiết lập tài khoản và Developer mode.

## An toàn

- File tool và thư mục chạy lệnh được giới hạn trong workspace đáng tin cậy bằng hàng rào nhẹ chạy cùng process. Đây không phải lớp cách ly cấp hệ điều hành/container.
- Dùng mức quyền thấp nhất phù hợp với công việc.
- Review thay đổi của file trước khi chấp nhận.
- Chỉ kết nối MCP server mà bạn tin cậy.
- Chỉ bật Workspace Trust cho project đáng tin cậy.

Xem [Chính sách quyền riêng tư](PRIVACY.md) để biết thêm chi tiết.

## Phát triển

```powershell
npm install
npm run check
npm run build
```

Nhấn `F5` để mở Extension Development Host. Xem lịch sử phiên bản trong [CHANGELOG.md](CHANGELOG.md).

## Giấy phép

[MIT](LICENSE)
