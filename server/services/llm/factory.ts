import { ICategorizationStrategy } from "./interfaces.ts";
import { OpenRouterStrategy } from "./openrouter.strategy.ts";

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
