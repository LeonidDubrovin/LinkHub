import fs from "fs";
import path from "path";

export function getConfigPath() {
  const exeDir = process.env.PORTABLE_EXECUTABLE_DIR || process.cwd();
  return path.join(exeDir, "linkhub.config.json");
}

export function getConfig() {
  const configPath = getConfigPath();
  let config: any = {};

  if (fs.existsSync(configPath)) {
    try {
      const data = fs.readFileSync(configPath, "utf-8");
      config = JSON.parse(data);
    } catch (e) {
      console.error("Failed to read config:", e);
    }
  }

  // Backward compatibility: migrate old flat LLM fields to nested structure
  if (config.llmProvider !== undefined) {
    config.llm = {
      enabled: config.llmProvider !== 'none',
      provider: config.llmProvider || 'openrouter',
      apiKey: config.llmApiKey || '',
      model: config.llmModel || 'stepfun/step-3.5-flash:free',
      autoCategorizeOnAdd: true,
      fallbackToLocal: true
    };
    // Remove old fields to avoid confusion
    delete config.llmProvider;
    delete config.llmApiKey;
    delete config.llmModel;
    delete config.llmEndpoint;
  }

  // Set defaults for nested llm if missing
  if (!config.llm) {
    config.llm = {
      enabled: false,
      provider: 'openrouter',
      apiKey: '',
      model: 'stepfun/step-3.5-flash:free',
      autoCategorizeOnAdd: true,
      fallbackToLocal: true
    };
  } else {
    // Ensure all llm fields exist
    config.llm = {
      enabled: config.llm.enabled ?? false,
      provider: config.llm.provider ?? 'openrouter',
      apiKey: config.llm.apiKey ?? '',
      model: config.llm.model ?? 'stepfun/step-3.5-flash:free',
      autoCategorizeOnAdd: config.llm.autoCategorizeOnAdd ?? true,
      fallbackToLocal: config.llm.fallbackToLocal ?? true
    };
  }

  // Set defaults for localHeuristics if missing
  if (!config.localHeuristics) {
    config.localHeuristics = {
      enabled: true,
      domainCategoryRules: {
        "youtube.com": "Videos",
        "youtu.be": "Videos",
        "github.com": "Programming",
        "npmjs.com": "Programming",
        "dribbble.com": "Design",
        "behance.com": "Design"
      }
    };
  } else {
    // Ensure structure
    config.localHeuristics = {
      enabled: config.localHeuristics.enabled ?? true,
      domainCategoryRules: config.localHeuristics.domainCategoryRules ?? {}
    };
  }

  return config;
}

export function saveConfig(config: any) {
  const configPath = getConfigPath();
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to save config:", e);
  }
}
