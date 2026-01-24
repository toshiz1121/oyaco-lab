# Agent Architecture Design (Completed)

Status: ✅ Completed
Date: 2026-01-24

This architecture has been implemented in `src/lib/agents/` and `src/components/AgentChatInterface.tsx`.

---

## Sequence Diagram: User Interaction Flow

```mermaid
sequenceDiagram
    participant User as Child (User)
    participant UI as Chat Interface
    participant Orch as Orchestrator Agent
    participant Expert as Expert Agent (e.g. Scientist)
    participant History as History Storage
    participant Parent as Parent Dashboard

    User->>UI: Asks "Why is the sky blue?"
    UI->>Orch: decideAgent("Why is the sky blue?")
    Orch-->>UI: Returns "scientist"
    
    UI->>Expert: generateResponse("Why is the sky blue?", style="metaphor")
    Expert-->>UI: Returns Text Answer
    
    par Generate Multimedia
        UI->>Expert: generateIllustrationPrompt()
        Expert->>UI: Image Prompt
        UI->>Expert: generateIllustration()
        Expert-->>UI: Image URL
    and Text to Speech
        UI->>UI: Text to Speech
    end

    UI->>History: Save Chat Log (Question, Answer, Agent, Topic)
    
    UI-->>User: Display Answer + Image + Audio

    Note over Parent, History: Later
    Parent->>History: Fetch Chat Logs
    History-->>Parent: Logs
    Parent->>Parent: View Learning Report
```

## Data Model: Chat History

To support "Parent Reporting" feature, we need a dedicated Chat Log storage separate from Image Generation History.

```mermaid
classDiagram
    class ChatSession {
        id: string
        startTime: number
        userId: string
    }

    class ChatMessage {
        id: string
        sessionId: string
        timestamp: number
        role: "user" | "assistant"
        content: string
        agentId: string
        contentType: "text" | "image" | "audio"
        metadata: object
    }
    
    class LearningTopic {
        id: string
        name: string
        category: "science" | "biology" | "history" | "art"
        relatedMessages: string[]
    }

    ChatSession "1" -- "*" ChatMessage : contains
    ChatMessage "*" -- "1" LearningTopic : relates to
```
