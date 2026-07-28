import type {
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

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

	/**
	 * Declarative credential test required by n8n's community-package scanner.
	 * The node still keeps methods.credentialTest.captchaAiApiTest for the richer
	 * Test-button message; this property is what the scanner looks for.
	 *
	 * CaptchaAI returns HTTP 200 even for a bad key, with status: 0 in the body,
	 * so the failure rule checks that rather than a non-2xx status code.
	 */
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://ocr.captchaai.com',
			url: '/res.php',
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: {
				key: '={{$credentials.apiKey}}',
				action: 'threadsinfo',
				json: '1',
			},
		},
		rules: [
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'status',
					value: 0,
					message: 'Invalid API key. Check the 32-character key from your CaptchaAI dashboard.',
				},
			},
		],
	};
}
