from flask import Flask, Response, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=["http://localhost:3003"])

@app.route("/health")
def health():
    return "ok"

@app.route("/chat", methods=['POST'])
def chat():
    request_body = request.get_json()
    message = request_body['message']
    
    from customer_care_agent import CustomerCareAgent
    agent = CustomerCareAgent()
    
    # Return as an SSE stream instead of waiting for full execution
    return Response(agent.run_agent_stream(user_message=message), mimetype='text/event-stream')

if __name__ == "__main__":
    app.run()