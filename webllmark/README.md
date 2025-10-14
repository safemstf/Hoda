# WebLLM NLP Sandbox

A browser-based sandbox for testing WebLLM's natural language processing capabilities.

## Overview

This sandbox provides a simple interface to test various NLP tasks using WebLLM, including:
- Text translation
- Text summarization
- Sentiment analysis
- Question answering
- Text generation
- General conversation

## Setup

### Prerequisites
- Modern web browser with JavaScript enabled
- Internet connection (for loading WebLLM from CDN)

### Installation
1. Clone or download this repository
2. Navigate to the `sandbox/webllm/` directory
3. Open `index.html` in your web browser

### Local Development
For local development, you can serve the files using a simple HTTP server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx http-server

# Using PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

## Usage

1. **Load the Model**: The page will automatically load the WebLLM model on startup
2. **Enter Commands**: Type your command in the input field
3. **Process**: Click "Process Command" or press Enter
4. **View Results**: See the intent analysis and model response in the output area

## Test Data

The sandbox includes pre-loaded test commands in `test-data.js`:

### Sample Commands
- Translation: "Translate 'Hello' to Spanish"
- Summarization: "Summarize this text about AI"
- Sentiment: "Analyze the sentiment of this message"
- Q&A: "What is the capital of France?"
- Generation: "Write a story about robots"

### Test Scenarios
Organized by intent type for systematic testing:
- `translation`: Language translation examples
- `summarization`: Text summarization tasks
- `sentiment`: Sentiment analysis examples
- `qa`: Question answering prompts
- `generation`: Creative text generation

## Features

### Intent Parsing
The system automatically detects the intent of user commands:
- **translation**: Keywords like "translate", "language"
- **summarization**: Keywords like "summarize", "summary"
- **sentiment_analysis**: Keywords like "sentiment", "feeling"
- **question_answering**: Keywords like "question", "what", "how"
- **text_generation**: Keywords like "generate", "create", "write"
- **general_conversation**: Default fallback

### Model Integration
- Uses WebLLM's Llama-2-7b-chat-hf-q4f16_1 model
- Loads from CDN for easy setup
- Handles model loading states and errors

### User Interface
- Clean, responsive design
- Real-time status updates
- Input validation and error handling
- Command history display

## File Structure

```
sandbox/webllm/
├── index.html          # Main HTML interface
├── main.js             # Core application logic
├── test-data.js        # Sample commands and test scenarios
└── README.md           # This documentation
```

## Configuration

### Model Settings
The model configuration can be modified in `main.js`:

```javascript
// Change model or add additional models
await this.chat.reload("Llama-2-7b-chat-hf-q4f16_1", undefined, {
    "model_list": [
        {
            "model_url": "https://huggingface.co/mlc-ai/Llama-2-7b-chat-hf-q4f16_1/resolve/main/",
            "local_id": "Llama-2-7b-chat-hf-q4f16_1"
        }
    ]
});
```

### Intent Detection
Customize intent parsing in the `parseIntent()` method:

```javascript
parseIntent(userInput) {
    const input = userInput.toLowerCase();
    // Add your custom intent detection logic here
}
```

## Troubleshooting

### Common Issues

1. **Model Loading Fails**
   - Check internet connection
   - Verify WebLLM CDN is accessible
   - Check browser console for errors

2. **Slow Performance**
   - Model loading can take time on first use
   - Consider using a smaller model for testing
   - Check browser memory usage

3. **Input Not Working**
   - Ensure model has finished loading
   - Check browser JavaScript console
   - Verify input field is enabled

### Browser Compatibility
- Chrome/Chromium: Recommended
- Firefox: Supported
- Safari: Supported
- Edge: Supported

## Results and Testing

### Performance Metrics
- Model loading time: ~30-60 seconds (first load)
- Response generation: ~2-10 seconds (depending on complexity)
- Memory usage: ~2-4GB (model dependent)

### Test Results
Document your testing results here:

#### Translation Tests
- [ ] Basic translation commands
- [ ] Multiple language pairs
- [ ] Complex sentence translation

#### Summarization Tests
- [ ] Short text summarization
- [ ] Long document summarization
- [ ] Multi-paragraph content

#### Sentiment Analysis Tests
- [ ] Positive sentiment detection
- [ ] Negative sentiment detection
- [ ] Neutral sentiment detection

#### Question Answering Tests
- [ ] Factual questions
- [ ] Explanatory questions
- [ ] Complex reasoning questions

#### Text Generation Tests
- [ ] Creative writing
- [ ] Technical content
- [ ] Structured output

## Future Enhancements

- [ ] Support for additional models
- [ ] Batch processing capabilities
- [ ] Export results functionality
- [ ] Advanced intent detection
- [ ] Custom prompt templates
- [ ] Performance benchmarking tools

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is part of the WebLLM sprint and follows the same licensing terms.

