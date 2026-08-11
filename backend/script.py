from transformers import AutoModelForSequenceClassification, AutoTokenizer, pipeline

# Load the model and tokenizer (they will be loaded from your local cache)
model_name = "Qwen/Qwen3-Embedding-8B"  # Or the repo_id of your downloaded model
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSequenceClassification.from_pretrained(model_name)

# Example: Using a pipeline for inference
classifier = pipeline("sentiment-analysis", model=model, tokenizer=tokenizer)
result = classifier("I love using Hugging Face models!")
print(result)
