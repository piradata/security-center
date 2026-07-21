export type ToolSetting = {
  toolId: string;
  enabled: boolean;
};

export type ToolDefinition = {
  id: string;
  key: string;
  name: string;
};

export type EffectiveTool = ToolDefinition & {
  enabled: boolean;
  source: "application" | "service";
};

export function effectiveToolConfig(
  tools: ToolDefinition[],
  applicationDefaults: ToolSetting[],
  serviceOverrides: ToolSetting[],
): EffectiveTool[] {
  const defaults = new Map(applicationDefaults.map((config) => [config.toolId, config.enabled]));
  const overrides = new Map(serviceOverrides.map((config) => [config.toolId, config.enabled]));

  return tools.map((tool) => ({
    ...tool,
    enabled: overrides.get(tool.id) ?? defaults.get(tool.id) ?? true,
    source: overrides.has(tool.id) ? "service" : "application",
  }));
}
