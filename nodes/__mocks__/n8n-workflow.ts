/* eslint-disable */
// Minimal mock of n8n-workflow types used by Bronto node
export interface IDataObject {
	[key: string]: any;
}
export interface IExecuteFunctions {}
export interface ILoadOptionsFunctions {}
export interface INodeExecutionData {
	json: IDataObject;
}
export interface INodePropertyOptions {
	name: string;
	value: string;
}
export interface INodeType {}
export interface INodeTypeDescription {}
export interface JsonObject {
	[key: string]: any;
}

export class NodeApiError extends Error {
	constructor(node: any, data: any) {
		super(data?.message ?? 'NodeApiError');
		this.name = 'NodeApiError';
	}
}

export enum NodeConnectionTypes {
	Main = 'main',
}
