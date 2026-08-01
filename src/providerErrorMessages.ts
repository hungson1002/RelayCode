export function localizeProviderError(raw: string, language: 'vi' | 'en'): string {
  const compact = raw.replace(/\s+/g, ' ').trim();
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
  return raw;
}
