// Utilities for masking emails in UI to protect privacy

// Mask a single email-like string to a fixed pattern, e.g.,
//  "dfwedasfwes@wqe.com" -> "d*****@****.***"
export function maskEmailForDisplay(value: string | null | undefined): string {
  const s = (value ?? '').trim()
  const at = s.indexOf('@')
  if (at <= 0) return s
  const localFirst = s[0] || '*'
  return `${localFirst}*****@****.***`
}

// Mask any email-like substrings inside a larger text
export function maskEmailsInText(text: string | null | undefined): string {
  const s = text ?? ''
  const emailRe = /[^\s、]+@[^\s、]+/g
  return s.replace(emailRe, (m) => maskEmailForDisplay(m))
}
