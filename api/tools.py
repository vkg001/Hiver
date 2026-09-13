import numpy as np
from sentence_transformers import SentenceTransformer
from langchain_core.tools import StructuredTool

class Tools:
    
    def __init__(self):
        self.whole_embeddings = np.load("./../rag_database.npy", allow_pickle=True)
        self.doc_embeddings = [item['embedding'] for item in self.whole_embeddings]
        self.embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

        self.get_existing_solution = StructuredTool.from_function(
            func=self._get_existing_solution,
            name="get_existing_solution",
            description="Searches the knowledge base for existing solutions. Returns up to 2 chunks with >= 70% similarity to the query."
        )

    def _get_existing_solution(self, query: str) -> str:
        query_embedding = self.embedding_model.encode(query)
        
        norms = np.linalg.norm(self.doc_embeddings, axis=1) * np.linalg.norm(query_embedding)
        similarities = np.dot(self.doc_embeddings, query_embedding) / norms
        
        valid_indices = np.where(similarities >= 0.70)[0]
        
        if len(valid_indices) == 0:
            return ""
        
        sorted_indices = valid_indices[np.argsort(similarities[valid_indices])[::-1]]
        top_2_indices = sorted_indices[:2]
        
        results = [f"- {self.whole_embeddings[i]['text']} (Score: {similarities[i]:.2f})" for i in top_2_indices]
        return "\n".join(results)