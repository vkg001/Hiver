import { Send, Loader2 } from "lucide-react";

export default function ChatInput({ input, setInput, sendMessage, isLoading }) {
    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage(e);
        }
    };

    return (
        <form
            onSubmit={sendMessage}
            className="flex items-end gap-2.5 border-t px-4 py-3.5"
            style={{ borderColor: "var(--console-border)", background: "var(--console-surface)" }}
        >
            <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                rows={1}
                disabled={isLoading}
                className="font-body max-h-32 flex-1 resize-none rounded-xl border px-3.5 py-2.5 text-[14.5px] outline-none focus-visible:ring-2 disabled:opacity-60"
                style={{
                    borderColor: "var(--console-border)",
                    color: "var(--console-ink)",
                    background: "var(--console-bg)",
                }}
            />
            <button
                type="submit"
                disabled={isLoading || !input.trim()}
                aria-label="Send message"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-opacity disabled:opacity-40"
                style={{ background: "var(--agent)" }}
            >
                {isLoading ? (
                    <Loader2 size={17} color="#f4f6f5" className="animate-spin" />
                ) : (
                    <Send size={17} color="#f4f6f5" strokeWidth={2} />
                )}
            </button>
        </form>
    );
}