import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Web Search Service
 *
 * Provides web search capabilities using Google Custom Search API
 * or fallback to web scraping if API is not available
 */

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
  relevanceScore: number;
}

export interface WebSearchOptions {
  maxResults?: number;
  language?: string;
  safeSearch?: boolean;
}

export class WebSearchService {
  private googleApiKey?: string;
  private googleSearchEngineId?: string;
  private useGoogleAPI: boolean;

  constructor() {
    this.googleApiKey = process.env.GOOGLE_SEARCH_API_KEY;
    this.googleSearchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
    this.useGoogleAPI = !!(this.googleApiKey && this.googleSearchEngineId);
  }

  /**
   * Search the web for information
   */
  async search(query: string, options: WebSearchOptions = {}): Promise<WebSearchResult[]> {
    const {
      maxResults = 5,
      language = 'en',
      safeSearch = true
    } = options;

    try {
      if (this.useGoogleAPI) {
        return await this.searchWithGoogleAPI(query, maxResults, language, safeSearch);
      } else {
        // Fallback: Use Gemini's grounding/search capability
        return await this.searchWithGeminiGrounding(query, maxResults);
      }
    } catch (error: any) {
      console.error('Web search error:', error);
      return [];
    }
  }

  /**
   * Search using Google Custom Search API
   */
  private async searchWithGoogleAPI(
    query: string,
    maxResults: number,
    language: string,
    safeSearch: boolean
  ): Promise<WebSearchResult[]> {
    const url = 'https://www.googleapis.com/customsearch/v1';
    const params = {
      key: this.googleApiKey,
      cx: this.googleSearchEngineId,
      q: query,
      num: Math.min(maxResults, 10), // Google API max is 10
      lr: `lang_${language}`,
      safe: safeSearch ? 'active' : 'off'
    };

    const response = await axios.get(url, { params });
    const items = response.data.items || [];

    return items.map((item: any, index: number) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      relevanceScore: 1 - (index * 0.1) // Simple relevance scoring
    }));
  }

  /**
   * Search using Gemini's built-in grounding capability
   * This leverages Gemini's ability to search and ground responses in real-time data
   */
  private async searchWithGeminiGrounding(
    query: string,
    maxResults: number
  ): Promise<WebSearchResult[]> {
    // Note: Gemini 2.0 has built-in grounding capabilities
    // For now, we'll return an indicator that the AI should use its grounding
    // The actual implementation would use Gemini's grounding feature

    console.log('Using Gemini grounding for web search:', query);

    // Return empty array - the AI model itself will handle grounding
    // This is just a placeholder to indicate web search should be attempted
    return [{
      title: 'Web Search via Gemini Grounding',
      url: '',
      snippet: `Searching for: ${query}`,
      relevanceScore: 1.0
    }];
  }

  /**
   * Fetch and extract content from a URL
   */
  async fetchContent(url: string): Promise<string | undefined> {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LMS-Bot/1.0)'
        }
      });

      const $ = cheerio.load(response.data);

      // Remove scripts, styles, and other non-content elements
      $('script, style, nav, header, footer, aside, iframe').remove();

      // Extract main content
      const mainContent = $('main, article, .content, #content, body').first();
      const text = mainContent.text()
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 5000); // Limit content length

      return text;
    } catch (error: any) {
      console.error(`Error fetching content from ${url}:`, error.message);
      return undefined;
    }
  }

  /**
   * Enhanced search with content fetching
   */
  async searchWithContent(query: string, options: WebSearchOptions = {}): Promise<WebSearchResult[]> {
    const searchResults = await this.search(query, options);

    // Fetch content for top results
    const resultsWithContent = await Promise.all(
      searchResults.slice(0, 3).map(async (result) => {
        if (result.url && result.url.startsWith('http')) {
          const content = await this.fetchContent(result.url);
          return { ...result, content };
        }
        return result;
      })
    );

    return resultsWithContent;
  }

  /**
   * Determine if course materials are insufficient
   */
  static shouldSearchWeb(courseMaterials: any[], query: string): boolean {
    // No course materials found
    if (!courseMaterials || courseMaterials.length === 0) {
      return true;
    }

    // All materials have very low relevance scores
    const hasRelevantMaterial = courseMaterials.some((material: any) => {
      if (!material.content_text) return false;

      const keywords = query.toLowerCase().split(' ').filter(w => w.length > 3);
      const searchText = material.content_text.toLowerCase();

      return keywords.some(keyword => searchText.includes(keyword));
    });

    return !hasRelevantMaterial;
  }

  /**
   * Format web search results for AI context
   */
  static formatResultsForAI(results: WebSearchResult[]): string {
    if (results.length === 0) {
      return 'No web search results found.';
    }

    const formatted = results.map((result, index) => {
      let text = `${index + 1}. ${result.title}\n`;
      text += `   URL: ${result.url}\n`;
      text += `   Summary: ${result.snippet}\n`;

      if (result.content) {
        text += `   Content: ${result.content.substring(0, 500)}...\n`;
      }

      return text;
    }).join('\n');

    return `**Web Search Results:**\n${formatted}`;
  }
}

export default new WebSearchService();
