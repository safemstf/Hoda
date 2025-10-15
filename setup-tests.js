const sanityChecks = [
  "Identify the model currently running.",
  "Confirm that the environment is ready.",
  "Explain how WebGPU helps Llama run in a browser.",
  "Summarize the setup steps in two sentences."
];

const quickResponses = [
  "Say 'Setup complete for CSCE 5430.'",
  "Generate a 1-sentence description of WebLLM.",
  "Provide a short motivational quote."
];

const diagnosticPrompts = [
  "Check memory usage and report values.",
  "List supported models under WebLLM.",
  "Show current browser WebGPU status."
];

const metaInfo = {
  author: "Sumanth Penna",
  course: "CSCE 5430 – Software Engineering",
  version: "1.0",
  description: "Prompts used to verify Llama WebLLM environment and runtime performance."
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { sanityChecks, quickResponses, diagnosticPrompts, metaInfo };
}