import { App, Editor, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, TFile } from "obsidian";

type ChatAppendSettings = {
  openaiApiKey: string;
  model: string;
  promptMode: "inline" | "file";
  inlinePrompt: string;
  promptFilePath: string;   // e.g. "Prompts/chat-append.md"
  addHeader: boolean;
  headerText: string;       // e.g. "## 🤖 ChatGPT"
  maxOutputTokens: number;
};

const DEFAULTS: ChatAppendSettings = {
  openaiApiKey: "",
  model: "gpt-4o-mini",
  promptMode: "inline",
  inlinePrompt: "You are a helpful writing assistant. Improve clarity and structure without changing meaning.",
  promptFilePath: "Prompts/chat-append.md",
  addHeader: true,
  headerText: "## 🤖 ChatGPT Output",
  maxOutputTokens: 800,
};

export default class ChatAppendPlugin extends Plugin {
  settings: ChatAppendSettings;

  async onload() {
    this.settings = Object.assign({}, DEFAULTS, await this.loadData());

    this.addRibbonIcon("stars", "Run prompt on current note", async () => {
      await this.runOnActiveNote();
    });

    this.addCommand({
      id: "chat-append-run",
      name: "Run on current note",
      editorCallback: async (editor: Editor) => {
        await this.runOnActiveNote(editor);
      },
    });

    this.addSettingTab(new ChatAppendSettingTab(this.app, this));
  }

  async runOnActiveNote(editor?: Editor) {
    const file = this.app.workspace.getActiveFile();
    if (!file) { new Notice("No active note"); return; }

    // Read current note content from disk (safer if we’re going to modify). 
    // (If you only display, cachedRead is fine.) :contentReference[oaicite:6]{index=6}
    const original = await this.app.vault.read(file);

    // Resolve prompt (inline or from a file inside the vault)
    let prompt = this.settings.inlinePrompt;
    if (this.settings.promptMode === "file") {
      const promptFile = this.app.vault.getAbstractFileByPath(this.settings.promptFilePath);
      if (promptFile && promptFile instanceof TFile) {
        prompt = await this.app.vault.read(promptFile);
      } else {
        new Notice(`Prompt file not found: ${this.settings.promptFilePath}`);
        return;
      }
    }

    // Call OpenAI Responses API
    if (!this.settings.openaiApiKey) {
      new Notice("Set your OpenAI API key in plugin settings.");
      return;
    }

    let resultText = "";
    try {
      const res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.settings.openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.settings.model,
          input: [
            { role: "system", content: prompt },
            { role: "user", content: original }
          ],
          max_output_tokens: this.settings.maxOutputTokens
        })
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`OpenAI error ${res.status}: ${errBody}`);
      }
      const data = await res.json();

      // Responses API shape: the primary text is usually at data.output_text (helper),
      // or in data.output[0].content[0].text depending on SDK. We fall back safely. :contentReference[oaicite:7]{index=7}
      resultText = data.output_text 
        ?? data?.output?.[0]?.content?.[0]?.text 
        ?? JSON.stringify(data, null, 2);
    } catch (e:any) {
      console.error(e);
      new Notice("OpenAI request failed (see console).");
      return;
    }

    // Prepare appended block
    const block = `${this.settings.addHeader ? `\n\n---\n${this.settings.headerText}\n` : `\n\n---\n`}${resultText}\n`;

    // Prefer Editor API for the active note (guideline). :contentReference[oaicite:8]{index=8}
    const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (editor && mdView && mdView.editor === editor) {
      const lineCount = editor.lineCount();
      editor.replaceRange(block, { line: lineCount, ch: 0 });
    } else {
      // Fallback: append via vault if editor not available
      await this.app.vault.append(file, block);
    }

    new Notice("Appended ChatGPT output.");
  }

  async saveSettings() { await this.saveData(this.settings); }
}

class ChatAppendSettingTab extends PluginSettingTab {
  plugin: ChatAppendPlugin;

  constructor(app: App, plugin: ChatAppendPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Chat Append Settings" });

    new Setting(containerEl)
      .setName("OpenAI API key")
      .setDesc("Stored locally in this vault’s plugin data.json.")
      .addText(t => t
        .setPlaceholder("sk-...")
        .setValue(this.plugin.settings.openaiApiKey)
        .onChange(async (v) => { this.plugin.settings.openaiApiKey = v.trim(); await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName("Model")
      .setDesc("e.g., gpt-4o-mini (Responses API)")
      .addText(t => t
        .setValue(this.plugin.settings.model)
        .onChange(async (v) => { this.plugin.settings.model = v.trim(); await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName("Prompt source")
      .addDropdown(d => d
        .addOption("inline", "Inline")
        .addOption("file", "File in vault")
        .setValue(this.plugin.settings.promptMode)
        .onChange(async (v: "inline" | "file") => { this.plugin.settings.promptMode = v; await this.plugin.saveSettings(); this.display(); }));

    if (this.plugin.settings.promptMode === "inline") {
      new Setting(containerEl)
        .setName("Inline prompt")
        .addTextArea(t => t
          .setValue(this.plugin.settings.inlinePrompt)
          .onChange(async (v) => { this.plugin.settings.inlinePrompt = v; await this.plugin.saveSettings(); }));
    } else {
      new Setting(containerEl)
        .setName("Prompt file path")
        .setDesc("Example: Prompts/chat-append.md")
        .addText(t => t
          .setValue(this.plugin.settings.promptFilePath)
          .onChange(async (v) => { this.plugin.settings.promptFilePath = v.trim(); await this.plugin.saveSettings(); }));
    }

    new Setting(containerEl)
      .setName("Add header before output")
      .addToggle(t => t
        .setValue(this.plugin.settings.addHeader)
        .onChange(async (v) => { this.plugin.settings.addHeader = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName("Header text")
      .addText(t => t
        .setValue(this.plugin.settings.headerText)
        .onChange(async (v) => { this.plugin.settings.headerText = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl)
      .setName("Max output tokens")
      .addText(t => t
        .setValue(String(this.plugin.settings.maxOutputTokens))
        .onChange(async (v) => {
          const n = Number(v); 
          if (!Number.isNaN(n) && n > 0) this.plugin.settings.maxOutputTokens = n;
          await this.plugin.saveSettings();
        }));
  }
}
