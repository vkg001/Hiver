import { Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";

function Tag({ label, value }) {
    return (
        <span
            className="font-display rounded px-1.5 py-0.5 text-[10.5px] font-medium tracking-tight"
            style={{ background: "var(--console-bg)", color: "var(--console-muted)" }}
        >
            {label}: {value}
        </span>
    );
}

const markdownComponents = {
    p: (props) => <p className="mb-2 last:mb-0" {...props} />,
    strong: (props) => <strong className="font-semibold" {...props} />,
    ul: (props) => <ul className="mb-2 ml-4 list-disc space-y-1 last:mb-0" {...props} />,
    ol: (props) => <ol className="mb-2 ml-4 list-decimal space-y-1 last:mb-0" {...props} />,
    a: (props) => (
        <a className="underline underline-offset-2" style={{ color: "var(--agent)" }} target="_blank" rel="noreferrer" {...props} />
    ),
    code: ({ inline, ...props }) =>
        inline ? (
            <code className="rounded bg-black/[0.06] px-1 py-0.5 font-mono text-[13px]" {...props} />
        ) : (
            <code className="block overflow-x-auto rounded-md bg-black/[0.06] p-2 font-mono text-[13px]" {...props} />
        ),
};

export default function MessageBubble({ message, isStreaming }) {
    const { role, content, action, intent } = message;

    if (role === "error") {
        return (
            <div
                className="msg-enter mx-auto max-w-[85%] rounded-md border px-3.5 py-2.5 text-[13.5px] font-body"
                style={{ background: "var(--error-bg)", borderColor: "var(--error)", color: "var(--error)" }}
            >
                {content}
            </div>
        );
    }

    if (role === "user") {
        return (
            <div className="msg-enter flex justify-end">
                <div
                    className="max-w-[75%] rounded-2xl rounded-br-sm px-4 py-2.5 text-[14.5px] leading-relaxed font-body"
                    style={{ background: "var(--user-bubble)", color: "var(--user-text)" }}
                >
                    {content}
                </div>
            </div>
        );
    }

    // agent
    const hasTags = Boolean(intent || action) && action !== "ESCALATE";
    return (
        <div className="msg-enter flex items-start gap-2.5">
            <span
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                style={{ background: "var(--agent)" }}
                aria-hidden="true"
            >
                <Bot size={14} color="#f4f6f5" strokeWidth={2} />
            </span>
            <div className="flex max-w-[75%] flex-col gap-1.5">
                <div
                    className={`rounded-2xl rounded-tl-sm px-4 py-2.5 text-[14.5px] leading-relaxed font-body ${
                        isStreaming ? "cursor-blink" : ""
                    }`}
                    style={{ background: "var(--agent-bubble)", color: "var(--console-ink)" }}
                >
                    <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
                </div>
                {hasTags && (
                    <div className="flex flex-wrap gap-1.5 pl-0.5">
                        {intent && <Tag label="intent" value={intent} />}
                        {action && <Tag label="action" value={action} />}
                    </div>
                )}
            </div>
        </div>
    );
}