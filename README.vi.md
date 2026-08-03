<div align="center">
  <img src="media/icon-128.png" alt="RelayCode" width="72">
  <h1>RelayCode</h1>
  <p><strong>Workspace lập trình AI ưu tiên review cho các editor tương thích VS Code.</strong></p>
  <p>Hoạt động với VS Code, Cursor, Antigravity và các môi trường tương thích khác.</p>
  <p>Hỏi, lập kế hoạch, sửa file, chạy kiểm tra và xem lại mọi thay đổi trước khi giữ lại.</p>
  <p>
    <a href="https://marketplace.visualstudio.com/items?itemName=huxon.relaycode-huxon">VS Code Marketplace</a> ·
    <a href="https://open-vsx.org/extension/huxon/relaycode-huxon">Open VSX</a> ·
    <a href="https://github.com/hungson1002/RelayCode/releases">Bản phát hành</a> ·
    <a href="https://github.com/hungson1002/RelayCode/issues">Issues</a> ·
    <a href="LICENSE">License</a> ·
    <a href="README.md">English</a>
  </p>
</div>

<p align="center">
  <img src="docs/assets/marketing/relaycode-home.png" alt="Màn hình chính RelayCode với model picker và composer" width="900">
</p>

<p align="center">
  <img src="docs/assets/marketing/relaycode-demo.gif" alt="Workflow Agent của RelayCode: hỏi, làm việc và review" width="900">
</p>

<p align="center"><em>Đặt câu hỏi, để Agent làm việc, rồi review kết quả trước khi chấp nhận.</em></p>

## RelayCode là gì?

RelayCode đưa Chat, Agent và Plan vào workspace VS Code hiện tại. Bạn chọn provider và model, theo dõi hoạt động trong lúc làm việc, rồi review thay đổi của file trước khi đưa chúng vào project.

## Vì sao là RelayCode?

- **Ưu tiên review** — xem file thay đổi và diff trước khi chấp nhận hoặc hoàn tác.
- **Activity rõ ràng** — theo dõi bước hiện tại, tool activity, file đã đọc và kết quả kiểm tra.
- **Kiểm soát quyền** — chọn mức tự động hóa của Agent khi sửa file hoặc chạy lệnh.
- **Đa provider** — chuyển giữa các profile, endpoint và model mà không đổi workflow.
- **MCP và context của workspace** — kết nối MCP server đã cấu hình và cho Agent làm việc cùng context của project.
- **Streaming response** — thấy câu trả lời được tạo ra trong lúc Agent làm việc.
- **Tự khớp ngôn ngữ** — response bám theo ngôn ngữ của tin nhắn mới nhất khi model được chọn hỗ trợ.

## Ba cách làm việc

### Chat

Hỏi giải thích, review hoặc một câu trả lời tập trung mà không cấp cho model quyền sửa workspace.

### Agent

Cho Agent đọc workspace, sửa file, chạy lệnh đã được cho phép, dùng MCP tool đã cấu hình và báo lại kết quả. Activity timeline và change tray giúp workflow luôn dễ theo dõi.

### Plan

Biến một yêu cầu lớn thành implementation plan trước khi chạm vào file. Phù hợp khi cần thống nhất phạm vi, thứ tự thực hiện hoặc tạo checkpoint trước.

## Thay đổi có thể review

Agent gom các chỉnh sửa vào một change set để review. Bạn xem file và diff, sau đó chấp nhận hoặc hoàn tác ngay trong change tray.

## Xem RelayCode hoạt động

Giao diện thật tập trung prompt, model, mode, activity và các nút review trong cùng một workflow.

<p align="center">
  <img src="docs/assets/marketing/relaycode-agent.png" alt="Chế độ Agent của RelayCode với phân tích workspace và kết quả kiểm tra" width="900">
</p>

Agent hiển thị file đã phân tích, context của project và kết quả validation ngay trong cuộc trò chuyện.

<p align="center">
  <img src="docs/assets/marketing/relaycode-review.png" alt="Review card của RelayCode với README thay đổi và nút Accept, Undo" width="900">
</p>

Change tray cho biết file nào đã thay đổi và cung cấp các thao tác **Review**, **Accept all** và **Undo all**.

<p align="center">
  <img src="docs/assets/marketing/relaycode-connection.png" alt="Provider settings của RelayCode với nhiều lựa chọn provider" width="900">
</p>

Provider settings gom active profile, endpoint, model source và thông tin kết nối vào một nơi. Các ảnh giao diện không chứa credential.

<p align="center">
  <img src="docs/assets/workflow.png" alt="Workflow RelayCode: hỏi, làm việc, review, quyết định" width="900">
</p>

## Bắt đầu nhanh

1. Cài RelayCode từ [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=huxon.relaycode-huxon), [Open VSX](https://open-vsx.org/extension/huxon/relaycode-huxon) hoặc trang [GitHub Releases](https://github.com/hungson1002/RelayCode/releases).
2. Mở view RelayCode từ Activity Bar.
3. Mở **Settings**, chọn hoặc tạo provider profile, rồi cấu hình endpoint và API key nếu provider yêu cầu.
4. Chọn model, chọn **Chat**, **Agent** hoặc **Plan**, rồi gửi prompt đầu tiên.

Nếu muốn dùng setup local-first, hãy chạy [9Router](https://github.com/hungson1002/9router) và dùng endpoint OpenAI-compatible mặc định:

```text
http://127.0.0.1:20128/v1
```

## Provider và model

RelayCode có profile cho các provider:

- 9Router
- Cockpit Tools
- OpenCode
- OpenAI
- Anthropic Claude
- OpenAI-compatible endpoints
- Ollama
- LM Studio

Model picker hiển thị các model mà provider đang active cung cấp. Endpoint, API key và thiết lập pricing được tách theo profile để bạn đổi provider mà không phải đổi workflow.

## MCP, context và skills

RelayCode có thể kết nối MCP server đã cấu hình qua local process hoặc HTTP, bao gồm OAuth hoặc bearer-token flow nếu server hỗ trợ. Agent có thể dùng các tool đó cùng với file trong workspace và context của cuộc trò chuyện hiện tại.

Skills và instruction của project là một phần của context được đưa cho model. Chỉ bật tool và instruction phù hợp với workspace mà bạn tin cậy.

## Permission controls

- Chọn **Ask**, **Edit files** hoặc **Full access** tùy task và mức độ tin cậy.
- Dùng mode ít quyền nhất nhưng vẫn phù hợp với công việc.

## An toàn và quyền riêng tư

- Workspace Trust và permission mode đang chọn được áp dụng cho các hành động của Agent.
- Review thay đổi của file trước khi chấp nhận; change tray có thể undo.
- API key được lưu bằng VS Code Secret Storage và không ghi vào file của project.
- Request chỉ được gửi đến provider khi bạn sử dụng provider đã cấu hình.
- Cơ chế xác thực MCP phụ thuộc vào server và chính sách cấp quyền của server đó.

Xem [Privacy Policy](PRIVACY.md) để biết chi tiết.

## Cấu hình

Bạn có thể mở RelayCode settings từ nút settings trong sidebar hoặc từ VS Code Settings. Một số tùy chọn chính:

- Interface language: `Vietnamese` hoặc `English`.
- Provider profile, endpoint và API key.
- Default mode: `Chat` hoặc `Agent`.
- Default model và model health checks.
- Input/output pricing cho usage estimate local.

## FAQ

### RelayCode có bắt buộc dùng một provider cụ thể không?

Không. Bạn có thể chọn provider tích hợp sẵn hoặc cấu hình endpoint OpenAI-compatible. Model nào khả dụng phụ thuộc vào provider đang active.

### Agent có tự động sửa file không?

Agent chỉ làm theo permission mode đang chọn. Thay đổi được đưa vào change tray để bạn kiểm tra, chấp nhận hoặc hoàn tác.

### Có dùng được model local không?

Có. Ollama, LM Studio, 9Router và các endpoint local tương thích khác đều có thể cấu hình qua provider profile.

### Nếu provider không khả dụng thì sao?

RelayCode hiển thị lỗi kết nối hoặc lỗi model trong sidebar. Bạn có thể chuyển profile hoặc chọn model khác đang khả dụng.

## Phát triển

```powershell
npm install
npm run check
npm run build
```

Nhấn `F5` để mở Extension Development Host. Xem [CHANGELOG.md](CHANGELOG.md) để theo dõi release notes.

## Tài nguyên

- [Privacy Policy](PRIVACY.md)
- [Changelog](CHANGELOG.md)
- [GitHub Releases](https://github.com/hungson1002/RelayCode/releases)
- [GitHub Issues](https://github.com/hungson1002/RelayCode/issues)
- [README tiếng Anh](README.md)

## License

[MIT](LICENSE)
