import type { Icon, ICredentialType, INodeProperties } from 'n8n-workflow';

export class CaptchaAiApi implements ICredentialType {
	name = 'captchaAiApi';

	displayName = 'CaptchaAI API';

	documentationUrl = 'https://docs.captchaai.com/';

	icon: Icon = { light: 'file:captchaai.svg', dark: 'file:captchaai.dark.svg' };

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			placeholder: '00000000000000000000000000000000',
			description:
				'Your CaptchaAI API key, exactly 32 characters. Find it in your CaptchaAI dashboard. Use the Test button above to validate the key, which checks it against your account thread info.',
		},
	];
}
