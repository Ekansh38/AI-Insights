import {
  App, Editor, MarkdownView, Notice, Plugin,
  PluginSettingTab, Setting, TFile, setIcon
} from "obsidian";

/** ---- Models you expose in the dropdown ---- */
const KNOWN_MODELS = [
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4.1-mini",
  "gpt-4.1",
  "o3-mini",
  "Custom…" // special option
] as const;

type PromptMode = "inline" | "file";

type ChatAppendSettings = {
  openaiApiKey: string;
  /** Either one of KNOWN_MODELS (except Custom…) or a custom string saved separately */
  model: string;
  /** If user picked Custom…, we store their custom value here */
  customModel: string;
  promptMode: PromptMode;
  inlinePrompt: string;
  promptFilePath: string;
  addHeader: boolean;
  headerText: string;
  maxOutputTokens: number;
};

const DEFAULT_PROMPT =
`Your job is to provide, other questions, insights and other simmilar topics to explore or things to think about, basiclly identify gaps of understanding in the note.`;

const DEFAULTS: ChatAppendSettings = {
  openaiApiKey: "",
  model: "gpt-4o-mini",
  customModel: "",
  promptMode: "inline",
  inlinePrompt: DEFAULT_PROMPT,
  promptFilePath: "Prompts/prompt.md",
  addHeader: true,
  headerText: "## Insights",
  maxOutputTokens: 800,
};

export default class ChatAppendPlugin extends Plugin {
  settings: ChatAppendSettings;

  private ribbonEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private isRunning = false;

  async onload() {
    // tiny CSS for spinner animation
    const style = document.createElement("style");
    style.textContent = `
      .chat-append-spin { animation: chat-append-rot 1s linear infinite; }
      @keyframes chat-append-rot { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
    this.register(() => style.remove());

    this.settings = Object.assign({}, DEFAULTS, await this.loadData());

    // Ribbon button with re-entry guard
    this.ribbonEl = this.addRibbonIcon("stars", "Run prompt on current note", async () => {
      if (this.isRunning) { new Notice("Already running…"); return; }
      await this.runOnActiveNote();
    });

    // Status bar
    this.statusEl = this.addStatusBarItem();
    this.statusEl.setText("Chat Append: idle");

    // Command (hotkey-able) with re-entry guard
    this.addCommand({
      id: "chat-append-run",
      name: "Run on current note",
      editorCallback: async (editor: Editor) => {
        if (this.isRunning) { new Notice("Already running…"); return; }
        await this.runOnActiveNote(editor);
      },
    });

    this.addSettingTab(new ChatAppendSettingTab(this.app, this));
  }

  private resolveModel() {
    return this.settings.model === "Custom…" && this.settings.customModel.trim().length > 0
      ? this.settings.customModel.trim()
      : this.settings.model;
  }

  private setLoading(loading: boolean) {
    this.isRunning = loading;
    if (this.ribbonEl) {
      if (loading) {
        setIcon(this.ribbonEl, "loader-2");   // built-in lucide icon
        this.ribbonEl.addClass("chat-append-spin");
        this.statusEl?.setText("Chat Append: Running prompt…");
      } else {
        this.ribbonEl.removeClass("chat-append-spin");
        setIcon(this.ribbonEl, "stars");
        this.statusEl?.setText("Chat Append: idle");
      }
    }
  }

  async runOnActiveNote(editor?: Editor) {
    const file = this.app.workspace.getActiveFile();
    if (!file) { new Notice("No active note"); return; }

    this.setLoading(true);

    try {
      const original = await this.app.vault.read(file);

      // Resolve prompt (inline or from a file inside the vault)
      let prompt = this.settings.inlinePrompt;
      if (this.settings.promptMode === "file") {
        const promptFile = this.app.vault.getAbstractFileByPath(this.settings.promptFilePath);
        if (promptFile && promptFile instanceof TFile) {
          prompt = await this.app.vault.read(promptFile);
        } else {
          new Notice(`Prompt file not found: ${this.settings.promptFilePath}`);
          this.statusEl?.setText("Chat Append: error (prompt file)");
          return;
        }
      }

      if (!this.settings.openaiApiKey) {
        new Notice("Set your OpenAI API key in plugin settings.");
        this.statusEl?.setText("Chat Append: error (no API key)");
        return;
      }

      const model = this.resolveModel();
      if (!model) {
        new Notice("Select a model (or enter a custom model).");
        this.statusEl?.setText("Chat Append: error (no model)");
        return;
      }

      // Call OpenAI Responses API
      let resultText = "";
      const res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.settings.openaiApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: [
            { role: "system", content: prompt },
            { role: "user", content: original }
          ],
          max_output_tokens: this.settings.maxOutputTokens
        })
      });

      if (!res.ok) {
        const errBody = await res.text();
        this.statusEl?.setText("Chat Append: error (request)");
        throw new Error(`OpenAI error ${res.status}: ${errBody}`);
      }

      const data = await res.json();
      resultText = data.output_text
        ?? data?.output?.[0]?.content?.[0]?.text
        ?? JSON.stringify(data, null, 2);

      // Build appended block — no '---' separator, just optional header
      const block = this.settings.addHeader
        ? `\n\n${this.settings.headerText}\n${resultText}\n`
        : `\n\n${resultText}\n`;

      // Prefer Editor API when possible
      const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (editor && mdView && mdView.editor === editor) {
        const lineCount = editor.lineCount();
        editor.replaceRange(block, { line: lineCount, ch: 0 });
      } else {
        await this.app.vault.append(file, block);
      }

      new Notice("Appended ChatGPT output.");
      this.statusEl?.setText("Chat Append: done ✔");
      window.setTimeout(() => this.statusEl?.setText("Chat Append: idle"), 2000);
    } catch (e) {
      console.error(e);
      new Notice("OpenAI request failed (see console).");
      this.statusEl?.setText("Chat Append: error (see console)");
    } finally {
      this.setLoading(false);
    }
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

    // Model dropdown + custom
    new Setting(containerEl)
      .setName("Model")
      .setDesc("Choose a model or pick Custom… to enter your own.")
      .addDropdown(d => {
        KNOWN_MODELS.forEach(m => d.addOption(m, m));
        d.setValue(this.plugin.settings.model)
          .onChange(async (v) => {
            this.plugin.settings.model = v;
            if (v !== "Custom…") {
              // Clear custom model if switching away
              this.plugin.settings.customModel = "";
            }
            await this.plugin.saveSettings();
            this.display();
          });
      });

    if (this.plugin.settings.model === "Custom…") {
      new Setting(containerEl)
        .setName("Custom model id")
        .setDesc("Type the exact model id (e.g., my-finetune-2025-10-01).")
        .addText(t => t
          .setValue(this.plugin.settings.customModel)
          .onChange(async (v) => { this.plugin.settings.customModel = v.trim(); await this.plugin.saveSettings(); }));
    }

    // Prompt mode
    new Setting(containerEl)
      .setName("Prompt source")
      .setDesc("Inline = edit here. File = read from a note in your vault.")
      .addDropdown(d => d
        .addOption("inline", "Inline")
        .addOption("file", "File in vault")
        .setValue(this.plugin.settings.promptMode)
        .onChange(async (v: PromptMode) => { this.plugin.settings.promptMode = v; await this.plugin.saveSettings(); this.display(); }));

    if (this.plugin.settings.promptMode === "inline") {
      new Setting(containerEl)
        .setName("Inline prompt")
        .addTextArea(t => t
          .setValue(this.plugin.settings.inlinePrompt)
          .onChange(async (v) => { this.plugin.settings.inlinePrompt = v; await this.plugin.saveSettings(); }))
        .addExtraButton(btn => btn
          .setIcon("rotate-ccw")
          .setTooltip("Reset to default prompt")
          .onClick(async () => {
            this.plugin.settings.inlinePrompt = DEFAULT_PROMPT;
            await this.plugin.saveSettings();
            this.display();
            new Notice("Prompt reset to default.");
          }));
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
