// Fixed, deterministic definitions for the lawn preference questions the chat
// widget renders as tappable buttons. Shared by the API route (which picks
// WHICH to ask via the ask_preferences tool) and the client (which renders the
// full set instantly for product-picking suggestion chips, with no API call).
// Option `value` is the text sent back as the visitor's reply when tapped.

export type PreferenceQuestion = {
  key: string;
  question: string;
  options: { label: string; value: string }[];
};

export const PREFERENCE_QUESTIONS: Record<string, PreferenceQuestion> = {
  sun: {
    key: "sun",
    question: "How much sun does the area get?",
    options: [
      { label: "Full sun", value: "Full sun" },
      { label: "Mostly shade", value: "Mostly shade" },
      { label: "Not sure", value: "Not sure about sun" },
    ],
  },
  traffic: {
    key: "traffic",
    question: "How much foot traffic?",
    options: [
      { label: "High traffic", value: "High foot traffic" },
      { label: "Low traffic", value: "Low foot traffic" },
      { label: "Not sure", value: "Not sure about traffic" },
    ],
  },
  maintenance: {
    key: "maintenance",
    question: "What matters more?",
    options: [
      { label: "Low maintenance", value: "Low maintenance" },
      { label: "Best appearance", value: "Best-looking lawn possible" },
      { label: "Not sure", value: "Not sure about upkeep" },
    ],
  },
  goal: {
    key: "goal",
    question: "What's the project?",
    options: [
      { label: "Brand-new lawn", value: "Starting a brand-new lawn" },
      { label: "Patch bare spots", value: "Patching bare spots" },
      { label: "Not sure", value: "Not sure about the goal yet" },
    ],
  },
  // Decides sod vs seed: sod is an instant finished lawn at higher cost, seed
  // is cheaper but takes weeks to establish.
  timeline: {
    key: "timeline",
    question: "How soon do you need a finished lawn?",
    options: [
      { label: "Right away", value: "I want a finished lawn right away" },
      {
        label: "Happy to wait",
        value: "I'm happy to wait a few weeks for it to grow in",
      },
      { label: "Not sure", value: "Not sure about timing" },
    ],
  },
};

// The full question set the widget asks for any product recommendation, in
// display order. Timeline is included because sod vs seed is a live choice for
// every purchase, not just the "sod vs seed" prompt.
export const ALL_PREFERENCE_QUESTIONS: PreferenceQuestion[] = [
  PREFERENCE_QUESTIONS.sun,
  PREFERENCE_QUESTIONS.traffic,
  PREFERENCE_QUESTIONS.maintenance,
  PREFERENCE_QUESTIONS.goal,
  PREFERENCE_QUESTIONS.timeline,
];
