// Quick debug script to test AI analysis locally
const AiAnalyzer = require('./src/modules/aiAnalyzer');

async function testAI() {
  try {
    const aiAnalyzer = new AiAnalyzer({
      aiProvider: 'ollama',
      category: 'Educational',
      context: 'Simple test website'
    });

    // Create fake page data for testing
    const pageData = {
      url: 'https://example.com',
      title: 'Example Domain',
      textContent: 'This is an example website with some sample content for testing. It provides information about domain usage and examples. The content is educational and focuses on web development examples.',
      html: '<html><body><h1>Example Domain</h1><p>This is an example website with some sample content.</p></body></html>'
    };

    const fakeResults = {
      accessibilityResults: { violations: [] },
      seoResults: { score: 75, issues: [] },
      linkResults: { links: [] },
      performanceResults: { score: 85 }
    };

    console.log('Testing full AI analysis with fixes...');
    const result = await aiAnalyzer.analyzePageModular(pageData, fakeResults);
    
    console.log('AI Analysis Result:');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testAI();
