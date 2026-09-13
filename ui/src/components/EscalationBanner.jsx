import { UserRound } from "lucide-react";

export default function EscalationBanner() {
    return (
        <div
            className="flex items-center gap-3 border-t px-5 py-4"
            style={{ borderColor: "var(--console-border)", background: "var(--amber-bg)" }}
        >
            <span
                className="pulse-dot flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                style={{ background: "var(--amber)" }}
            >
                <UserRound size={14} color="#fbf1e8" strokeWidth={2} />
            </span>
            <p className="font-body text-[13.5px]" style={{ color: "#7a4a26" }}>
                A human agent is joining this conversation. Sending is paused until they arrive.
            </p>
        </div>
    );
}