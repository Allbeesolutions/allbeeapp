export const apnSafeHtml = (html) => String(html || "")
  .replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, "")
  .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
  .replace(/<(?!\/?(b|strong|i|em|u|br|p|ul|ol|li)\b)[^>]*>/gi, "");
