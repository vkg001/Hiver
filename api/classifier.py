from langchain_ollama import ChatOllama
from langchain_core.prompts import ChatPromptTemplate

INTENT_LIST = [
    "Network Issue",
    "Billing",
    "Device Upgrade",
    "Cancellation",
    "General Inquiry"
]

class Classifier:
    def __init__(self):
        intent_list_str = ""
        for intent in INTENT_LIST:
            if intent_list_str != "":
                intent_list_str += ", "
                
            intent_list_str += intent
            
            
        self.llm = ChatOllama(model="llama3.1", temperature=0)
        self.intent_prompt = ChatPromptTemplate.from_messages([
                ("system", "Classify the customer message into one of these exact intents: [" + intent_list_str + "]. Return ONLY the intent name."),
                ("human", "{message}")
            ])
        

    def classify_intent(self, user_message: str):
        return (self.intent_prompt | self.llm).invoke({"message": user_message}).content.strip()