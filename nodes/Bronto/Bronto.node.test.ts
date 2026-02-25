/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { Bronto } from './Bronto.node';

// ---------------------------------------------------------------------------
// Helper: build a mock IExecuteFunctions context
// ---------------------------------------------------------------------------
function createMockContext(overrides: {
	params?: Record<string, any>;
	credentials?: Record<string, any>;
	httpResponses?: any[];
	continueOnFail?: boolean;
	inputItems?: any[];
}) {
	const {
		params = {},
		credentials = { region: 'eu', apiKey: 'key-123' },
		httpResponses = [{}],
		continueOnFail = false,
		inputItems = [{ json: {} }],
	} = overrides;

	let httpCallIndex = 0;
	const httpRequestWithAuthentication = jest.fn().mockImplementation(() => {
		const resp = httpResponses[httpCallIndex] ?? httpResponses[httpResponses.length - 1];
		httpCallIndex++;
		return Promise.resolve(resp);
	});

	const ctx = {
		getInputData: jest.fn().mockReturnValue(inputItems),
		getNodeParameter: jest.fn().mockImplementation((name: string, _index: number) => {
			if (name in params) return params[name];
			const defaults: Record<string, any> = {
				operation: 'executeSearch',
				sourceType: 'datasetIds',
				from: ['my-log'],
				fromTags: '',
				timeRange: 'Last 1 hour',
				where: '',
				select: '*, @raw',
				groups: '',
				limit: 100,
				additionalOptions: {},
			};
			return defaults[name];
		}),
		getCredentials: jest.fn().mockResolvedValue(credentials),
		getNode: jest.fn().mockReturnValue({ name: 'Bronto' }),
		continueOnFail: jest.fn().mockReturnValue(continueOnFail),
		helpers: {
			httpRequestWithAuthentication,
		},
	};

	return ctx;
}

async function executeNode(ctx: any) {
	const node = new Bronto();
	return node.execute.call(ctx);
}

// ---------------------------------------------------------------------------
// from_expr sanitization
// ---------------------------------------------------------------------------
describe('from_expr sanitization', () => {
	it('should escape single quotes in log names (replaced then stripped)', async () => {
		const ctx = createMockContext({ params: { from: ["my'log"] } });
		await executeNode(ctx);

		const body = ctx.helpers.httpRequestWithAuthentication.mock.calls[0][1].body;
		expect(body.from_expr).toBe("(dataset IN ('mylog'))");
	});

	it('should strip special characters from log names', async () => {
		const ctx = createMockContext({ params: { from: ['log;DROP TABLE'] } });
		await executeNode(ctx);

		const body = ctx.helpers.httpRequestWithAuthentication.mock.calls[0][1].body;
		expect(body.from_expr).toBe("(dataset IN ('logDROPTABLE'))");
	});

	it('should handle multiple log names', async () => {
		const ctx = createMockContext({ params: { from: ['log-a', 'log-b', 'log.c'] } });
		await executeNode(ctx);

		const body = ctx.helpers.httpRequestWithAuthentication.mock.calls[0][1].body;
		expect(body.from_expr).toBe("(dataset IN ('log-a','log-b','log.c'))");
	});

	it('should allow alphanumeric, underscore, dash, dot, and slash', async () => {
		const ctx = createMockContext({ params: { from: ['a_b-c.d/e'] } });
		await executeNode(ctx);

		const body = ctx.helpers.httpRequestWithAuthentication.mock.calls[0][1].body;
		expect(body.from_expr).toBe("(dataset IN ('a_b-c.d/e'))");
	});
});

// ---------------------------------------------------------------------------
// Request body construction
// ---------------------------------------------------------------------------
describe('request body construction', () => {
	it('should map all basic parameters', async () => {
		const ctx = createMockContext({
			params: {
				from: ['mylog'],
				timeRange: 'Last 5 minutes',
				where: 'level:error',
				select: 'field1, field2',
				groups: 'host',
				limit: 50,
				additionalOptions: { most_recent_first: false },
			},
		});
		await executeNode(ctx);

		const body = ctx.helpers.httpRequestWithAuthentication.mock.calls[0][1].body;
		expect(body.time_range).toBe('Last 5 minutes');
		expect(body.where).toBe('level:error');
		expect(body.select).toEqual(['field1', 'field2']);
		expect(body.groups).toEqual(['host']);
		expect(body.limit).toBe(50);
		expect(body.most_recent_first).toBe(false);
	});

	it('should default most_recent_first to true', async () => {
		const ctx = createMockContext({ params: { additionalOptions: {} } });
		await executeNode(ctx);

		const body = ctx.helpers.httpRequestWithAuthentication.mock.calls[0][1].body;
		expect(body.most_recent_first).toBe(true);
	});

	it('should include from_ts and to_ts when non-zero', async () => {
		const ctx = createMockContext({
			params: { additionalOptions: { from_ts: 1000, to_ts: 2000 } },
		});
		await executeNode(ctx);

		const body = ctx.helpers.httpRequestWithAuthentication.mock.calls[0][1].body;
		expect(body.from_ts).toBe(1000);
		expect(body.to_ts).toBe(2000);
	});

	it('should omit from_ts and to_ts when zero', async () => {
		const ctx = createMockContext({
			params: { additionalOptions: { from_ts: 0, to_ts: 0 } },
		});
		await executeNode(ctx);

		const body = ctx.helpers.httpRequestWithAuthentication.mock.calls[0][1].body;
		expect(body.from_ts).toBeUndefined();
		expect(body.to_ts).toBeUndefined();
	});

	it('should not include where/groups when empty', async () => {
		const ctx = createMockContext({ params: { where: '', groups: '' } });
		await executeNode(ctx);

		const body = ctx.helpers.httpRequestWithAuthentication.mock.calls[0][1].body;
		expect(body.where).toBeUndefined();
		expect(body.groups).toBeUndefined();
	});

	it('should include num_of_slices when set', async () => {
		const ctx = createMockContext({
			params: { additionalOptions: { num_of_slices: 20 } },
		});
		await executeNode(ctx);

		const body = ctx.helpers.httpRequestWithAuthentication.mock.calls[0][1].body;
		expect(body.num_of_slices).toBe(20);
	});

	it('should use correct region URL', async () => {
		const ctx = createMockContext({ credentials: { region: 'us', apiKey: 'k' } });
		await executeNode(ctx);

		const url = ctx.helpers.httpRequestWithAuthentication.mock.calls[0][1].url;
		expect(url).toBe('https://api.us.bronto.io/search');
	});

	it('should send select as an array', async () => {
		const ctx = createMockContext({ params: { select: '*, @raw' } });
		await executeNode(ctx);

		const body = ctx.helpers.httpRequestWithAuthentication.mock.calls[0][1].body;
		expect(body.select).toEqual(['*', '@raw']);
	});
});

// ---------------------------------------------------------------------------
// Tags mode
// ---------------------------------------------------------------------------
describe('tags mode', () => {
	it('should use from_tags instead of from_expr', async () => {
		const ctx = createMockContext({
			params: { sourceType: 'tags', fromTags: 'env:prod,service:api' },
		});
		await executeNode(ctx);

		const body = ctx.helpers.httpRequestWithAuthentication.mock.calls[0][1].body;
		expect(body.from_tags).toBe('env:prod,service:api');
		expect(body.from_expr).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------
describe('response parsing', () => {
	it('should return events when present', async () => {
		const ctx = createMockContext({
			httpResponses: [{ events: [{ msg: 'hello' }, { msg: 'world' }] }],
		});
		const result = await executeNode(ctx);

		expect(result[0]).toHaveLength(2);
		expect(result[0][0].json).toEqual({ msg: 'hello' });
	});

	it('should return groups when events are empty', async () => {
		const ctx = createMockContext({
			httpResponses: [{ events: [], groups: [{ host: 'a', count: 5 }] }],
		});
		const result = await executeNode(ctx);

		expect(result[0]).toHaveLength(1);
		expect(result[0][0].json).toEqual({ host: 'a', count: 5 });
	});

	it('should return result when events and groups are empty', async () => {
		const ctx = createMockContext({
			httpResponses: [{ events: [], groups: [], result: [{ total: 42 }] }],
		});
		const result = await executeNode(ctx);

		expect(result[0]).toHaveLength(1);
		expect(result[0][0].json).toEqual({ total: 42 });
	});

	it('should return full response as fallback', async () => {
		const ctx = createMockContext({
			httpResponses: [{ some_field: 'value' }],
		});
		const result = await executeNode(ctx);

		expect(result[0]).toHaveLength(1);
		expect(result[0][0].json).toEqual({ some_field: 'value' });
	});
});

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------
describe('pagination', () => {
	it('should follow next_page_url when paginate is true', async () => {
		const ctx = createMockContext({
			params: { additionalOptions: { paginate: true } },
			httpResponses: [
				{
					events: [{ id: 1 }],
					pagination: { next_page_url: 'https://api.eu.bronto.io/search?page=2' },
				},
				{
					events: [{ id: 2 }],
					pagination: {},
				},
			],
		});
		const result = await executeNode(ctx);

		expect(ctx.helpers.httpRequestWithAuthentication).toHaveBeenCalledTimes(2);
		expect(result[0]).toHaveLength(2);
		expect(ctx.helpers.httpRequestWithAuthentication.mock.calls[1][1].url).toBe(
			'https://api.eu.bronto.io/search?page=2',
		);
	});

	it('should not paginate when paginate is false', async () => {
		const ctx = createMockContext({
			params: { additionalOptions: { paginate: false } },
			httpResponses: [
				{
					events: [{ id: 1 }],
					pagination: { next_page_url: 'https://api.eu.bronto.io/search?page=2' },
				},
			],
		});
		const result = await executeNode(ctx);

		expect(ctx.helpers.httpRequestWithAuthentication).toHaveBeenCalledTimes(1);
		expect(result[0]).toHaveLength(1);
	});

	it('should stop when next_page_url is absent', async () => {
		const ctx = createMockContext({
			params: { additionalOptions: { paginate: true } },
			httpResponses: [{ events: [{ id: 1 }] }],
		});
		const result = await executeNode(ctx);

		expect(ctx.helpers.httpRequestWithAuthentication).toHaveBeenCalledTimes(1);
		expect(result[0]).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// continueOnFail
// ---------------------------------------------------------------------------
describe('continueOnFail', () => {
	it('should return error object when continueOnFail is true', async () => {
		const ctx = createMockContext({
			continueOnFail: true,
			httpResponses: [],
		});
		ctx.helpers.httpRequestWithAuthentication.mockRejectedValue(new Error('API down'));

		const result = await executeNode(ctx);

		expect(result[0]).toHaveLength(1);
		expect(result[0][0].json.error).toBe('API down');
	});

	it('should throw NodeApiError when continueOnFail is false', async () => {
		const ctx = createMockContext({
			continueOnFail: false,
			httpResponses: [],
		});
		ctx.helpers.httpRequestWithAuthentication.mockRejectedValue(new Error('API down'));

		await expect(executeNode(ctx)).rejects.toThrow();
	});
});
