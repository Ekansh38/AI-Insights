# AI Insights

An Obsidian plugin that generates insights and questions for your notes using OpenAI's language models.

## Installation

Clone this repository into your vault's plugins folder:

```bash
cd /path/to/your/vault/.obsidian/plugins
git clone https://github.com/Ekansh38/AI-Insights ai-insights
cd ai-insights
npm install
npm run build
```

Then enable the plugin in Obsidian's Community Plugins settings.

## Setup

1. Get an OpenAI API key from [OpenAI's platform](https://platform.openai.com/api-keys)
2. Go to Settings → Community Plugins → AI Insights
3. Enter your API key

## Usage

- Click the ⭐ ribbon icon to generate insights for the current note
- Click the 🧹 eraser icon to delete insights from the current note
- Use Command Palette: "AI Insights: Run on current note"

## Settings

- **OpenAI API Key**: Your API key (stored locally)
- **Model**: Choose from gpt-4o-mini, gpt-4o, o3-mini, or custom
- **Prompt**: Use inline prompt or external file
- **Header**: Customize the insights header text

### Models Supported

- **gpt-4o-mini** - Fast and cost-effective (recommended)
- **gpt-4o** - Most capable model
- **gpt-4.1-mini** - Updated mini model
- **gpt-4.1** - Updated full model  
- **o3-mini** - Reasoning-focused model
- **Custom** - Enter any OpenAI model ID

### Prompt Modes

**Inline Mode** (Default)
- Edit prompts directly in the settings
- Includes a thoughtful default prompt optimized for Zettelkasten workflows
- Reset to default anytime with the reset button

**File Mode**
- Store prompts as notes in your vault
- Perfect for sharing prompts or version control
- Default path: `Prompts/prompt.md`

## 🧠 Default Prompt

The plugin comes with an intelligent default prompt designed for knowledge workers and Zettelkasten practitioners:


### Workflow Integration

1. **Daily Review**: Run insights on your daily notes to identify patterns
2. **Literature Processing**: Use on book notes to extract atomic concepts
3. **Project Planning**: Generate follow-up questions for project notes
4. **Knowledge Gaps**: Identify missing connections in your knowledge base
6. **Research Direction**: Use generated questions as starting points for new notes and deeper exploration
7. **Note Network Growth**: Follow connection suggestions to build interconnected clusters of related concepts


## 🔒 Privacy & Security

- **Local Storage**: API keys stored locally in your vault's plugin data
- **No Telemetry**: No usage tracking or data collection
- **OpenAI Only**: Content sent only to OpenAI's API (respects their privacy policy)
- **Manual Control**: You control when and what content is processed

## 🚨 Troubleshooting

**Plugin won't load:**
- Ensure `main.js` and `manifest.json` are in the plugin folder
- Check that the plugin is enabled in Community Plugins settings

**API errors:**
- Verify your OpenAI API key is correct and has credits
- Check the status bar for specific error messages
- Look at the developer console (Ctrl/Cmd + Shift + I) for detailed errors

**No insights generated:**
- Ensure your note has content
- Check that the selected model is available
- Verify prompt file exists (if using file mode)

**Insights deleted accidentally:**
- Use Obsidian's built-in version history or backups
- The delete function only removes content after the configured header


## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built for the [Obsidian](https://obsidian.md) community
- Powered by [OpenAI](https://openai.com) language models
- Inspired by Zettelkasten methodology and knowledge management best practices

---

**Made with ❤️ by [Byte Colony](https://github.com/Ekansh38)**

*If you find this plugin helpful, consider [supporting its development](https://github.com/Ekansh38/AI-Insights)!*

