import { MessageSquareText } from "lucide-react";

export default function Navbar({ isEscalated }) {
    return (
        <header
            className="flex items-center justify-between px-5 py-4 border-b"
            style={{ borderColor: "var(--console-border)", background: "var(--console-surface)" }}
        >
            <div className="flex items-center gap-2.5">
                <span
                    className="flex h-7 w-7 items-center justify-center rounded-md"
                    style={{ background: "var(--agent)" }}
                    aria-hidden="true"
                >
                    <MessageSquareText size={15} color="#f4f6f5" strokeWidth={1.8} />
                </span>
                <span className="font-display text-[15px] font-medium tracking-tight" style={{ color: "var(--console-ink)" }}>
                    Support Console
                </span>
            </div>

            <div className="flex items-center gap-2 font-display text-[12.5px] font-medium">
                <span
                    className={`h-2 w-2 rounded-full ${isEscalated ? "pulse-dot" : ""}`}
                    style={{ background: isEscalated ? "var(--amber)" : "var(--agent)" }}
                    aria-hidden="true"
                />
                <span style={{ color: isEscalated ? "var(--amber)" : "var(--console-muted)" }}>
                    {isEscalated ? "Human joining" : "Assistant online"}
                </span>
            </div>
        </header>
    );
}