import { useEffect, useRef, useState } from "react";

const BASE_URL = "http://127.0.0.1:5000";

/**
 * Owns the conversation state and the SSE streaming connection to the
 * support-chat backend. Kept separate from Home.jsx so the page component
 * only has to worry about layout, not fetch/stream mechanics.
 */
export function useChat() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isEscalated, setIsEscalated] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || isEscalated) return;

        const userMessage = input.trim();

        setMessages((prev) => [
            ...prev,
            { role: "user", content: userMessage },
            { role: "agent", content: "", action: "", intent: "" },
        ]);
        setInput("");
        setIsLoading(true);

        try {
            const response = await fetch(`${BASE_URL}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: userMessage }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let done = false;

            while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;

                if (value) {
                    const chunkValue = decoder.decode(value, { stream: true });
                    const lines = chunkValue.split("\n");

                    for (const line of lines) {
                        if (line.startsWith("data: ")) {
                            const data = JSON.parse(line.substring(6));

                            setMessages((prev) => {
                                const newMessages = [...prev];
                                const lastMsg = { ...newMessages[newMessages.length - 1] };
                                lastMsg.content += data.chunk || "";
                                lastMsg.action = data.action;
                                lastMsg.intent = data.intent;
                                newMessages[newMessages.length - 1] = lastMsg;
                                return newMessages;
                            });

                            if (data.action === "ESCALATE") {
                                setIsEscalated(true);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            setMessages((prev) => [
                ...prev,
                {
                    role: "error",
                    content: "Couldn't reach the server. Check that it's running and CORS is enabled.",
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return {
        messages,
        input,
        setInput,
        isLoading,
        isEscalated,
        sendMessage,
        messagesEndRef,
    };
}