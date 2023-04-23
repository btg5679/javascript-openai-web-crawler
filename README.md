# AI-powered Web Crawler & Content-based Q&A System using OpenAI

This repository contains a JavaScript script that crawls any domain and uses OpenAI API's to answer questions based on the crawled content. The script utilizes OpenAI's Codex and Embedding models to analyze the text, identify relevant tokens, and calculate similarity scores to answer user's questions.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Usage](#usage)
- [Example Questions](#example-questions)
- [APIs & Tools Used](#apis-and-tools-used)
- [Embeddings Database](#embeddings-database)
- [Limitations and Next Steps](#limitations-and-next-steps)

## Features

- Crawl a domain and save the URLs and contents to CSV files
- Tokenize the crawled content
- Use OpenAI API's to identify relevant tokens
- Calculate similarity scores between the crawled content and user input
- Answer questions based on the crawled content

## Prerequisites

- Node.js
- Access to OpenAI API

## Usage

1. Clone the repository
2. Install dependencies using `npm install`
3. Set your OpenAI API key in a `.env` file - `OPENAI_API_KEY=123456`
4. Set your target url in index.js: `const domain = "openai.com";`
5. Run the script with a question as a command line argument, like this:

```sh
node index.js "What is ChatGPT?"
```

## Example Questions/Responses

Here are some example questions you can try asking the script:

```sh
- What day is it?
- What is the newest OpenAI embeddings model?
- What is ChatGPT?
```

The responses will looks something like the following:

```sh
"I don't know."

'The newest embeddings model is text-embedding-ada-002.'

'ChatGPT is a model trained to interact in a conversational way. It is able to answer followup questions, admit its mistakes, challenge incorrect premises, and reject inappropriate requests.'
```

## APIs and Tools Used

This script uses the following OpenAI API's:

- Codex: A powerful language model that can be used to generate relevant tokens, tokenize content, and answer questions based on crawled content.
- Embedding Models: Used to calculate similarity scores between the crawled content and user input.

The script is written in JavaScript and uses the axios, csv-writer, csv-parser, dotenv, and node-html-parser libraries.

## Embeddings Database

In the current version of the script, embeddings are written to a CSV file. However, for a more functional application, it would be better to store embeddings in an embeddings database like Pinecone.

Pinecone is a vector database service that allows you to efficiently store and search high-dimensional vectors. By storing embeddings in Pinecone, you can perform fast similarity searches and retrieve results based on their similarity to a given input vector. This can help improve the performance of the script when answering questions based on the crawled content.

## Limitations and Next Steps

### Limitations

1. The script is not optimized for large-scale crawling, which might cause memory issues or take a significant amount of time to complete.
2. The script currently only supports single-domain crawling.
3. Error handling could be improved for better robustness.
4. Tokenization of the content might not be accurate for languages other than English.
5. The script has a hard-coded limit of 3000 tokens for each page, which might cause loss of information for longer pages.
6. The cosine similarity calculation might not be the most effective method to compare embeddings.
7. The script relies on OpenAI's API for token relevance, embeddings, and answering questions, which might lead to potential inaccuracies or limitations depending on the API's performance.

### Next Steps

1. Optimize the script for large-scale crawling by implementing parallel crawling, distributed crawling, or using a more efficient data structure for visited URLs.
2. Extend the script to support multi-domain crawling.
3. Improve error handling for network errors, API errors, and other issues that might arise during crawling and processing.
4. Implement language-specific tokenization to support more languages.
5. Allow the user to configure the token limit per page or implement a more adaptive token limit based on the content size.
6. Add an integration to an embeddings db to improve efficiency.
7. Continuously update the script with improvements in OpenAI's API or consider alternative APIs or methods for token relevance, embeddings, and question answering.
