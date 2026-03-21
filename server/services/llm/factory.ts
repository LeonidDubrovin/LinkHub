import { ICategorizationStrategy } from "./interfaces.js";
import { OpenRouterStrategy } from "./openrouter.strategy.js";

export class CategorizationStrategyFactory {
  static create(config: any): ICategorizationStrategy {
    switch (config.provider) {
      case 'openrouter':
        return new OpenRouterStrategy(config);
      default:
        throw new Error(`Unsupported LLM provider: ${config.provider}`);
    }
  }
}
