export async function sendTelegramAlert(input: {
  token?: string;
  chatId?: string;
  text: string;
}): Promise<"sent" | "skipped"> {
  if (!input.token || !input.chatId) {
    return "skipped";
  }

  const response = await fetch(`https://api.telegram.org/bot${input.token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: input.chatId,
      text: input.text,
      disable_web_page_preview: true,
    }),
  });
  if (!response.ok) {
    throw new Error(`Telegram alert failed: HTTP ${response.status}`);
  }
  return "sent";
}
