// WebLLM NLP Sandbox - Test Data
// Sample user commands for testing different NLP capabilities

const testCommands = [
    // Translation examples
    "Translate 'Hello, how are you?' to Spanish",
    "What does 'Bonjour' mean in English?",
    "Convert 'Guten Tag' to English",
    
    // Summarization examples
    "Summarize this text: 'The quick brown fox jumps over the lazy dog. This is a common pangram used for typing practice.'",
    "Give me a brief summary of machine learning",
    "Summarize the benefits of renewable energy",
    
    // Sentiment analysis examples
    "Analyze the sentiment of: 'I love this new product!'",
    "What's the feeling in this text: 'This is terrible and I hate it'",
    "Check the sentiment of: 'The weather is okay today'",
    
    // Question answering examples
    "What is the capital of France?",
    "How does photosynthesis work?",
    "What are the benefits of exercise?",
    "Explain quantum computing in simple terms",
    
    // Text generation examples
    "Generate a creative story about a robot",
    "Write a poem about nature",
    "Create a product description for a smartphone",
    "Generate ideas for a birthday party",
    
    // General conversation examples
    "Tell me a joke",
    "What's your favorite color?",
    "How can I improve my productivity?",
    "Give me advice for learning programming",
    
    // Complex multi-intent examples
    "Translate and summarize this French text: 'Bonjour, comment allez-vous aujourd'hui?'",
    "Analyze the sentiment and generate a response for: 'I'm feeling stressed about work'",
    "Answer this question and provide additional context: 'What is artificial intelligence?'"
];

// Test scenarios for different use cases
const testScenarios = {
    translation: [
        "Translate 'Good morning' to French",
        "What is 'Hola' in English?",
        "Convert 'Merci beaucoup' to English"
    ],
    
    summarization: [
        "Summarize: 'Artificial intelligence is transforming industries worldwide...'",
        "Give me a brief overview of climate change",
        "Summarize the main points of this article"
    ],
    
    sentiment: [
        "How does this text feel: 'I'm so excited about the new project!'",
        "Analyze sentiment: 'This is the worst day ever'",
        "What's the emotional tone of: 'The movie was okay, nothing special'"
    ],
    
    qa: [
        "What is the speed of light?",
        "How do I bake a chocolate cake?",
        "What are the side effects of this medication?",
        "Explain the theory of relativity"
    ],
    
    generation: [
        "Write a short story about time travel",
        "Generate a marketing slogan for a coffee shop",
        "Create a recipe for chocolate chip cookies",
        "Write a thank you email to a colleague"
    ]
};

// Performance test commands (longer text for stress testing)
const performanceTests = [
    "Summarize this long text: " + "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(20),
    "Analyze the sentiment of this paragraph: " + "This is a test of the emergency broadcast system. ".repeat(15),
    "Translate this document: " + "The quick brown fox jumps over the lazy dog. ".repeat(10)
];

// Export for use in main.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        testCommands,
        testScenarios,
        performanceTests
    };
}

