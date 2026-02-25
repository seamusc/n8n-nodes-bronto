import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class BrontoApi implements ICredentialType {
	name = 'brontoApi';
	displayName = 'Bronto API';
	icon = 'file:bronto.svg' as const;
	documentationUrl = 'https://docs.bronto.io';

	properties: INodeProperties[] = [
		{
			displayName: 'Region',
			name: 'region',
			type: 'options',
			options: [
				{ name: 'EU', value: 'eu' },
				{ name: 'US', value: 'us' },
			],
			default: 'eu',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-BRONTO-API-KEY': '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '=https://api.{{$credentials.region}}.bronto.io',
			url: '/api-keys',
			method: 'GET',
		},
	};
}
