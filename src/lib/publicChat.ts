/** Event the public chat window listens for, so any page can open it
 *  (the homepage's "Ask a question") without shipping a second chat. */
export const OPEN_CHAT_EVENT = "bantay:open-chat";

/** Opens the public chat window from anywhere on the site. */
export function openPublicChat() {
  window.dispatchEvent(new Event(OPEN_CHAT_EVENT));
}
