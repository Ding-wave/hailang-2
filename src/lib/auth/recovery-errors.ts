export function isPkceVerifierError(message: string) {
  return /pkce|code verifier/i.test(message);
}

export function recoveryLinkErrorMessage(message: string) {
  if (isPkceVerifierError(message)) {
    return "无法在 QQ 邮箱内置浏览器完成验证。请用「在浏览器中打开」或复制链接到 Safari/Chrome，然后重新申请一封重置邮件。";
  }
  return message;
}
