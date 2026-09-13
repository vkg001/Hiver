import json
from langchain_ollama import ChatOllama
from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from langchain_core.chat_history import InMemoryChatMessageHistory
from classifier import Classifier
from tools import Tools

CHURN_KEYWORDS = ["cancel", "switch", "horrible", "worst", "lawyer", "attorney", "rip off"]
SYSTEM_PROMPT = """
You are a helpful customer support agent for SprintCare. Draft a short, polite Twitter reply grounded strictly in the provided historical chunks.
"""

class CustomerCareAgent:
    def __init__(self):
        self.llm = ChatOllama(model="llama3.1", temperature=0)
        self.tools = Tools()
        self.llm_with_tools = self.llm.bind_tools([self.tools.get_existing_solution])
        self.memory = InMemoryChatMessageHistory()
        self.memory.add_message(SystemMessage(content=SYSTEM_PROMPT))

    def _trim_memory(self):
        # Keep the system prompt alive at index 0, ditch the oldest messages to avoid blowing up context limits
        if len(self.memory.messages) > 100:
            self.memory.messages = [self.memory.messages[0]] + self.memory.messages[-99:]

    def run_agent_stream(self, user_message: str):
        classifier = Classifier()
        intent_res = classifier.classify_intent(user_message=user_message) 
        
        if any(word in user_message.lower() for word in CHURN_KEYWORDS) or intent_res == "Cancellation":
            # No point computing further, yield immediately and kill the stream
            yield f"data: {json.dumps({'intent': intent_res, 'action': 'ESCALATE', 'chunk': 'We hate to see you go and want to make this right. I am escalating your case to a senior supervisor who will reach out shortly.'})}\n\n"
            return

        self.memory.add_message(HumanMessage(content=user_message))
        self._trim_memory()

        response = self.llm_with_tools.invoke(self.memory.messages)
        self.memory.add_message(response)

        if response.tool_calls:
            for tool_call in response.tool_calls:
                if tool_call["name"] == "get_existing_solution":
                    tool_result = self.tools.get_existing_solution.invoke(tool_call["args"])
                    
                    tool_msg = ToolMessage(
                        content=str(tool_result),
                        tool_call_id=tool_call["id"]
                    )
                    self.memory.add_message(tool_msg)
            
            self._trim_memory()
            
            full_reply = ""
            for chunk in self.llm_with_tools.stream(self.memory.messages):
                full_reply += chunk.content
                # Stream out chunk by chunk via SSE
                yield f"data: {json.dumps({'intent': intent_res, 'action': 'AUTO_HANDLE', 'chunk': chunk.content})}\n\n"
            
            self.memory.add_message(full_reply)
        else:
            # Model didn't use tools, so the text is already fully generated from the invoke call
            yield f"data: {json.dumps({'intent': intent_res, 'action': 'AUTO_HANDLE', 'chunk': response.content.strip()})}\n\n"