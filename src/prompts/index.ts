export const mcpPrompts = {
  "start-validation": {
    name: "start-validation",
    description: "Kick off validation — guides founder through idea crystallization and hypothesis generation",
    arguments: [
      {
        name: "idea",
        description: "Brief description of your startup idea",
        required: true,
      },
    ],
    getMessages: (args: { idea: string }) => [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `I want to validate a startup idea: ${args.idea}

IMPORTANT: This is a GUIDED, INTERACTIVE process. Do NOT rush through it. Follow these steps ONE AT A TIME, waiting for my input at each stage:

**Step 1 — Start the validation**
Use validate_idea with my idea. It will return a welcome message and coaching questions. STOP here and present the welcome message and questions to me. Wait for my answers. Do NOT call create_project yet.

**Step 2 — Discuss and crystallize (ONLY after I've answered the Step 1 questions)**
Based on my answers, help me crystallize:
- What's the core assumption that must be true for this to work?
- What are the riskiest unknowns?
Talk this through with me. Share your honest take on the idea. Ask follow-up questions if my answers are vague. Do NOT create hypotheses yet.

**Step 3 — Create the project (ONLY after the Step 2 discussion)**
Once we've discussed the idea thoroughly, use create_project to save the project record.

**Step 4 — Build hypotheses together (ONLY after the project is created)**
Now suggest 3-5 testable hypotheses based on our discussion. Present them to me FIRST for feedback before creating them. I might want to reword them or add/remove some. Once I'm happy, use create_hypothesis for each one, then prioritize_hypotheses to rank them.

**Step 5 — Define the ICP (ONLY after hypotheses are set)**
Based on the hypotheses, suggest an ideal customer profile. Discuss it with me, then use create_icp.

**Step 6 — Plan first outreach**
Suggest next steps for finding people to talk to.

Remember: this is a conversation, not a batch job. Be a coach — explain your thinking, challenge my assumptions, and make sure I'm bought into each step before moving on.`,
        },
      },
    ],
  },

  "prep-for-call": {
    name: "prep-for-call",
    description: "Pre-call coaching for a specific upcoming conversation",
    arguments: [
      {
        name: "projectId",
        description: "Project ID",
        required: true,
      },
      {
        name: "contactId",
        description: "Contact ID for the person you're about to call",
        required: true,
      },
    ],
    getMessages: (args: { projectId: string; contactId: string }) => [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `I have a customer discovery call coming up. Project ID: ${args.projectId}, Contact ID: ${args.contactId}.

Please:
1. Use get_call_principles to remind me of Mom Test rules
2. Use generate_call_guide to create a tailored discussion guide
3. Highlight the top 2-3 things I should focus on learning from this specific person
4. Warn me about common mistakes to avoid with this type of conversation`,
        },
      },
    ],
  },

  "debrief-call": {
    name: "debrief-call",
    description: "Structured post-call insight extraction",
    arguments: [
      {
        name: "projectId",
        description: "Project ID",
        required: true,
      },
      {
        name: "contactId",
        description: "Contact ID for the person you just spoke with",
        required: true,
      },
    ],
    getMessages: (args: { projectId: string; contactId: string }) => [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `I just finished a customer discovery call. Project ID: ${args.projectId}, Contact ID: ${args.contactId}.

Please:
1. Use start_debrief to set up the structured debrief
2. Guide me through capturing insights for each hypothesis we were testing
3. Help me rate the signal strength honestly (push back if I'm being too generous)
4. Use record_insight to save each insight
5. After capturing everything, use update_contact_status to mark this contact as completed`,
        },
      },
    ],
  },

  "weekly-review": {
    name: "weekly-review",
    description: "Synthesize the week's learnings and plan next steps",
    arguments: [
      {
        name: "projectId",
        description: "Project ID",
        required: true,
      },
    ],
    getMessages: (args: { projectId: string }) => [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Time for a weekly review of my validation progress. Project ID: ${args.projectId}.

Please:
1. Use get_progress_report for a summary of where things stand
2. Use get_validation_scorecard to see hypothesis evidence
3. Use synthesize_insights to find patterns across conversations
4. Use suggest_next_steps for what to focus on this coming week
5. Flag anything that concerns you — am I falling into any anti-patterns?`,
        },
      },
    ],
  },

  "pivot-or-persevere": {
    name: "pivot-or-persevere",
    description: "Deep analysis of whether to continue current direction",
    arguments: [
      {
        name: "projectId",
        description: "Project ID",
        required: true,
      },
    ],
    getMessages: (args: { projectId: string }) => [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `I need to make a pivot-or-persevere decision. Project ID: ${args.projectId}.

Please:
1. Use get_validation_scorecard for the full evidence picture
2. Use detect_pivot_signals to analyze the evidence for pivot indicators
3. Use synthesize_insights for the cross-conversation view
4. Give me your honest assessment — should I pivot, persevere, or adjust?
5. If pivoting, suggest what direction the evidence points to
6. If persevering, tell me what evidence would make you more confident`,
        },
      },
    ],
  },
};
