const require = createRequire(import.meta.url);
import axios from "axios";
import csvParser from "csv-parser";
import createCsvWriter from "csv-writer";
import dotenv from "dotenv";
import * as fs from "fs";
import { createRequire } from "module";
import path from "path";
import { URL } from "url";
const { parse } = require("node-html-parser");
const natural = require("natural");
const WordTokenizer = natural.WordTokenizer;
const { Configuration, OpenAIApi } = require("openai");

dotenv.config();

const inputText = process.argv[2]; // parse the third command line argument as the question

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const domain = "ai-wiki.fintakers.com";
const fullUrl = "https://ai-wiki.fintakers.com";

class HyperlinkParser {
  constructor() {
    this.hyperlinks = [];
  }

  parse(html) {
    const root = parse(html);
    const anchors = root.querySelectorAll("a");

    anchors.forEach((anchor) => {
      const href = anchor.getAttribute("href");
      if (href) {
        this.hyperlinks.push(href);
      }
    });
  }
}

/**
 * Takes an array of hyperlinks and a domain string as input.
 * Returns an array of filtered and converted URLs.
 * @param {string[]} hyperlinks - The array of hyperlinks.
 * @param {string} domain - The domain string.
 * @returns {string[]} The array of filtered and converted URLs.
 */
function filterAndConvertUrls(hyperlinks, domain) {
  const baseUrl = new URL(
    domain.startsWith("http") ? domain : `https://${domain}`
  );
  return hyperlinks
    .map((url) => {
      try {
        return new URL(url, baseUrl).href;
      } catch {
        return null;
      }
    })
    .filter((url) => url && url.startsWith(baseUrl.href));
}

/**
 * Takes a domain string and a starting URL as input.
 * Returns an object containing crawled URLs and their tokenized contents.
 * @param {string} domain - The domain string.
 * @param {string} startingUrl - The starting URL.
 * @returns {object} The object containing crawled URLs and their tokenized contents.
 */
async function crawlSingleDomain(domain, startingUrl) {
  // Initialize the queue and the set of visited URLs
  const queue = [startingUrl];
  const visitedUrls = new Set([startingUrl]);
  const tokenizedContents = [];

  // Continue crawling until the queue is empty
  while (queue?.length > 0) {
    // Get the next URL from the queue
    const currentUrl = queue.shift();

    console.log("Crawling:", currentUrl);

    try {
      // Fetch the HTML content of the current URL
      let response;
      let htmlContent;
      try {
        response = await axios.get(currentUrl);
        htmlContent = response.data;
      } catch (e) {
        console.error("Error fetching URL:", currentUrl);
        continue;
      }

      if (!htmlContent) continue;

      // Parse the HTML content to extract the hyperlinks
      const parser = new HyperlinkParser();
      parser.parse(htmlContent);

      // Filter and convert the extracted URLs
      const filteredUrls = filterAndConvertUrls(parser.hyperlinks, domain);

      // Add the filtered URLs to the queue and visitedUrls set
      for (const url of filteredUrls) {
        if (!visitedUrls.has(url)) {
          queue.push(url);
          visitedUrls.add(url);
        }
      }

      // Tokenize the content and save it to the tokenizedContents array
      const tokens = await tokenizeContent(htmlContent);
      tokenizedContents.push({ url: currentUrl, tokens });
    } catch (error) {
      console.error("Error while crawling:", currentUrl, error);
    }
  }

  return { urls: visitedUrls, contents: tokenizedContents };
}

/**
 * Takes an HTML content string as input.
 * Returns an array of tokenized words.
 * @param {string} content - The HTML content string.
 * @returns {string[]} The array of tokenized words.
 */
async function tokenizeContent(content) {
  const cleanContent = removeHTMLElementNamesFromString(content);
  const tokenizer = new WordTokenizer();
  const tokens = tokenizer.tokenize(cleanContent);
  return tokens.slice(0, 3000);
}

function removeHTMLElementNamesFromString(stringContent) {
  const regex =
    /\b(div|span|li|a|ul|section|script|footer|body|html|link|img|href|svg|alt|target|js|javascript|lang|head|gtag|meta|charset|utf|woff2|crossorigin|anonymous|link|rel|preload|as|font|href|assets|fonts|Inter|UI|var|woff2|type|font|css|stylesheet|text)\b/g;
  return stringContent.replace(regex, "");
}

/**
 * Takes a set of visited URLs and an output file path as input.
 * Saves the visited URLs to a CSV file.
 * @param {Set<string>} visitedUrls - The set of visited URLs.
 * @param {string} outputPath - The output file path.
 */
async function saveUrlsToCsv(visitedUrls, outputPath) {
  const csvWriter = createCsvWriter.createObjectCsvWriter({
    path: outputPath,
    header: [{ id: "url", title: "URL" }],
  });

  const records = Array.from(visitedUrls).map((url) => ({ url }));
  await csvWriter.writeRecords(records);
  console.log(`URLs saved to ${outputPath}`);
}

/**
 * Takes a set of tokens as input.
 * Returns an array of the most relevant tokens.
 * @param {string[] | string} tokens - The set of tokens.
 * @returns {string[]} The array of the most relevant tokens.
 */
async function getRelevantTokens(tokens) {
  console.log("start getRelevantTokens");
  const tokenString = typeof tokens === "string" ? tokens : tokens.join(" ");
  // Prepare the prompt for OpenAI's Codex
  const promptStart = `Given the following tokenized text, identify the most relevant tokens:\n\n`;
  const promptEnd = `\n\nRelevant tokens:`;

  // calculate the tokens available for the actual content
  const availableTokens = 4096 - promptStart.length - promptEnd.length;
  
  let prompt;
  if (tokenString.length > availableTokens) {
    // cut the string to fit available tokens
    prompt = promptStart + tokenString.slice(0, availableTokens) + promptEnd;
  } else {
    prompt = promptStart + tokenString + promptEnd;
  }

  // Call the OpenAI API
  let response;
  try {
    console.log("initiating openai api call");
    response = await openai.createCompletion({
      model: "text-davinci-003",
      prompt,
      max_tokens: 50,
      n: 1,
      stop: null,
      temperature: 0.8,
    });
  } catch (e) {
    console.error(
      "Error calling OpenAI API getRelevantTokens createCompletion:",
      e?.response?.data?.error
    );
    throw new Error(
      "Error calling OpenAI API getRelevantTokens createCompletion"
    );
  }

  console.log("finished getRelevantTokens");

  // Extract and return the relevant tokens from the response
  const relevantTokensText = response?.data?.choices[0].text.trim();
  const relevantTokens = relevantTokensText.split(" ");
  console.log(relevantTokens);
  return relevantTokens;
}

/**
 * Takes an array of tokenized contents and an output file path as input.
 * Saves the most relevant tokens to a CSV file.
 * @param {object[]} tokenizedContents - The array of tokenized contents.
 * @param {string} outputPath - The output file path.
 */
async function saveRelevantTokensToCsv(tokenizedContents, outputPath) {
  console.log("start saveRelevantTokensToCsv");
  const csvWriter = createCsvWriter.createObjectCsvWriter({
    path: outputPath,
    header: [
      { id: "url", title: "URL" },
      { id: "relevantTokens", title: "Relevant Tokens" },
    ],
  });
  const records = [];

  for (const content of tokenizedContents) {
    const relevantTokens = await getRelevantTokens(content.tokens);
    records.push({
      url: content.url,
      relevantTokens: relevantTokens.join(" "),
    });
  }

  await csvWriter.writeRecords(records);
  console.log(`Relevant tokens saved to ${outputPath}`);
}

/**
 * Takes a set of tokens as input.
 * Returns an array of embeddings.
 * @param {string[]} tokens - The set of tokens.
 * @returns {number[][]} The array of embeddings.
 */
async function getEmbeddings(tokens) {
  console.log("start getEmbeddings");

  let response;
  try {
    console.log("initiating openai api call");
    response = await openai.createEmbedding({
      model: "text-embedding-ada-002",
      input: tokens,
    });
  } catch (e) {
    console.error("Error calling OpenAI API getEmbeddings:", e?.response?.data);
    throw new Error("Error calling OpenAI API getEmbeddings");
  }

  return response.data.data;
}

/**
 * Takes two arrays of numbers as input.
 * Returns the cosine similarity between the two arrays.
 * @param {number[]} a - The first array of numbers.
 * @param {number[]} b - The second array of numbers.
 * @returns {number} The cosine similarity between the two arrays.
 */
function cosineSimilarity(a, b) {
  if (!a || !b) return;
  console.log("start cosineSimilarity", a, b);
  const dotProduct = a.reduce((sum, _, i) => sum + a[i] * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Takes an input text string and crawled data as input.
 * Returns an array of similarity scores along with their corresponding URLs.
 * @param {string} inputText - The input text string.
 * @param {object} crawledData - The crawled data.
 * @returns {object[]} The array of similarity scores along with their corresponding URLs.
 */
async function calculateSimilarityScores(inputText, crawledData) {
  console.log("start calculateSimilarityScores");
  const inputTokens = await tokenizeContent(inputText);
  const inputRelevantTokens = await getRelevantTokens(inputTokens);
  const inputEmbedding = await getEmbeddings(inputRelevantTokens)[0];

  const similarityScores = [];

  for (const { url, tokens } of crawledData.contents) {
    const relevantTokens = await getRelevantTokens(tokens);
    const contentEmbedding = await getEmbeddings(relevantTokens)[0];

    const avgEmbedding = [];
    for (let i = 0; i < inputEmbedding?.length; i++) {
      avgEmbedding[i] = (inputEmbedding[i] + contentEmbedding[i]) / 2;
    }

    const similarityScore =
      cosineSimilarity(inputEmbedding, avgEmbedding) *
      cosineSimilarity(contentEmbedding, avgEmbedding);
    similarityScores.push({ url, similarityScore });
  }

  console.log("finish calculateSimilarityScores");
  return similarityScores;
}

/**
 * Takes an input text string and crawled data as input.
 * Returns a string containing the answer to the input text question.
 * @param {string} inputText - The input text string.
 * @param {object} crawledData - The crawled data.
 * @returns {string} The answer to the input text question.
 */
async function answerQuestion(inputText, crawledData) {
  console.log("start answerQuestion");
  const similarityScores = await calculateSimilarityScores(
    inputText,
    crawledData
  );

  // Sort the similarity scores in descending order
  similarityScores.sort((a, b) => b.similarityScore - a.similarityScore);

  // Get the most relevant URL
  const mostRelevantUrl = similarityScores[0].url;
  console.log("mostRelevantUrl", mostRelevantUrl);

  // Fetch the HTML content of the most relevant URL
  let response;
  let htmlContent;
  try {
    response = await axios.get(mostRelevantUrl);
    htmlContent = response.data;
  } catch (e) {
    console.error("Error fetching URL:", mostRelevantUrl);
    throw new Error("Error fetching URL");
  }
  const strippedContent = stripHtmlTags(htmlContent);

  // Prepare the prompt for OpenAI's Codex
  const promptStart = `Answer the question based on the context below, and if the question can't be answered based on the context, say "I don't know"\n\nContext: ${strippedContent}\n\n---\n\nQuestion: ${inputText}\nAnswer:`;
  const availableTokens = 4096 - promptStart.length;
  
  let prompt;
  if (strippedContent.length > availableTokens) {
    // cut the string to fit available tokens
    prompt = `Answer the question based on the context below, and if the question can't be answered based on the context, say "I don't know"\n\nContext: ${strippedContent.slice(0, availableTokens)}\n\n---\n\nQuestion: ${inputText}\nAnswer:`;
  } else {
    prompt = promptStart;
  }

  // Call the OpenAI API
  let apiResponse;
  try {
    console.log("initiating openai api call");
    apiResponse = await openai.createCompletion({
      model: "text-davinci-003",
      prompt,
      max_tokens: 1000,
      n: 1,
      stop: null,
      temperature: 1.0, //higher temp gives a more creative and diverse output
    });
  } catch (e) {
    console.error(
      "Error calling OpenAI API answerQuestion createCompletion:",
      e.response.data.error
    );
    throw new Error("Error calling OpenAI API answerQuestion createCompletion");
  }

  console.log("finish answerQuestion");
  // Extract and return the answer from the response
  const answer = apiResponse?.data?.choices[0]?.text?.trim();
  return answer;
}


function stripHtmlTags(htmlContent) {
  // Regular expression to match HTML tags and other irrelevant content
  const regex = /(<([^>]+)>|\[.*?\])/gi;

  // Replace all matches with an empty string
  const strippedContent = htmlContent.replace(regex, "");

  // Return the stripped content
  return strippedContent;
}

async function main() {
  console.log(process.env.OPENAI_API_KEY);

  console.log("starting main...");
  let crawledData = { contents: {} };
  const crawledUrlsOutputPath = path.join(process.cwd(), "crawled_urls.csv");
  console.log("crawledUrlsOutputPath", crawledUrlsOutputPath);

  const contentsOutputPath = path.join(process.cwd(), "contents.csv");
  console.log("contentsOutputPath", contentsOutputPath);

  try {
    await fs.accessSync(crawledUrlsOutputPath);
    await fs.accessSync(contentsOutputPath);

    console.log("Using existing CSV files...");

    const urls = new Set();
    await new Promise((resolve) => {
      fs.createReadStream(crawledUrlsOutputPath)
        .pipe(csvParser())
        .on("data", (data) => {
          urls.add(data.url);
        })
        .on("end", () => {
          console.log("Loaded crawled URLs from file.");
          resolve();
        });
    });

    const contents = [];
    await new Promise((resolve) => {
      fs.createReadStream(contentsOutputPath)
        .pipe(csvParser())
        .on("data", (data) => {
          contents.push({
            url: data.URL,
            tokens:
              typeof data.Content === "string"
                ? data.Content
                : data.Content.toString(),
          });
        })
        .on("end", () => {
          console.log("Loaded contents from file.");
          resolve();
        });
    });

    crawledData.contents = contents;
    console.log("finish main...");
  } catch (error) {
    console.log("CSV files not found. Crawling domain...", error);
    crawledData = await crawlSingleDomain(domain, fullUrl);
    await saveUrlsToCsv(crawledData.urls, crawledUrlsOutputPath);

    // Save crawled contents to CSV file
    const csvWriter = createCsvWriter.createObjectCsvWriter({
      path: contentsOutputPath,
      header: [
        { id: "url", title: "URL" },
        { id: "content", title: "Content" },
      ],
    });
    const records = crawledData.contents.map(({ url, tokens }) => ({
      url,
      content: typeof tokens === "string" ? tokens : tokens.join(" "),
    }));
    await csvWriter.writeRecords(records);
    console.log(`Contents saved to ${contentsOutputPath}`);
  }

  const answer = await answerQuestion(inputText, crawledData);
  console.log("Question", inputText);
  console.log("Answer:", answer);
  process.exit(0);
}

main();
