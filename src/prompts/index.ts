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

Please help me:
1. Crystallize the core assumption — what must be true for this to work?
2. Break it down into 3-5 testable hypotheses (customer, problem, solution, willingness-to-pay)
3. Define acceptance criteria for each hypothesis
4. Identify the riskiest hypothesis to test first
5. Suggest an ideal customer profile (ICP) to start interviewing

Use the create_project tool to set up the project, then create_hypothesis for each hypothesis, and create_icp for the customer profile.`,
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
