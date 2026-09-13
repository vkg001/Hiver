import MessageBubble from "./MessageBubble";

function TypingIndicator() {
    return (
        <div className="flex items-center gap-2.5">
            <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-display text-[11px] font-semibold"
                style={{ background: "var(--agent)", color: "var(--user-text)" }}
                aria-hidden="true"
            >
                A
            </span>
            <div
                className="flex items-center gap-1 rounded-2xl rounded-tl-sm px-4 py-3"
                style={{ background: "var(--agent-bubble)" }}
            >
                {[0, 1, 2].map((i) => (
                    <span
                        key={i}
                        className="typing-dot h-1.5 w-1.5 rounded-full"
                        style={{ background: "var(--agent)" }}
                    />
                ))}
            </div>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center">
            <p className="font-display text-[15px] font-medium" style={{ color: "var(--console-ink)" }}>
                No messages yet
            </p>
            <p className="font-body text-[13px]" style={{ color: "var(--console-muted)" }}>
                Send a message below to start the conversation.
            </p>
        </div>
    );
}

export default function ChatContainer({ messages, isLoading, messagesEndRef }) {
    const lastMessage = messages[messages.length - 1];
    const isStreamingLast = isLoading && lastMessage?.role === "agent";
    const showTypingIndicator = isLoading && lastMessage?.role === "agent" && lastMessage.content === "";

    return (
        <div className="console-scroll flex-1 overflow-y-auto px-5 py-6" style={{ background: "var(--console-bg)" }}>
            {messages.length === 0 ? (
                <EmptyState />
            ) : (
                <div className="mx-auto flex max-w-2xl flex-col gap-4">
                    {messages.map((message, i) => (
                        <MessageBubble
                            key={i}
                            message={message}
                            isStreaming={isStreamingLast && i === messages.length - 1 && message.content !== ""}
                        />
                    ))}
                    {showTypingIndicator && <TypingIndicator />}
                    <div ref={messagesEndRef} />
                </div>
            )}
        </div>
    );
}