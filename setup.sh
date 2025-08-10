#!/bin/bash

# AI Website Audit Setup Script

echo "🔧 Setting up AI Website Audit CLI Tool..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    echo "Visit: https://nodejs.org"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check if Ollama is installed and running
if ! command -v ollama &> /dev/null; then
    echo "❌ Ollama is not installed."
    echo "Please install Ollama first: https://ollama.ai"
    echo "Then run: ollama pull gpt-oss:20b"
    exit 1
fi

echo "✅ Ollama detected"

# Check if gpt-oss:20b model is available
echo "🔍 Checking for gpt-oss:20b model..."
if ! ollama list | grep -q "gpt-oss:20b"; then
    echo "📥 Downloading gpt-oss:20b model (this may take a while)..."
    ollama pull gpt-oss:20b
    if [ $? -ne 0 ]; then
        echo "❌ Failed to download gpt-oss:20b model"
        exit 1
    fi
fi

echo "✅ gpt-oss:20b model available"

# Install npm dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed"

# Make the CLI globally accessible
echo "🔗 Setting up global CLI access..."
npm link

if [ $? -eq 0 ]; then
    echo "✅ CLI tool installed globally as 'ai-audit'"
else
    echo "⚠️  Global install failed. You can still run the tool with: npm start"
fi

# Create example output directory
mkdir -p ./example_output

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📖 Usage examples:"
echo "  ai-audit https://example.com --context 'A portfolio website' --category 'Portfolio'"
echo "  ai-audit https://blog.example.com --category 'Blog' --max-depth 3 --output ./my_audit"
echo ""
echo "📋 Available options:"
echo "  -c, --context <context>     Site description for AI analysis"
echo "  -cat, --category <category> Site category (Blog, SaaS, eCommerce, etc.)"
echo "  -d, --max-depth <depth>     Maximum crawl depth (default: 5)"
echo "  -o, --output <path>         Output directory (default: ./audit_results)"
echo "  -e, --exclude <patterns>    URL patterns to exclude"
echo "  --max-pages <number>        Maximum pages to audit (default: 50)"
echo "  --no-screenshots            Skip taking screenshots"
echo "  --no-archive                Skip creating offline archive"
echo ""
echo "🚀 Ready to audit websites!"
