export function localizeProviderError(raw: string, language: 'vi' | 'en'): string {
  const compact = raw.replace(/\s+/g, ' ').trim();
  if (/image_url|unknown variant.*image|vision|image input/i.test(compact)) {
    return language === 'en'
      ? 'Model does not support image input. Choose a Vision model or resend without the image.'
      : 'Model không hỗ trợ xem ảnh. Hãy chọn model có Vision hoặc gửi lại yêu cầu không kèm ảnh.';
  }
  if (/HTTP 404\b/i.test(compact) && /<!doctype html|<html[\s>]|<head[\s>]/i.test(compact)) {
    return language === 'en'
      ? 'Endpoint not found (HTTP 404). Check the provider Base URL and API path.'
      : 'Endpoint không tồn tại (HTTP 404). Hãy kiểm tra Base URL và đường dẫn API của provider.';
  }
  if (/Invalid URL|ERR_INVALID_URL|URL kh(?:ô|Ã´)ng h(?:ợ|á»£)p l(?:ệ|»‡)|Failed to parse URL/i.test(compact)) {
    return language === 'en'
      ? 'Endpoint is not a valid URL. Enter a complete URL beginning with http:// or https://.'
      : 'Endpoint không phải URL hợp lệ. Hãy nhập đầy đủ URL bắt đầu bằng http:// hoặc https://.';
  }
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|ECONNRESET|network error|Failed to fetch/i.test(compact)) {
    return language === 'en'
      ? 'Could not reach the endpoint. Check the URL, network connection, and whether the provider is running.'
      : 'Không thể kết nối tới endpoint. Hãy kiểm tra URL, mạng và provider có đang chạy hay không.';
  }
  if (/INVALID_MODEL_ID|invalid model (?:id|identifier)|model (?:not found|not supported)/i.test(compact)) {
    return language === 'en'
      ? 'HTTP 400 · This model ID is invalid or is no longer available from the provider. Choose another model.'
      : 'HTTP 400 · ID model không hợp lệ hoặc model không còn được provider cung cấp. Hãy chọn model khác.';
  }
  if (/returned no completion choices/i.test(compact)) {
    return language === 'en'
      ? 'The provider accepted the request but returned no chat response for this model.'
      : 'Provider đã nhận request nhưng không trả về phản hồi chat cho model này.';
  }
  if (/aborted due to timeout|timed? ?out|timeout/i.test(compact)) {
    return language === 'en'
      ? 'The model did not respond within the test time. This does not prove that the model is unavailable.'
      : 'Model chưa phản hồi trong thời gian kiểm tra. Điều này không có nghĩa là model không dùng được.';
  }
  if (/HTTP 429|rate.?limit|too many requests|quota exceeded|resource.?exhausted/i.test(compact)) {
    return language === 'en'
      ? 'The provider is rate-limiting this model. Try again later.'
      : 'Provider đang giới hạn lượt gọi model này. Hãy thử lại sau.';
  }
  if (/HTTP 401|invalid api key|unauthori[sz]ed/i.test(compact)) {
    return language === 'en'
      ? 'The API key is invalid or has expired.'
      : 'API key không hợp lệ hoặc đã hết hạn.';
  }
  if (/HTTP 403|forbidden|permission denied|insufficient quota/i.test(compact)) {
    return language === 'en'
      ? 'The provider denied access to this model or account.'
      : 'Provider từ chối quyền truy cập model hoặc tài khoản này.';
  }
  if (/<(?:!doctype|html|head|body)[\s>]/i.test(compact)) {
    const status = compact.match(/HTTP \d{3}/i)?.[0];
    return language === 'en'
      ? `${status ? `${status} · ` : ''}Provider returned an HTML page instead of an API response. Check the endpoint.`
      : `${status ? `${status} · ` : ''}Provider trả về trang HTML thay vì phản hồi API. Hãy kiểm tra endpoint.`;
  }
  return compact.slice(0, 600);
}
