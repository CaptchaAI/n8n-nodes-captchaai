import { CaptchaAI, CaptchaAIError, InvalidKeyError } from 'captchaai-javascript';
import type { ProxyType } from 'captchaai-javascript';
import type {
	ICredentialDataDecryptedObject,
	ICredentialTestFunctions,
	ICredentialsDecrypted,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeCredentialTestResult,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { resolveCaptchaType } from './config/captchaTypes';
import { nodeProperties } from './descriptions';
import { runInBatches } from './libs/batch';
import { toNodeError } from './libs/errors';
import { toErrorItem, toOutputItem } from './libs/output';
import { buildParams } from './libs/paramBuilder';
import { closeClient, createClient, resolveApiKey } from './libs/sdk';
import type { SolveSettings } from './libs/types';

const DEFAULT_MAX_POLL_SECONDS = 180;

export class CaptchaAi implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'CaptchaAI',
		name: 'captchaAi',
		icon: { light: 'file:captchaai.svg', dark: 'file:captchaai.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["captchaType"]}}',
		description: 'Solve CAPTCHAs with CaptchaAI',
		defaults: {
			name: 'CaptchaAI',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'captchaAiApi',
				required: true,
				testedBy: 'captchaAiApiTest',
			},
		],
		properties: nodeProperties,
	};

	methods = {
		credentialTest: {
			/**
			 * Validates a key by asking the API for the account's thread info,
			 * which is the cheapest authenticated call the service offers and
			 * costs nothing.
			 */
			async captchaAiApiTest(
				this: ICredentialTestFunctions,
				credential: ICredentialsDecrypted<ICredentialDataDecryptedObject>,
			): Promise<INodeCredentialTestResult> {
				// Trimmed because the SDK checks the length of the trimmed key but
				// sends it as typed, so a stray space would fail against the API
				// with a length complaint about a key of the right length.
				const apiKey = ((credential.data?.apiKey as string | undefined) ?? '').trim();

				if (apiKey === '') {
					return {
						status: 'Error',
						message:
							'The API key is empty. Paste the 32-character key from your CaptchaAI dashboard.',
					};
				}

				let client: CaptchaAI | undefined;
				try {
					client = new CaptchaAI({ apiKey });
					const info = await client.threadsInfo();
					return {
						status: 'OK',
						message: `Connected. Your plan allows ${info.threads} concurrent solves, ${info.workingThreads} in use right now.`,
					};
				} catch (error) {
					if (error instanceof InvalidKeyError) {
						return {
							status: 'Error',
							message: `CaptchaAI rejected this key: ${error.message}. Copy the 32-character key from your CaptchaAI dashboard.`,
						};
					}
					if (error instanceof CaptchaAIError) {
						return { status: 'Error', message: error.message };
					}
					return {
						status: 'Error',
						message: `Could not reach the CaptchaAI API: ${(error as Error).message}`,
					};
				} finally {
					await closeClient(client);
				}
			},
		},

		loadOptions: {
			/**
			 * Reads the thread balance of the one credential attached to this
			 * node. n8n caches the result, so this runs when the node is opened,
			 * when a different credential is picked, and on "Refresh List" -
			 * not on every reopen of the dropdown.
			 *
			 * A failure is returned as the option text rather than thrown: the
			 * field is a readout, and an error toast over a number the user only
			 * glanced at is worse than the reason sitting in its place.
			 */
			async getThreadBalance(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				let client: CaptchaAI | undefined;
				try {
					const credentials = await this.getCredentials('captchaAiApi');
					client = new CaptchaAI({ apiKey: resolveApiKey(credentials.apiKey) });
					const { threads, workingThreads } = await client.threadsInfo();
					const free = Math.max(threads - workingThreads, 0);

					return [
						{
							name: `${free} of ${threads} threads free · ${workingThreads} currently in use`,
							value: '',
						},
					];
				} catch (error) {
					return [{ name: `Thread balance unavailable: ${balanceErrorText(error)}`, value: '' }];
				} finally {
					await closeClient(client);
				}
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		if (items.length === 0) {
			return [[]];
		}

		const executionMode = this.getNodeParameter('executionMode', 0, 'sequential') as string;
		const rawSettings = this.getNodeParameter('settings', 0, {}) as Record<string, unknown>;

		const settings: SolveSettings = {
			maxPollSeconds: asPositiveNumber(rawSettings.maxPollSeconds),
			maxRetries: asPositiveNumber(rawSettings.maxRetries),
			proxy: asNonEmptyString(rawSettings.proxy),
			proxyType: asNonEmptyString(rawSettings.proxyType) as ProxyType | undefined,
			includeRaw: rawSettings.includeRaw === true,
		};

		const chunkSize =
			executionMode === 'parallel'
				? (this.getNodeParameter('batchSize', 0, 5) as number)
				: 1;

		const credentials = await this.getCredentials('captchaAiApi');
		const node = this.getNode();

		// One client for the whole execution. Its constructor kicks off a
		// threadsInfo() call that createClient awaits, so an unusable key fails
		// here rather than once per item.
		const client = await createClient({
			apiKey: credentials.apiKey as string,
			maxPollSeconds: settings.maxPollSeconds,
			maxRetries: settings.maxRetries,
			// The SDK rejects a proxy type with no proxy, so send the pair or neither.
			...(settings.proxy ? { proxy: settings.proxy, proxyType: settings.proxyType } : {}),
		}).catch((error: unknown) => {
			let captchaType = 'unknown';
			try {
				captchaType = resolveCaptchaType(this.getNodeParameter('captchaType', 0));
			} catch {
				// Client failed before type mattered; keep a neutral label in the error.
			}
			throw toNodeError(node, error, { itemIndex: 0, captchaType });
		});

		const output: INodeExecutionData[] = new Array(items.length);
		// Task IDs are kept per item so a failed poll can still be traced back
		// to the submitted task.
		const taskIds: Array<string | undefined> = new Array(items.length);

		try {
			await runInBatches(items.length, {
				chunkSize,
				solve: async (itemIndex) => {
					const captchaType = resolveCaptchaType(
						this.getNodeParameter('captchaType', itemIndex),
					);

					const params = buildParams(captchaType, {
						read: (name, fallback) => this.getNodeParameter(name, itemIndex, fallback),
						binaryPropertyNames: Object.keys(items[itemIndex]?.binary ?? {}),
						settings,
					});

					const taskId = await client.send(captchaType, params);
					taskIds[itemIndex] = taskId;
					return await client.getResult(captchaType, taskId);
				},
				onSuccess: (itemIndex, result) => {
					const captchaType = resolveCaptchaType(
						this.getNodeParameter('captchaType', itemIndex),
					);
					output[itemIndex] = toOutputItem(result, {
						captchaType,
						itemIndex,
						includeRaw: settings.includeRaw,
					});
				},
				onFailure: (itemIndex, error) => {
					let captchaType = 'unknown';
					try {
						captchaType = resolveCaptchaType(this.getNodeParameter('captchaType', itemIndex));
					} catch {
						// Validation failed before a type was established.
					}

					if (this.continueOnFail()) {
						output[itemIndex] = toErrorItem(error, {
							captchaType,
							itemIndex,
							taskId: taskIds[itemIndex],
						});
						return;
					}

					throw toNodeError(node, error, {
						itemIndex,
						captchaType,
						taskId: taskIds[itemIndex],
						maxPollSeconds: settings.maxPollSeconds ?? DEFAULT_MAX_POLL_SECONDS,
					});
				},
			});
		} finally {
			await closeClient(client);
		}

		return [output];
	}
}

function balanceErrorText(error: unknown): string {
	if (error instanceof InvalidKeyError) return 'CaptchaAI rejected this API key';
	if (error instanceof CaptchaAIError) return error.message;
	return (error as Error).message;
}

function asPositiveNumber(value: unknown): number | undefined {
	const parsed = Number(value);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function asNonEmptyString(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed === '' ? undefined : trimmed;
}
