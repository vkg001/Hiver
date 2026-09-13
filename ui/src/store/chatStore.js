import { create } from "zustand";

const BASE_URL = "http://127.0.0.1:5000";

/**
 * Central chat state. Using zustand (rather than a page-local hook) means
 * any component in the tree — a header unread badge, a route guard while
 * escalated, etc. — can read isEscalated/messages without prop drilling.
 */
export const useChatStore = create((set, get) => ({
    messages: [],
    input: "",
    isLoading: false,
    isEscalated: false,

    setInput: (value) => set({ input: value }),

    sendMessage: async (e) => {
        e?.preventDefault?.();
        const { input, isEscalated } = get();
        if (!input.trim() || isEscalated) return;

        const userMessage = input.trim();

        set((state) => ({
            messages: [
                ...state.messages,
                { role: "user", content: userMessage },
                { role: "agent", content: "", action: "", intent: "" },
            ],
            input: "",
            isLoading: true,
        }));

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

                            set((state) => {
                                const messages = [...state.messages];
                                const last = { ...messages[messages.length - 1] };
                                last.content += data.chunk || "";
                                last.action = data.action;
                                last.intent = data.intent;
                                messages[messages.length - 1] = last;
                                return {
                                    messages,
                                    isEscalated: data.action === "ESCALATE" ? true : state.isEscalated,
                                };
                            });
                        }
                    }
                }
            }
        } catch (error) {
            set((state) => ({
                messages: [
                    ...state.messages,
                    {
                        role: "error",
                        content: "Couldn't reach the server. Check that it's running and CORS is enabled.",
                    },
                ],
            }));
        } finally {
            set({ isLoading: false });
        }
    },
}));