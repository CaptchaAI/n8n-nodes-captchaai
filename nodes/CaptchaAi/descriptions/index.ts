import { captchaTypeDescription } from './captchaTypeDescription';
import { concurrencyDescription } from './concurrencyDescription';
import { fieldDescriptions } from './fieldDescriptions';
import { settingsDescription } from './settingDescription';
import { threadBalanceDescription } from './threadBalanceDescription';

export {
	captchaTypeDescription,
	concurrencyDescription,
	fieldDescriptions,
	settingsDescription,
	threadBalanceDescription,
};

/** Full property list for the node, in display order. */
export const nodeProperties = [
	...threadBalanceDescription,
	...captchaTypeDescription,
	...fieldDescriptions,
	...concurrencyDescription,
	...settingsDescription,
];
