import { useEffect, useRef } from "react";
import { Navbar, ChatContainer, ChatInput, EscalationBanner } from "./../components";
import { useChatStore } from "./../store/chatStore";
import "./../styles/chat-animations.css";

export default function Home() {
    const messages = useChatStore((state) => state.messages);
    const input = useChatStore((state) => state.input);
    const setInput = useChatStore((state) => state.setInput);
    const isLoading = useChatStore((state) => state.isLoading);
    const isEscalated = useChatStore((state) => state.isEscalated);
    const sendMessage = useChatStore((state) => state.sendMessage);

    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    return (
        <div className="font-body flex h-screen flex-col" style={{ background: "var(--console-bg)" }}>
            <Navbar isEscalated={isEscalated} />

            <ChatContainer messages={messages} isLoading={isLoading} messagesEndRef={messagesEndRef} />

            {isEscalated ? (
                <EscalationBanner />
            ) : (
                <ChatInput input={input} setInput={setInput} sendMessage={sendMessage} isLoading={isLoading} />
            )}
        </div>
    );
}