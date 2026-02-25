import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes } from 'n8n-workflow';

export class Bronto implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Bronto',
		name: 'bronto',
		icon: 'file:bronto.svg',
		group: ['input'],
		version: [1],
		subtitle: 'Search',
		description: 'Search logs via the Bronto.io API',
		defaults: {
			name: 'Bronto',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'brontoApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Search',
						value: 'executeSearch',
						description: 'Search log data',
						action: 'Search log data',
					},
				],
				default: 'executeSearch',
			},
			{
				displayName: 'Source Type',
				name: 'sourceType',
				type: 'options',
				options: [
					{ name: 'Logs', value: 'datasetIds' },
					{ name: 'Tags', value: 'tags' },
				],
				default: 'datasetIds',
				description: 'Whether to search by log datasets or tags',
			},
			{
				displayName: 'Log Names or IDs',
				name: 'from',
				type: 'multiOptions',
				typeOptions: {
					loadOptionsMethod: 'getLogs',
				},
				default: [],
				required: true,
				displayOptions: {
					show: { sourceType: ['datasetIds'] },
				},
				description: 'Log datasets to search. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'From (Tags)',
				name: 'fromTags',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: { sourceType: ['tags'] },
				},
				description: 'Tags as key:value pairs to search',
			},
			{
				displayName: 'Time Range',
				name: 'timeRange',
				type: 'string',
				default: 'Last 1 hour',
				description: 'Relative time range, e.g. "Last 10 seconds", "Last 2 days"',
			},
			{
				displayName: 'Where',
				name: 'where',
				type: 'string',
				default: '',
				description: 'SQL-like filter expression, e.g. "level:error AND duration_ms>2000"',
			},
			{
				displayName: 'Select',
				name: 'select',
				type: 'string',
				default: '*, @raw',
				description:
					'Comma-separated columns or aggregate functions (e.g. "*, @raw" or "count()")',
			},
			{
				displayName: 'Groups',
				name: 'groups',
				type: 'string',
				default: '',
				description: 'Key to group aggregate results by',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 6666 },
				default: 50,
				description: 'Max number of results to return',
			},
			{
				displayName: 'Additional Options',
				name: 'additionalOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'From Timestamp (Ms)',
						name: 'from_ts',
						type: 'number',
						default: 0,
						description: 'Absolute start time in Unix milliseconds (use with To Timestamp)',
					},
					{
						displayName: 'Most Recent First',
						name: 'most_recent_first',
						type: 'boolean',
						default: true,
						description: 'Whether to return most recent results first',
					},
					{
						displayName: 'Number of Slices',
						name: 'num_of_slices',
						type: 'number',
						default: 10,
						description: 'Number of time series buckets for aggregates',
					},
					{
						displayName: 'Paginate',
						name: 'paginate',
						type: 'boolean',
						default: false,
						description: 'Whether to automatically follow next_page_url to fetch all pages',
					},
					{
						displayName: 'To Timestamp (Ms)',
						name: 'to_ts',
						type: 'number',
						default: 0,
						description: 'Absolute end time in Unix milliseconds (use with From Timestamp)',
					},
				],
			},
		],
		usableAsTool: true,
	};

	methods = {
		loadOptions: {
			async getLogs(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials('brontoApi');
				const region = credentials.region as string;

				const response = await this.helpers.httpRequestWithAuthentication.call(
					this,
					'brontoApi',
					{
						method: 'GET',
						url: `https://api.${region}.bronto.io/logs`,
						json: true,
					},
				);

				const logs =
					(response.logs as Array<{ log: string; log_id: string; logset: string }>) ?? [];

				return logs.map((entry) => ({
					name: `${entry.log} (${entry.logset})`,
					value: entry.log,
				}));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const sourceType = this.getNodeParameter('sourceType', i) as string;
				const timeRange = this.getNodeParameter('timeRange', i) as string;
				const where = this.getNodeParameter('where', i) as string;
				const selectRaw = this.getNodeParameter('select', i) as string;
				const groups = this.getNodeParameter('groups', i) as string;
				const limit = this.getNodeParameter('limit', i) as number;
				const additionalOptions = this.getNodeParameter('additionalOptions', i) as {
					most_recent_first?: boolean;
					num_of_slices?: number;
					from_ts?: number;
					to_ts?: number;
					paginate?: boolean;
				};

				const credentials = await this.getCredentials('brontoApi');
				const region = credentials.region as string;
				const baseUrl = `https://api.${region}.bronto.io`;

				const body: Record<string, unknown> = { limit };

				if (sourceType === 'datasetIds') {
					const logNames = this.getNodeParameter('from', i) as string[];
					const sanitized = logNames.map((n) =>
						n.replace(/'/g, "''").replace(/[^a-zA-Z0-9_\-./]/g, ''),
					);
					const quoted = sanitized.map((n) => `'${n}'`).join(',');
					body.from_expr = `(dataset IN (${quoted}))`;
				} else {
					body.from_tags = this.getNodeParameter('fromTags', i) as string;
				}

				if (timeRange) body.time_range = timeRange;
				if (where) body.where = where;
				if (groups) body.groups = groups.split(',').map((s) => s.trim());

				if (selectRaw) {
					body.select = selectRaw.split(',').map((s) => s.trim());
				}

				body.most_recent_first = additionalOptions.most_recent_first ?? true;

				if (additionalOptions.num_of_slices) {
					body.num_of_slices = additionalOptions.num_of_slices;
				}
				if (additionalOptions.from_ts !== undefined && additionalOptions.from_ts !== 0) {
					body.from_ts = additionalOptions.from_ts;
				}
				if (additionalOptions.to_ts !== undefined && additionalOptions.to_ts !== 0) {
					body.to_ts = additionalOptions.to_ts;
				}

				const paginate = additionalOptions.paginate ?? false;
				let url = `${baseUrl}/search`;

				do {
					const response = await this.helpers.httpRequestWithAuthentication.call(
						this,
						'brontoApi',
						{
							method: 'POST',
							url,
							body,
							json: true,
						},
					);

					const events = (response.events as IDataObject[]) ?? [];
					const result = (response.result as IDataObject[]) ?? [];
					const groupsResult = (response.groups as IDataObject[]) ?? [];

					if (events.length > 0) {
						for (const event of events) {
							returnData.push({ json: event });
						}
					} else if (groupsResult.length > 0) {
						for (const group of groupsResult) {
							returnData.push({ json: group });
						}
					} else if (result.length > 0) {
						for (const item of result) {
							returnData.push({ json: item });
						}
					} else {
						returnData.push({ json: response as IDataObject });
					}

					const nextPageUrl = response?.pagination?.next_page_url as string | undefined;
					if (paginate && nextPageUrl) {
						url = nextPageUrl;
					} else {
						break;
					}
				// eslint-disable-next-line no-constant-condition
			} while (true);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message } });
					continue;
				}
				throw new NodeApiError(this.getNode(), error as JsonObject);
			}
		}

		return [returnData];
	}
}
