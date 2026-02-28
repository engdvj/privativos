export const CONFIG_DEFAULTS = {
  MAX_KITS_POR_FUNCIONARIO: "2",
} as const;

export type ConfiguracaoComPadrao = keyof typeof CONFIG_DEFAULTS;

export const CONFIG_DEFAULT_KEYS = Object.keys(CONFIG_DEFAULTS) as ConfiguracaoComPadrao[];

export function isConfiguracaoComPadrao(chave: string): chave is ConfiguracaoComPadrao {
  return Object.prototype.hasOwnProperty.call(CONFIG_DEFAULTS, chave);
}
