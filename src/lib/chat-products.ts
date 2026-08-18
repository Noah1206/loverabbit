export const FREE_CHAT_TURNS = 5;

export interface ChatProduct {
  id: "chat-10";
  name: string;
  credits: number;
  price: number;
}

export const CHAT_PRODUCTS: Record<ChatProduct["id"], ChatProduct> = {
  "chat-10": {
    id: "chat-10",
    name: "캐릭터챗 대화권 10회",
    credits: 10,
    price: 9_900,
  },
};

export const DEFAULT_CHAT_PRODUCT = CHAT_PRODUCTS["chat-10"];

export function getChatProduct(value?: string): ChatProduct | null {
  return value && value in CHAT_PRODUCTS ? CHAT_PRODUCTS[value as ChatProduct["id"]] : null;
}

export function chatDepositorCode(userToken: string): string {
  const suffix = userToken
    .slice(-6)
    .replace(/[^a-zA-Z0-9]/g, "X")
    .toUpperCase()
    .padEnd(6, "X");
  return `챗-${suffix}`;
}
