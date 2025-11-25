// Chat.types.ts
export type ChatMessage = {
    id: number;
    text: string;
    self: boolean;
    from: string | null;
    type: "system" | "message" | "reaction";
    // quando type === 'reaction', reaction contém o emoji ou código da reação
    reaction?: string | null;
};
